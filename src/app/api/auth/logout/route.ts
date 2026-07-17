import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from '@/lib/auth/adminSession'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    ...adminSessionCookieOptions(0),
    maxAge: 0,
  })
  return res
}
