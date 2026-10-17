import { isRhrQuestion, parseRhrAnswer } from '@/lib/rhr/options'
import { validDay, dayWindow, zonedDay } from '@/lib/opsDates'
import { localDay } from '@/lib/pvt/server'
import { parsePvtAnswer } from '@/lib/pvt/options'
import { baselineFor, type PvtSessionRow } from '@/lib/pvt/baseline'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  buildOpsDayPayload,
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
  if (dateParam && !validDay(dateParam)) return NextResponse.json({error:'Invalid date'}, {status:400})

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
    const { dayStart, dayEnd, selectedDate } = dayWindow(dateParam || zonedDay(new Date(), timezone), timezone)
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
              id: true,
              playerId: true,
              submittedAt: true,
              answers: {
                where: { question: { type: { not: 'BODY_MAP' } } },
                select: {
                  value: true,
                  questionId: true,
                  question: { select: { id: true, text: true, type: true, options: true } },
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
                  question: { select: { id: true, text: true, type: true, options: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          }),
        ])
      : [[], []]

    const { byPlayerDay, latestByPlayerDay } = indexResponsesByPlayerDay(history, {
      questionMappings,
    }, timezone)

    mergeBodyMapsIntoDays({ latestByPlayerDay, bodyRows: todayBodyMaps, timezone })

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

    const focusQuestions = survey ? await prisma.question.findMany({ where: { surveyId: survey.id, type: 'PVT' }, select: { id: true, text: true }, orderBy: { order: 'asc' } }) : []
    let focusAvailable = true
    let focusSessions: PvtSessionRow[] = []
    try {
      if (survey && focusQuestions.length) {
        const firstFocusDay = new Date(selectedDate + 'T12:00:00Z')
        firstFocusDay.setUTCDate(firstFocusDay.getUTCDate() - 28)
        focusSessions = await prisma.pvtSession.findMany({
          where: { teamId, surveyId: survey.id, localDate: { gte: firstFocusDay.toISOString().slice(0, 10), lte: selectedDate } },
          select: {
            id: true, responseId: true, questionId: true, playerId: true, surveyId: true,
            localDate: true, startedAt: true, finishedAt: true, durationSeconds: true,
            protocolVersion: true, practice: true, status: true, deviceId: true, userAgent: true,
            context: true, summary: true, player: { select: { firstName: true, lastName: true } },
          },
          orderBy: { startedAt: 'asc' }, take: 10000,
        }).then(rows => JSON.parse(JSON.stringify(rows)))
      }
    } catch { focusAvailable = false /* Optional module must never prevent loading wellness. */ }
    const focusTimezone = surveys.find(s => s.id === survey?.id)?.timezone || 'Europe/Belgrade'
    const sessionsById = new Map(focusSessions.map(s => [s.id, s]))
    const withFocus = playersWithDerived.map(player => {
      const today = focusSessions.filter(s => s.playerId === player.id && s.localDate === selectedDate && !s.practice)
      const attempts = today.filter(s => s.status === 'COMPLETED')
      const response = history.find(r => r.playerId === player.id && localDay(r.submittedAt, focusTimezone) === selectedDate)
      // Show the exact submitted result, matching the main CSV. Unsubmitted tests stay visible.
      const submitted = response?.answers.flatMap(answer => {
        const receipt = parsePvtAnswer(answer.value)
        const s = receipt ? sessionsById.get(receipt.attemptId) : undefined
        return s && s.responseId === response.id && s.questionId === answer.questionId && s.playerId === player.id && !s.practice && s.status === 'COMPLETED' ? [s] : []
      })[0]
      const current = submitted || attempts[0]
      const base = current ? baselineFor(current, focusSessions) : null
      const restingHr=response?.answers.flatMap(answer=>{if(!isRhrQuestion(answer.question))return [];const r=parseRhrAnswer(answer.value);return r?[{questionId:answer.questionId,label:answer.question.text,bpm:r.bpm,position:r.position,measuredAt:r.measuredAt}]:[]})||[]
      return { ...player, restingHr, focusState: current ? 'COMPLETED' : today.at(-1)?.status || 'PENDING', focus: current ? {
        attemptId: current.id, localDate: current.localDate, surveyId: current.surveyId, questionId: current.questionId,
        medianRT: current.summary?.medianRT ?? null, quality: current.summary?.quality || 'REVIEW',
        duration: current.durationSeconds, deltaPercent: base?.deltaPercent ?? null, baselineDays: base?.days ?? 0,
        count: attempts.length, linked: Boolean(submitted), posture: current.context.posture,
        minutesAwake: current.context.minutesAwake, caffeine: current.context.caffeine, flags: current.summary?.flags || [],
      } : null }
    })

    const rhrAvailable = !!survey && (await prisma.question.findMany({where:{surveyId:survey.id,type:'NUMBER'},select:{type:true,options:true}})).some(isRhrQuestion)
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
        focusQuestions,
        focusAvailable,
        rhrAvailable,
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
