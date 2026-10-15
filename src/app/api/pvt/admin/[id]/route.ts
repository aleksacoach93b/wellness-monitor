import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSessionFromRequest(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const attempt = await prisma.pvtSession.findFirst({ where: { id, teamId: admin.teamId }, select: { id: true, playerId: true, surveyId: true, questionId: true, questionLabel: true, responseId: true, startedAt: true, localDate: true, durationSeconds: true, protocolVersion: true, practice: true, status: true, context: true, raw: true, summary: true } })
  return NextResponse.json(attempt || { error: 'Not found' }, { status: attempt ? 200 : 404, headers: { 'Cache-Control': 'no-store' } })
}
