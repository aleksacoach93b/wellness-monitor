import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  buildOpsDayPayload,
  dayKey,
  indexResponsesByPlayerDay,
  mergeBodyMapsIntoDay,
  pickDefaultSurvey,
  sortSurveysForOps,
} from '@/lib/opsDayBuild'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Local calendar day window. Optional `date=YYYY-MM-DD` (defaults to today). */
function selectedDayWindow(dateParam: string | null) {
  let base = new Date()
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split('-').map(Number)
    base = new Date(y, m - 1, d, 12, 0, 0, 0)
  }
  const dayStart = new Date(base)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return { dayStart, dayEnd, selectedDate: dayKey(dayStart) }
}

/**
 * Live Ops: check-in + Daily Wellness card payload for the session's team only.
 * Never accepts a client-supplied teamId — scope is always session.teamId.
 */
export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamId = session.teamId
  const surveyIdParam = request.nextUrl.searchParams.get('surveyId')
  const dateParam = request.nextUrl.searchParams.get('date')

  try {
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

    const { dayStart, dayEnd, selectedDate } = selectedDayWindow(dateParam)
    const historyStart = new Date(dayStart)
    historyStart.setDate(historyStart.getDate() - 7)

    const players = await prisma.player.findMany({
      where: { teamId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        image: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    const [history, todayBodyMaps] = survey
      ? await Promise.all([
          prisma.response.findMany({
            where: {
              surveyId: survey.id,
              survey: { teamId },
              submittedAt: { gte: historyStart, lt: dayEnd },
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
          }),
          prisma.response.findMany({
            where: {
              surveyId: survey.id,
              survey: { teamId },
              submittedAt: { gte: dayStart, lt: dayEnd },
              playerId: { not: null },
            },
            select: {
              playerId: true,
              submittedAt: true,
              answers: {
                where: { question: { type: 'BODY_MAP' } },
                select: {
                  value: true,
                  question: { select: { text: true, type: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          }),
        ])
      : [[], []]

    const { byPlayerDay, latestByPlayerDay } = indexResponsesByPlayerDay(history)

    // Attach body maps onto selected-day metrics before building cards.
    const latestToday = new Map<
      string,
      { submittedAt: Date; metrics: ReturnType<typeof import('@/lib/opsWellness').parseDayMetrics> }
    >()
    for (const [playerId, dayMap] of latestByPlayerDay) {
      const hit = dayMap.get(selectedDate)
      if (hit) latestToday.set(playerId, hit)
    }
    mergeBodyMapsIntoDay({ latestToday, bodyRows: todayBodyMaps })

    const day = buildOpsDayPayload({
      players,
      byPlayerDay,
      latestByPlayerDay,
      selectedDate,
    })

    return NextResponse.json(
      {
        team,
        survey,
        surveys: sortSurveysForOps(surveys).map((s) => ({
          id: s.id,
          title: s.title,
          isActive: s.isActive,
        })),
        generatedAt: new Date().toISOString(),
        selectedDate: day.selectedDate,
        stats: day.stats,
        wellnessSummary: day.wellnessSummary,
        players: day.players,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    console.error('Ops today error:', error)
    return NextResponse.json({ error: 'Failed to load live ops' }, { status: 500 })
  }
}
