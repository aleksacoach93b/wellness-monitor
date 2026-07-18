import { NextRequest, NextResponse } from 'next/server'
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

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }

  try {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
    const end = new Date(y, m, 1, 0, 0, 0, 0)

    let surveyId = surveyIdParam
    if (surveyId) {
      const owned = await prisma.survey.findFirst({
        where: { id: surveyId, teamId },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
    } else {
      const fallback = await prisma.survey.findFirst({
        where: { teamId },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true },
      })
      surveyId = fallback?.id ?? null
    }

    const activePlayers = await prisma.player.count({
      where: { teamId, isActive: true },
    })

    const days: Record<string, { done: number; total: number }> = {}

    if (surveyId) {
      const responses = await prisma.response.findMany({
        where: {
          surveyId,
          survey: { teamId },
          submittedAt: { gte: start, lt: end },
          playerId: { not: null },
        },
        select: { playerId: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      })

      const byDay = new Map<string, Set<string>>()
      for (const r of responses) {
        if (!r.playerId) continue
        const d = r.submittedAt
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
