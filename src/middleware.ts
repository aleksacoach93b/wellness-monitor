import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Canonical production host that has the real Supabase data */
const CANONICAL_HOST = 'wellness-monitor-tan.vercel.app'

/**
 * Broken / empty Vercel aliases (wrong DATABASE_URL) must never be used as "production".
 * Redirect them so staff always land on the dataset with surveys + responses.
 */
const BROKEN_HOST_FRAGMENTS = ['wellness-monitor-dm1f']

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() ?? ''

  const isBroken = BROKEN_HOST_FRAGMENTS.some((frag) => host.includes(frag))
  if (!isBroken) return NextResponse.next()

  const dest = request.nextUrl.clone()
  dest.hostname = CANONICAL_HOST
  dest.protocol = 'https:'
  dest.port = ''
  return NextResponse.redirect(dest, 308)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
