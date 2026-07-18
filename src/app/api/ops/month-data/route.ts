import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  buildOpsDayPayload,
  dayKey,
  indexResponsesByPlayerDay,
  pickDefaultSurvey,
  sortSurveysForOps,
} from '@/lib/opsDayBuild'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Prefetch an entire month of Live Ops table data (no body-map JSON).
 * GET /api/ops/month-data?month=YYYY-MM&surveyId=
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
    const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0)
    const monthEnd = new Date(y, m, 1, 0, 0, 0, 0)
    // Extra lookback so day-1 averages still work.
    const historyStart = new Date(monthStart)
    historyStart.setDate(historyStart.getDate() - 7)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    })
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const surveys = await prisma.survey.findMany({
      where: { teamId },
      select: { id: true, title: true, isActive: true, updatedAt: true },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    })

    let survey: { id: string; title: string; isActive: boolean } | null = null
    if (surveyIdParam) {
      const owned = surveys.find((s) => s.id === surveyIdParam)
      if (!owned) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
      }
      survey = { id: owned.id, title: owned.title, isActive: owned.isActive }
    } else {
      survey = pickDefaultSurvey(surveys)
    }

    const players = await prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true, firstName: true, lastName: true, image: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    const history = survey
      ? await prisma.response.findMany({
          where: {
            surveyId: survey.id,
            survey: { teamId },
            submittedAt: { gte: historyStart, lt: monthEnd },
            playerId: { not: null },
          },
          select: {
            playerId: true,
            submittedAt: true,
            answers: {
              where: { question: { type: { not: 'BODY_MAP' } } },
              select: {
                value: true,
                question: { select: { text: true, type: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        })
      : []

    const { byPlayerDay, latestByPlayerDay } = indexResponsesByPlayerDay(history)

    const days: Record<
      string,
      ReturnType<typeof buildOpsDayPayload>
    > = {}

    // Only materialize days that have at least one submission (+ keep payload small).
    const activeDays = new Set<string>()
    for (const dayMap of latestByPlayerDay.values()) {
      for (const key of dayMap.keys()) {
        if (key >= dayKey(monthStart) && key < dayKey(monthEnd)) activeDays.add(key)
      }
    }
    for (const key of activeDays) {
      days[key] = buildOpsDayPayload({
        players,
        byPlayerDay,
        latestByPlayerDay,
        selectedDate: key,
      })
    }

    return NextResponse.json(
      {
        team,
        survey,
        surveys: sortSurveysForOps(surveys).map((s) => ({
          id: s.id,
          title: s.title,
          isActive: s.isActive,
        })),
        month,
        generatedAt: new Date().toISOString(),
        days,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Ops month-data error:', error)
    return NextResponse.json({ error: 'Failed to load month data' }, { status: 500 })
  }
}
