import { baselineFor, type PvtSessionRow } from '@/lib/pvt/baseline'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import { pvtEnabled } from '@/lib/pvt/server'

export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(request: NextRequest) {
  const admin = await getAdminSessionFromRequest(request)
  if (!admin) return reply({ error: 'Unauthorized' }, 401)
  const surveys = await prisma.survey.findMany({ where: { teamId: admin.teamId }, select: { id: true, title: true, timezone: true, questions: { where: { type: 'PVT' }, select: { id: true, text: true, options: true } } }, orderBy: { title: 'asc' } })
  if (!pvtEnabled()) return reply({ enabled: false, ready: false, surveys, configs: [], sessions: [] })
  try {
    const [configs, sessions] = await Promise.all([
      prisma.pvtConfig.findMany({ where: { teamId: admin.teamId }, select: { surveyId: true, enabled: true, durationSeconds: true } }),
      prisma.pvtSession.findMany({
        where: { teamId: admin.teamId, startedAt: { gte: new Date(Date.now() - 58 * 86400_000) } },
        select: { id: true, questionId: true, questionLabel: true, responseId: true, surveyId: true, playerId: true, startedAt: true, localDate: true, finishedAt: true, durationSeconds: true, protocolVersion: true, practice: true, status: true, deviceId: true, userAgent: true, context: true, summary: true, player: { select: { firstName: true, lastName: true } } },
        orderBy: { startedAt: 'desc' }, take: 20000,
      }),
    ])
    // Display 28 days, but load enough earlier history for each displayed day's reference.
    const all: PvtSessionRow[] = JSON.parse(JSON.stringify(sessions.reverse()))
    const cutoff = Date.now() - 28 * 86400_000
    const visible = all.filter(s => Date.parse(s.startedAt) >= cutoff).slice(-10000)
    const byPlayer = new Map<string, PvtSessionRow[]>()
    for (const s of all) {
      const group = byPlayer.get(s.playerId) || []
      group.push(s); byPlayer.set(s.playerId, group)
    }
    const baselines = Object.fromEntries(visible.map(s => [s.id, baselineFor(s, byPlayer.get(s.playerId) || [])]))
    return reply({ enabled: true, ready: true, surveys, configs, sessions: visible, baselines, truncated: sessions.length === 20000 || all.filter(s => Date.parse(s.startedAt) >= cutoff).length > 10000 })
  } catch {
    return reply({ enabled: true, ready: false, surveys, configs: [], sessions: [], error: 'Focus results could not be loaded. Try again or check the database migration.' })
  }
}
