import { baselineFor, type PvtSessionRow } from '@/lib/pvt/baseline'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  buildOpsDayPayload,
  dayKey,
  indexResponsesByPlayerDay,
  mergeBodyMapsIntoDays,
  pickDefaultSurvey,
  sortSurveysForOps,
} from '@/lib/opsDayBuild'
import { loadOpsQuestionMappings } from '@/lib/opsTablePrefs'
import { ensureDefaultOpsRules, syncOpsInterventions } from '@/lib/opsRulesService'
import { listOpsMetrics, attachDerivedMetrics } from '@/lib/opsMetricsService'
import { ensureOpsSchema } from '@/lib/opsSchemaEnsure'

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
    // 28d history for ACWR / EWMA / rolling stats on derived metrics.
    const historyStart = new Date(dayStart)
    historyStart.setDate(historyStart.getDate() - 28)
    const mapStart = new Date(dayStart)
    mapStart.setDate(mapStart.getDate() - 6)

    try {
      await ensureOpsSchema()
    } catch (schemaError) {
      console.error('Ops schema ensure skipped:', schemaError)
    }

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

    // Prefs are optional — never let a missing/migrating prefs table kill Live Ops.
    let questionMappings: Awaited<ReturnType<typeof loadOpsQuestionMappings>> = {}
    if (survey) {
      try {
        questionMappings = await loadOpsQuestionMappings({
          teamId,
          adminUserId: session.sub,
          surveyId: survey.id,
        })
      } catch (prefsError) {
        console.error('Ops today prefs load skipped:', prefsError)
      }
    }

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
                  questionId: true,
                  question: { select: { id: true, text: true, type: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          }),
          prisma.response.findMany({
            where: {
              surveyId: survey.id,
              survey: { teamId },
              submittedAt: { gte: mapStart, lt: dayEnd },
              playerId: { not: null },
            },
            select: {
              playerId: true,
              submittedAt: true,
              answers: {
                where: { question: { type: 'BODY_MAP' } },
                select: {
                  value: true,
                  questionId: true,
                  question: { select: { id: true, text: true, type: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          }),
        ])
      : [[], []]

    const { byPlayerDay, latestByPlayerDay } = indexResponsesByPlayerDay(history, {
      questionMappings,
    })

    mergeBodyMapsIntoDays({ latestByPlayerDay, bodyRows: todayBodyMaps })

    const day = buildOpsDayPayload({
      players,
      byPlayerDay,
      latestByPlayerDay,
      selectedDate,
    })

    const metrics = await listOpsMetrics(teamId)
    const playersWithDerived = attachDerivedMetrics({
      metrics,
      surveyId: survey?.id ?? null,
      selectedDate,
      players: day.players,
      byPlayerDay,
    })

    const [rules, interventions] = await Promise.all([
      ensureDefaultOpsRules(teamId),
      syncOpsInterventions({
        teamId,
        surveyId: survey?.id ?? null,
        date: selectedDate,
        players: playersWithDerived,
      }),
    ])

    let focusSessions: PvtSessionRow[] = []
    try {
      if (survey) focusSessions = await prisma.pvtSession.findMany({ where: { teamId, surveyId: survey.id, startedAt: { gte: historyStart, lt: dayEnd } }, select: { id: true, questionId: true, playerId: true, surveyId: true, localDate: true, startedAt: true, finishedAt: true, durationSeconds: true, protocolVersion: true, practice: true, status: true, deviceId: true, userAgent: true, context: true, summary: true, player: { select: { firstName: true, lastName: true } } }, orderBy: { startedAt: 'asc' }, take: 10000 }).then(rows => JSON.parse(JSON.stringify(rows)))
    } catch { /* Optional module must never prevent loading wellness. */ }
    const withFocus = playersWithDerived.map(player => {
      const attempts = focusSessions.filter(s => s.playerId === player.id && s.localDate === selectedDate && !s.practice && s.status === 'COMPLETED')
      // The first completed attempt is shown; repeating cannot replace a poor first result.
      const current = attempts[0]
      const base = current ? baselineFor(current, focusSessions) : null
      return { ...player, focus: current ? { medianRT: current.summary?.medianRT ?? null, quality: current.summary?.quality || 'REVIEW', duration: current.durationSeconds, deltaPercent: base?.deltaPercent ?? null, baselineDays: base?.days ?? 0, count: attempts.length } : null }
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
        players: withFocus,
        rules,
        interventions,
        metrics,
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
