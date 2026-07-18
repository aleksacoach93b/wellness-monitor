import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSessionFromRequest } from '@/lib/auth/adminSession'
import {
  averageFromDays,
  buildPlayerWellness,
  buildTeamWellnessSummary,
  parseDayMetrics,
  type PlayerWellness,
} from '@/lib/opsWellness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

/** Prefer "Wellness" surveys over RPE / others when no surveyId is provided. */
function pickDefaultSurvey(
  surveys: Array<{ id: string; title: string; isActive: boolean }>,
): { id: string; title: string; isActive: boolean } | null {
  if (!surveys.length) return null
  const isWellness = (title: string) => {
    const t = title.toLowerCase()
    return t.includes('wellness') && !t.includes('rpe')
  }
  const wellnessActive = surveys.find((s) => s.isActive && isWellness(s.title))
  if (wellnessActive) return wellnessActive
  const wellnessAny = surveys.find((s) => isWellness(s.title))
  if (wellnessAny) return wellnessAny
  const active = surveys.find((s) => s.isActive)
  return active ?? surveys[0] ?? null
}

/**
 * Live Ops: today's check-in + Daily Wellness card payload for the session's team only.
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
    // Only need prev day + last-3 averages — keep the window tight for speed.
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

    // History without BODY_MAP payloads (huge JSON) — metrics only.
    // Selected-day BODY_MAP answers are loaded in a second narrow query.
    const [history, todayBodyMaps] =
      survey
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

    /** playerId -> dayKey -> latest metrics that day */
    const byPlayerDay = new Map<string, Map<string, ReturnType<typeof parseDayMetrics>>>()
    const latestToday = new Map<string, { submittedAt: Date; metrics: ReturnType<typeof parseDayMetrics> }>()

    for (const r of history) {
      if (!r.playerId) continue
      const key = dayKey(r.submittedAt)
      let dayMap = byPlayerDay.get(r.playerId)
      if (!dayMap) {
        dayMap = new Map()
        byPlayerDay.set(r.playerId, dayMap)
      }
      // history is newest-first; keep first per day
      if (!dayMap.has(key)) {
        const metrics = parseDayMetrics(r.answers)
        dayMap.set(key, metrics)
        if (r.submittedAt >= dayStart && r.submittedAt < dayEnd && !latestToday.has(r.playerId)) {
          latestToday.set(r.playerId, { submittedAt: r.submittedAt, metrics })
        }
      }
    }

    // Merge selected-day body maps (newest response that has map data per player).
    const bodyMerged = new Set<string>()
    for (const r of todayBodyMaps) {
      if (!r.playerId || !r.answers.length || bodyMerged.has(r.playerId)) continue
      const hit = latestToday.get(r.playerId)
      if (!hit) continue
      const maps = parseDayMetrics(r.answers)
      hit.metrics.painAreas = maps.painAreas
      hit.metrics.sorenessAreas = maps.sorenessAreas
      bodyMerged.add(r.playerId)
    }

    const todayKey = selectedDate
    const teamFatigue: number[] = []
    const teamSoreness: number[] = []
    const teamSleep: number[] = []
    const teamMood: number[] = []

    for (const hit of latestToday.values()) {
      if (hit.metrics.fatigue != null) teamFatigue.push(hit.metrics.fatigue)
      if (hit.metrics.soreness != null) teamSoreness.push(hit.metrics.soreness)
      if (hit.metrics.sleepQuality != null) teamSleep.push(hit.metrics.sleepQuality)
      if (hit.metrics.mood != null) teamMood.push(hit.metrics.mood)
    }

    const playerRows = players.map((p) => {
      const hit = latestToday.get(p.id)
      const dayMap = byPlayerDay.get(p.id)
      let wellness: PlayerWellness | null = null

      if (hit) {
        const prevKeys = dayMap
          ? [...dayMap.keys()].filter((k) => k < todayKey).sort()
          : []
        const prevKey = prevKeys.length ? prevKeys[prevKeys.length - 1] : null
        const prevMetrics = prevKey && dayMap ? dayMap.get(prevKey) : null

        const last3Keys = prevKeys.slice(-3)
        const last3 = last3Keys.map((k) => dayMap!.get(k)!)

        wellness = buildPlayerWellness({
          today: hit.metrics,
          prevFatigue: prevMetrics?.fatigue ?? null,
          avg3: {
            fatigue: averageFromDays(last3.map((m) => m.fatigue)),
            soreness: averageFromDays(last3.map((m) => m.soreness)),
            sleepQuality: averageFromDays(last3.map((m) => m.sleepQuality)),
            mood: averageFromDays(last3.map((m) => m.mood)),
          },
          teamToday: {
            fatigue: teamFatigue,
            soreness: teamSoreness,
            sleepQuality: teamSleep,
            mood: teamMood,
          },
        })
      }

      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        image: p.image,
        status: hit ? ('done' as const) : ('pending' as const),
        submittedAt: hit ? hit.submittedAt.toISOString() : null,
        wellness,
      }
    })

    // Rank by readiness among done players
    const ranked = [...playerRows]
      .filter((p) => p.wellness?.readiness != null)
      .sort((a, b) => (b.wellness!.readiness ?? 0) - (a.wellness!.readiness ?? 0))
    const rankById = new Map<string, number>()
    ranked.forEach((p, i) => rankById.set(p.id, i + 1))

    const playersWithRank = playerRows.map((p) => ({
      ...p,
      rank: rankById.get(p.id) ?? null,
    }))

    const done = playersWithRank.filter((p) => p.status === 'done').length
    const total = playersWithRank.length
    const wellnessSummary = buildTeamWellnessSummary(playersWithRank)

    return NextResponse.json(
      {
        team,
        survey,
        surveys: surveys.map((s) => ({
          id: s.id,
          title: s.title,
          isActive: s.isActive,
        })),
        generatedAt: new Date().toISOString(),
        selectedDate,
        stats: {
          total,
          done,
          pending: total - done,
        },
        wellnessSummary,
        players: playersWithRank,
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
