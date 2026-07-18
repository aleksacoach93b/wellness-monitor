/**
 * Shared Live Ops day-building helpers (table metrics, no route coupling).
 */

import {
  averageFromDays,
  buildPlayerWellness,
  buildTeamWellnessSummary,
  parseDayMetrics,
  type ParseDayMetricsOptions,
  type PlayerWellness,
} from '@/lib/opsWellness'

export type OpsAnswer = {
  value: string
  questionId?: string
  question: { id?: string; text: string; type: string }
}

export type OpsResponseRow = {
  playerId: string | null
  submittedAt: Date
  answers: OpsAnswer[]
}

export type OpsPlayerBase = {
  id: string
  firstName: string
  lastName: string
  image: string | null
}

export type OpsDayPlayers = Array<{
  id: string
  firstName: string
  lastName: string
  image: string | null
  status: 'done' | 'pending'
  submittedAt: string | null
  rank: number | null
  wellness: PlayerWellness | null
}>

export function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function pickDefaultSurvey(
  surveys: Array<{ id: string; title: string; isActive: boolean }>,
): { id: string; title: string; isActive: boolean } | null {
  if (!surveys.length) return null
  const isWellness = (title: string) => {
    const t = title.toLowerCase()
    return t.includes('wellness') && !t.includes('rpe')
  }
  return (
    surveys.find((s) => s.isActive && isWellness(s.title)) ??
    surveys.find((s) => isWellness(s.title)) ??
    surveys.find((s) => s.isActive) ??
    surveys[0] ??
    null
  )
}

export function sortSurveysForOps<T extends { title: string }>(surveys: T[]): T[] {
  return [...surveys].sort((a, b) => {
    const score = (title: string) => {
      const t = title.toLowerCase()
      if (t.includes('wellness') && !t.includes('rpe')) return 0
      if (t.includes('rpe')) return 2
      return 1
    }
    return score(a.title) - score(b.title) || a.title.localeCompare(b.title)
  })
}

/** playerId -> dayKey -> latest metrics that day */
export function indexResponsesByPlayerDay(
  rows: OpsResponseRow[],
  parseOpts?: ParseDayMetricsOptions,
) {
  const byPlayerDay = new Map<string, Map<string, ReturnType<typeof parseDayMetrics>>>()
  const latestByPlayerDay = new Map<
    string,
    Map<string, { submittedAt: Date; metrics: ReturnType<typeof parseDayMetrics> }>
  >()

  // newest-first preferred
  const ordered = [...rows].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
  )

  for (const r of ordered) {
    if (!r.playerId) continue
    const key = dayKey(r.submittedAt)
    let dayMap = byPlayerDay.get(r.playerId)
    if (!dayMap) {
      dayMap = new Map()
      byPlayerDay.set(r.playerId, dayMap)
    }
    let latestMap = latestByPlayerDay.get(r.playerId)
    if (!latestMap) {
      latestMap = new Map()
      latestByPlayerDay.set(r.playerId, latestMap)
    }
    if (!dayMap.has(key)) {
      const metrics = parseDayMetrics(r.answers, parseOpts)
      dayMap.set(key, metrics)
      latestMap.set(key, { submittedAt: r.submittedAt, metrics })
    }
  }

  return { byPlayerDay, latestByPlayerDay }
}

export function mergeBodyMapsIntoDay(args: {
  latestToday: Map<string, { submittedAt: Date; metrics: ReturnType<typeof parseDayMetrics> }>
  bodyRows: OpsResponseRow[]
}) {
  const bodyMerged = new Set<string>()
  const ordered = [...args.bodyRows].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
  )
  for (const r of ordered) {
    if (!r.playerId || !r.answers.length || bodyMerged.has(r.playerId)) continue
    const hit = args.latestToday.get(r.playerId)
    if (!hit) continue
    const maps = parseDayMetrics(r.answers)
    hit.metrics.painAreas = maps.painAreas
    hit.metrics.sorenessAreas = maps.sorenessAreas
    bodyMerged.add(r.playerId)
  }
}

export function buildOpsDayPayload(args: {
  players: OpsPlayerBase[]
  byPlayerDay: Map<string, Map<string, ReturnType<typeof parseDayMetrics>>>
  latestByPlayerDay: Map<
    string,
    Map<string, { submittedAt: Date; metrics: ReturnType<typeof parseDayMetrics> }>
  >
  selectedDate: string
}) {
  const { players, byPlayerDay, latestByPlayerDay, selectedDate } = args
  const latestToday = new Map<
    string,
    { submittedAt: Date; metrics: ReturnType<typeof parseDayMetrics> }
  >()
  for (const [playerId, dayMap] of latestByPlayerDay) {
    const hit = dayMap.get(selectedDate)
    if (hit) latestToday.set(playerId, hit)
  }

  const teamFatigue: number[] = []
  const teamSoreness: number[] = []
  const teamSleep: number[] = []
  const teamMood: number[] = []
  const teamStress: number[] = []
  for (const hit of latestToday.values()) {
    if (hit.metrics.fatigue != null) teamFatigue.push(hit.metrics.fatigue)
    if (hit.metrics.soreness != null) teamSoreness.push(hit.metrics.soreness)
    if (hit.metrics.sleepQuality != null) teamSleep.push(hit.metrics.sleepQuality)
    if (hit.metrics.mood != null) teamMood.push(hit.metrics.mood)
    if (hit.metrics.stress != null) teamStress.push(hit.metrics.stress)
  }

  const playerRows = players.map((p) => {
    const hit = latestToday.get(p.id)
    const dayMap = byPlayerDay.get(p.id)
    let wellness: PlayerWellness | null = null

    if (hit) {
      const prevKeys = dayMap
        ? [...dayMap.keys()].filter((k) => k < selectedDate).sort()
        : []
      const prevKey = prevKeys.length ? prevKeys[prevKeys.length - 1] : null
      const prevMetrics = prevKey && dayMap ? dayMap.get(prevKey) : null
      const last3 = prevKeys.slice(-3).map((k) => dayMap!.get(k)!)

      wellness = buildPlayerWellness({
        today: hit.metrics,
        prevFatigue: prevMetrics?.fatigue ?? null,
        avg3: {
          fatigue: averageFromDays(last3.map((m) => m.fatigue)),
          soreness: averageFromDays(last3.map((m) => m.soreness)),
          sleepQuality: averageFromDays(last3.map((m) => m.sleepQuality)),
          mood: averageFromDays(last3.map((m) => m.mood)),
          stress: averageFromDays(last3.map((m) => m.stress)),
        },
        teamToday: {
          fatigue: teamFatigue,
          soreness: teamSoreness,
          sleepQuality: teamSleep,
          mood: teamMood,
          stress: teamStress,
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

  const ranked = [...playerRows]
    .filter((p) => p.wellness?.readiness != null)
    .sort((a, b) => (b.wellness!.readiness ?? 0) - (a.wellness!.readiness ?? 0))
  const rankById = new Map<string, number>()
  ranked.forEach((p, i) => rankById.set(p.id, i + 1))

  const playersWithRank: OpsDayPlayers = playerRows.map((p) => ({
    ...p,
    rank: rankById.get(p.id) ?? null,
  }))

  const done = playersWithRank.filter((p) => p.status === 'done').length
  const total = playersWithRank.length

  return {
    selectedDate,
    stats: { total, done, pending: total - done },
    wellnessSummary: buildTeamWellnessSummary(playersWithRank),
    players: playersWithRank,
  }
}
