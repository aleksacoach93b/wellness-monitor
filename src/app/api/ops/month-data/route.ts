import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  buildOpsDayPayload,
  indexResponsesByPlayerDay,
  pickDefaultSurvey,
  sortSurveysForOps,
} from '@/lib/opsDayBuild'
import { validDay, shiftDay, dayWindow } from '@/lib/opsDates'
import { loadOpsQuestionMappings } from '@/lib/opsTablePrefs'

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

  if (!month || !/^\d{4}-\d{2}$/.test(month) || !validDay(month + '-01')) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }

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
      select: { id: true, title: true, isActive: true, updatedAt: true, timezone: true },
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

    const timezone = surveys.find(s => s.id === survey?.id)?.timezone || 'Europe/Belgrade'
    const firstDay = month + '-01'
    const nextMonth = shiftDay(month + '-28', 4).slice(0, 7) + '-01'
    const monthStart = dayWindow(firstDay, timezone).dayStart
    const monthEnd = dayWindow(nextMonth, timezone).dayStart
    const historyStart = new Date(monthStart.getTime() - 28 * 86400000)

    const players = await prisma.player.findMany({
      where: { teamId, isActive: true },
      select: { id: true, firstName: true, lastName: true, image: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    let questionMappings: Awaited<ReturnType<typeof loadOpsQuestionMappings>> = {}
    if (survey) {
      try {
        questionMappings = await loadOpsQuestionMappings({
          teamId,
          adminUserId: session.sub,
          surveyId: survey.id,
        })
      } catch (prefsError) {
        console.error('Ops month-data prefs load skipped:', prefsError)
      }
    }

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
                questionId: true,
                question: { select: { id: true, text: true, type: true } },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        })
      : []

    const { byPlayerDay, latestByPlayerDay } = indexResponsesByPlayerDay(history, {
      questionMappings,
    }, timezone)

    const days: Record<
      string,
      ReturnType<typeof buildOpsDayPayload>
    > = {}

    // Only materialize days that have at least one submission (+ keep payload small).
    const activeDays = new Set<string>()
    for (const dayMap of latestByPlayerDay.values()) {
      for (const key of dayMap.keys()) {
        if (key >= firstDay && key < nextMonth) activeDays.add(key)
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
