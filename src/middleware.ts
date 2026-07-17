import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/adminSession'

const CANONICAL_HOST = 'wellness-monitor-tan.vercel.app'
const BROKEN_HOST_FRAGMENTS = ['wellness-monitor-dm1f']

function isPublicAdminAuthPath(pathname: string): boolean {
  return pathname === '/admin/login' || pathname.startsWith('/admin/invite/')
}

function isAdminUiPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/admin' || pathname.startsWith('/admin/')
}

/** APIs that stay reachable without admin cookie (kiosk / Power BI / invite accept) */
function isAlwaysPublicApi(pathname: string, method: string): boolean {
  if (pathname === '/api/auth/login') return true
  if (pathname === '/api/auth/logout') return true
  if (/^\/api\/auth\/invite\/[^/]+$/.test(pathname)) return true
  if (pathname.startsWith('/api/responses')) return true
  if (pathname.startsWith('/api/kiosk/')) return true
  if (pathname.includes('/export/csv')) return true
  if (pathname.includes('/export/powerbi')) return true
  if (pathname.match(/\/api\/surveys\/[^/]+\/powerbi$/)) return true
  if (pathname.startsWith('/api/surveys/export/schema')) return true
  if (pathname === '/api/test') return true

  // Public reads for kiosk / survey filling
  if (method === 'GET' || method === 'HEAD') {
    if (pathname === '/api/kiosk-settings') return true
    if (pathname === '/api/admin-access') return true
    if (pathname === '/api/tags') return true
    if (pathname === '/api/surveys') return true
    if (/^\/api\/surveys\/[^/]+$/.test(pathname)) return true
    if (/^\/api\/surveys\/[^/]+\/schedule$/.test(pathname)) return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() ?? ''
  if (BROKEN_HOST_FRAGMENTS.some((frag) => host.includes(frag))) {
    const dest = request.nextUrl.clone()
    dest.hostname = CANONICAL_HOST
    dest.protocol = 'https:'
    dest.port = ''
    return NextResponse.redirect(dest, 308)
  }

  const { pathname } = request.nextUrl
  const method = request.method
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null

  if (isAdminUiPath(pathname)) {
    if (isPublicAdminAuthPath(pathname)) {
      const res = NextResponse.next()
      res.headers.set('x-admin-public', '1')
      if (pathname === '/admin/login' && session) {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      return res
    }
    if (!session) {
      const login = new URL('/admin/login', request.url)
      login.searchParams.set('next', pathname)
      return NextResponse.redirect(login)
    }
    // `/` stays as the surveys dashboard (auth required); `/admin` is the hub
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/auth/me' || pathname === '/api/auth/invite') {
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.next()
    }

    if (isAlwaysPublicApi(pathname, method)) {
      return NextResponse.next()
    }

    // Mutations and other admin APIs require login
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
