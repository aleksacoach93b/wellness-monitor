import { NextRequest, NextResponse } from 'next/server'
import { validDay, shiftDay, dayWindow, zonedDay } from '@/lib/opsDates'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Month activity dots for Live Ops calendar — team-scoped only.
 * GET /api/ops/calendar?month=YYYY-MM&surveyId=
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = session.teamId
  const month = request.nextUrl.searchParams.get('month')
  const surveyIdParam = request.nextUrl.searchParams.get('surveyId')

  if (!month || !/^\d{4}-\d{2}$/.test(month) || !validDay(month + '-01')) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }

  try {
    let timezone = 'Europe/Belgrade'
    let surveyId = surveyIdParam
    if (surveyId) {
      const owned = await prisma.survey.findFirst({
        where: { id: surveyId, teamId },
        select: { id: true, timezone: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
      timezone = owned.timezone
    } else {
      const surveys = await prisma.survey.findMany({
        where: { teamId },
        select: { id: true, title: true, isActive: true, timezone: true },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      })
      const isWellness = (title: string) => {
        const t = title.toLowerCase()
        return t.includes('wellness') && !t.includes('rpe')
      }
      const pick =
        surveys.find((s) => s.isActive && isWellness(s.title)) ??
        surveys.find((s) => isWellness(s.title)) ??
        surveys.find((s) => s.isActive) ??
        surveys[0] ??
        null
      surveyId = pick?.id ?? null
      timezone = pick?.timezone || timezone
    }

    const players = await prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true },
    })
    const activePlayers = players.length
    const start = dayWindow(month + '-01', timezone).dayStart
    const end = dayWindow(shiftDay(month + '-28', 4).slice(0, 7) + '-01', timezone).dayStart

    const days: Record<string, { done: number; total: number }> = {}

    if (surveyId) {
      const responses = await prisma.response.findMany({
        where: {
          surveyId,
          survey: { teamId },
          submittedAt: { gte: start, lt: end },
          playerId: { in: players.map(p => p.id) },
        },
        select: { playerId: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      })

      const byDay = new Map<string, Set<string>>()
      for (const r of responses) {
        if (!r.playerId) continue
        const key = zonedDay(r.submittedAt, timezone)
        let set = byDay.get(key)
        if (!set) {
          set = new Set()
          byDay.set(key, set)
        }
        set.add(r.playerId)
      }

      for (const [key, set] of byDay) {
        days[key] = { done: set.size, total: activePlayers }
      }
    }

    return NextResponse.json(
      { month, surveyId, totalPlayers: activePlayers, days },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops calendar error:', error)
    return NextResponse.json({ error: 'Failed to load calendar' }, { status: 500 })
  }
}
