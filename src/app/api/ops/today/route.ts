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

function todayWindow() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

function dayKey(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
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
    } else if (surveys.length === 1) {
      const only = surveys[0]
      survey = { id: only.id, title: only.title, isActive: only.isActive }
    } else {
      const active = surveys.filter((s) => s.isActive)
      const pick = active[0] ?? surveys[0] ?? null
      if (pick) {
        survey = { id: pick.id, title: pick.title, isActive: pick.isActive }
      }
    }

    const { today, tomorrow } = todayWindow()
    const historyStart = new Date(today)
    historyStart.setDate(historyStart.getDate() - 14)

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

    const history =
      survey
        ? await prisma.response.findMany({
            where: {
              surveyId: survey.id,
              survey: { teamId },
              submittedAt: { gte: historyStart, lt: tomorrow },
              playerId: { not: null },
            },
            select: {
              id: true,
              playerId: true,
              submittedAt: true,
              answers: {
                select: {
                  value: true,
                  question: { select: { text: true, type: true } },
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
          })
        : []

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
        if (r.submittedAt >= today && r.submittedAt < tomorrow && !latestToday.has(r.playerId)) {
          latestToday.set(r.playerId, { submittedAt: r.submittedAt, metrics })
        }
      }
    }

    const todayKey = dayKey(today)
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
