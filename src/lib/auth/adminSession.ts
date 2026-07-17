import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { AdminRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const ADMIN_SESSION_COOKIE = 'wm_admin_session'
const SESSION_DAYS = 14

export type AdminSessionPayload = {
  sub: string
  email: string
  role: AdminRole
  /** Active team for data scoping */
  teamId: string
  name?: string | null
}

function secretKey() {
  const secret =
    process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'wellness-monitor-dev-admin-jwt-change-me'
  return new TextEncoder().encode(secret)
}

export async function signAdminSession(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    teamId: payload.teamId,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

export async function verifyAdminSessionToken(
  token: string
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    const email = typeof payload.email === 'string' ? payload.email : null
    const teamId = typeof payload.teamId === 'string' ? payload.teamId : null
    const role = payload.role === 'SUPER' || payload.role === 'TEAM_ADMIN' ? payload.role : null
    if (!sub || !email || !teamId || !role) return null
    return {
      sub,
      email,
      teamId,
      role,
      name: typeof payload.name === 'string' ? payload.name : null,
    }
  } catch {
    return null
  }
}

export function adminSessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyAdminSessionToken(token)
}

export async function getAdminSessionFromRequest(
  request: NextRequest
): Promise<AdminSessionPayload | null> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyAdminSessionToken(token)
}

export function isSuperAdmin(session: AdminSessionPayload): boolean {
  return session.role === 'SUPER'
}

export function teamWhere(session: AdminSessionPayload): { teamId: string } {
  return { teamId: session.teamId }
}

export async function assertSurveyAccess(
  session: AdminSessionPayload,
  surveyId: string
): Promise<boolean> {
  const survey = await prisma.survey.findFirst({
    where: { id: surveyId, teamId: session.teamId },
    select: { id: true },
  })
  return Boolean(survey)
}

export async function assertPlayerAccess(
  session: AdminSessionPayload,
  playerId: string
): Promise<boolean> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId: session.teamId },
    select: { id: true },
  })
  return Boolean(player)
}

export function unauthorizedJson() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
