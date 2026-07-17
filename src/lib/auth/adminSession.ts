import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  signAdminSession,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from '@/lib/auth/adminSessionEdge'

export {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  signAdminSession,
  verifyAdminSessionToken,
  type AdminSessionPayload,
}
export type { AdminRole } from '@/lib/auth/adminSessionEdge'

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
