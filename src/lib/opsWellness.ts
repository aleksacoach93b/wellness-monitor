/**
 * Live Ops Daily Wellness: parse survey answers into Power-BI-style card metrics.
 * Question matching is by text + type (no fixed question keys in schema).
 */

import {
  formatBodyMapWhenSummary,
  getBodyMapLocationLabel,
  getBodyMapRating,
  getBodyMapWhenLabels,
  parseBodyMapAnswerValue,
  type BodyMapAreaStored,
} from '@/lib/bodyMapPainLocation'
import { getMuscleName } from '@/lib/muscleNames'

export type WellnessMetricKey = 'fatigue' | 'soreness' | 'sleepQuality' | 'mood' | 'readiness'

export type BodyMapZoneDetail = {
  areaId: string
  muscle: string
  rating: number
  location: string | null
  when: string[]
  whenSummary: string | null
  side: 'front' | 'back'
}

export type BodyMapSummary = {
  zones: number
  max: number | null
  total: number | null
  topArea: string | null
  flagText: string
  flagColor: string
  hasData: boolean
  areas: Record<string, BodyMapAreaStored>
  details: BodyMapZoneDetail[]
}

export type MetricRow = {
  value: number | null
  z: number | null
  avg3: number | null
  delta3: number | null
  pct: number
  color: string
  markerPct: number | null
  delta3Color: string
}

export type PlayerWellness = {
  readiness: number | null
  readinessPct: number
  readinessLabel: string
  readinessHint: string
  readinessColor: string
  statusText: 'NO DATA' | 'ALERT' | 'WATCH' | 'READY'
  statusColor: string
  sleepBedtime: string | null
  sleepWake: string | null
  sleepDuration: string | null
  fatigue: MetricRow
  soreness: MetricRow
  sleepQuality: MetricRow
  mood: MetricRow
  prevFatigue: number | null
  fatigueDelta: number | null
  fatigueDeltaColor: string
  fatigueDeltaText: string
  pain: BodyMapSummary
  sorenessMap: BodyMapSummary
  risk: {
    fatigue: boolean
    soreness: boolean
    sleep: boolean
    pain: boolean
    sourceCount: number
    sourceText: string
  }
  flipMode: 'none' | 'pain' | 'soreness' | 'both'
}

export type TeamWellnessSummary = {
  teamReadinessPct: number | null
  teamReadinessColor: string
  alertCount: number
  watchCount: number
  readyCount: number
  fatigueUpCount: number
  teamFatigueDelta: number | null
  teamFatigueDeltaText: string
  teamFatigueDeltaColor: string
}

type AnswerLike = {
  value: string
  question: { text: string; type: string }
}

type DayMetrics = {
  readiness: number | null
  fatigue: number | null
  soreness: number | null
  sleepQuality: number | null
  mood: number | null
  sleepBedtime: string | null
  sleepWake: string | null
  sleepDuration: string | null
  painAreas: Record<string, BodyMapAreaStored>
  sorenessAreas: Record<string, BodyMapAreaStored>
}

function norm(text: string) {
  return text.toLowerCase().trim()
}

function parseNumber(value: string): number | null {
  const n = Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return n
}

function isBodyMapYesNo(value: string) {
  const v = value.trim().toLowerCase()
  return v === 'yes' || v === 'no' || v === 'true' || v === 'false'
}

function matchMetric(text: string): WellnessMetricKey | null {
  const t = norm(text)
  if (t.includes('readiness') || t.includes('how ready')) return 'readiness'
  if (t.includes('fatig')) return 'fatigue'
  if (
    (t.includes('soreness') || t.includes('sore')) &&
    !t.includes('area') &&
    !t.includes('body') &&
    !t.includes('map') &&
    !t.includes('painful')
  ) {
    return 'soreness'
  }
  if (t.includes('sleep quality') || (t.includes('sleep') && t.includes('rate'))) {
    return 'sleepQuality'
  }
  if (t.includes('mood')) return 'mood'
  return null
}

function matchSleepField(text: string): 'bed' | 'wake' | 'duration' | null {
  const t = norm(text)
  if (t.includes('go to sleep') || t.includes('bedtime') || t.includes('fall asleep')) return 'bed'
  if (t.includes('wake')) return 'wake'
  if (t.includes('sleep duration') || (t.includes('sleep') && t.includes('hour'))) return 'duration'
  if (t.includes('duration') && t.includes('sleep')) return 'duration'
  return null
}

function matchBodyMapKind(text: string): 'pain' | 'soreness' | null {
  const t = norm(text)
  if (t.includes('painful') || (t.includes('pain') && !t.includes('soren'))) return 'pain'
  if (t.includes('sore')) return 'soreness'
  return null
}

function isFrontArea(areaId: string) {
  return areaId.startsWith('path-')
}

export function parseDayMetrics(answers: AnswerLike[]): DayMetrics {
  const out: DayMetrics = {
    readiness: null,
    fatigue: null,
    soreness: null,
    sleepQuality: null,
    mood: null,
    sleepBedtime: null,
    sleepWake: null,
    sleepDuration: null,
    painAreas: {},
    sorenessAreas: {},
  }

  for (const answer of answers) {
    const { text, type } = answer.question
    const value = answer.value

    if (type === 'BODY_MAP') {
      const kind = matchBodyMapKind(text)
      if (!kind) continue
      if (isBodyMapYesNo(value) || !value.includes('{')) continue
      try {
        const parsed = parseBodyMapAnswerValue(JSON.parse(value))
        if (kind === 'pain') out.painAreas = { ...out.painAreas, ...parsed }
        else out.sorenessAreas = { ...out.sorenessAreas, ...parsed }
      } catch {
        /* ignore bad JSON */
      }
      continue
    }

    const metric = matchMetric(text)
    if (metric && (type === 'SLIDER' || type === 'RATING_SCALE' || type === 'SCALE' || type === 'NUMBER' || type === 'RPE')) {
      const n = parseNumber(value)
      if (n != null) out[metric] = n
      continue
    }

    const sleepField = matchSleepField(text)
    if (sleepField === 'bed') {
      out.sleepBedtime = value || null
    } else if (sleepField === 'wake') {
      out.sleepWake = value || null
    } else if (sleepField === 'duration') {
      const raw = String(value || '').trim()
      if (!raw) out.sleepDuration = null
      else if (/h/i.test(raw)) out.sleepDuration = raw
      else out.sleepDuration = `${raw} h`
    }
  }

  // Derive readiness if missing: all 1–10 scales are higher-better
  if (out.readiness == null) {
    const parts: number[] = []
    if (out.sleepQuality != null) parts.push(out.sleepQuality)
    if (out.mood != null) parts.push(out.mood)
    if (out.fatigue != null) parts.push(out.fatigue)
    if (out.soreness != null) parts.push(out.soreness)
    if (parts.length >= 2) {
      out.readiness = parts.reduce((a, b) => a + b, 0) / parts.length
    }
  }

  return out
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function readinessColor(readiness: number | null) {
  if (readiness == null || readiness <= 0) return '#64748b'
  if (readiness < 3) return '#ef4444'
  if (readiness < 6) return '#f97316'
  if (readiness < 8) return '#facc15'
  return '#22c55e'
}

function readinessLabel(readiness: number | null) {
  if (readiness == null || readiness <= 0) return 'NO DATA'
  if (readiness < 3) return 'CRITICAL'
  if (readiness < 6) return 'LOW'
  if (readiness < 8) return 'WATCH'
  return 'HIGH'
}

function readinessHint(readiness: number | null) {
  if (readiness == null || readiness <= 0) return 'Missing wellness input'
  if (readiness < 3) return 'Reduce load attention'
  if (readiness < 6) return 'Monitor response'
  if (readiness < 8) return 'Manage training load'
  return 'Ready to train'
}

/** Wellness 1–10 scales: 1 = worst (red), 10 = best (green). */
function scaleColor(v: number | null) {
  if (v == null) return '#64748b'
  if (v < 3) return '#ef4444'
  if (v < 5) return '#f97316'
  if (v < 7) return '#facc15'
  if (v < 9) return '#84cc16'
  return '#22c55e'
}

function painFlag(max: number | null, zones: number) {
  if (max == null || zones === 0) return { text: 'NO PAIN', color: '#64748b' }
  if (max >= 7) return { text: 'HIGH PAIN', color: '#ef4444' }
  if (max >= 4) return { text: 'MODERATE PAIN', color: '#f97316' }
  return { text: 'LOW PAIN', color: '#facc15' }
}

function sorenessFlag(max: number | null, zones: number) {
  if (max == null || zones === 0) return { text: 'NO SORENESS', color: '#64748b' }
  if (max >= 7) return { text: 'HIGH SORENESS', color: '#fb7185' }
  if (max >= 4) return { text: 'MODERATE SORENESS', color: '#fbbf24' }
  return { text: 'LOW SORENESS', color: '#67e8f9' }
}

function summarizeBodyMap(
  areas: Record<string, BodyMapAreaStored>,
  kind: 'pain' | 'soreness',
): BodyMapSummary {
  const entries = Object.entries(areas)
  const ratings = entries.map(([, v]) => getBodyMapRating(v)).filter((r) => r > 0)
  const zones = ratings.length
  const max = zones ? Math.max(...ratings) : null
  const total = zones ? ratings.reduce((a, b) => a + b, 0) : null
  let topArea: string | null = null
  let topVal = -1
  for (const [areaId, stored] of entries) {
    const r = getBodyMapRating(stored)
    if (r > topVal) {
      topVal = r
      topArea = getMuscleName(areaId)
    }
  }
  const flag = kind === 'pain' ? painFlag(max, zones) : sorenessFlag(max, zones)
  const details: BodyMapZoneDetail[] = entries
    .map(([areaId, stored]) => {
      const rating = getBodyMapRating(stored)
      return {
        areaId,
        muscle: getMuscleName(areaId),
        rating,
        location: getBodyMapLocationLabel(stored),
        when: getBodyMapWhenLabels(stored),
        whenSummary: formatBodyMapWhenSummary(stored, 3),
        side: (isFrontArea(areaId) ? 'front' : 'back') as 'front' | 'back',
      }
    })
    .filter((d) => d.rating > 0)
    .sort((a, b) => b.rating - a.rating || a.muscle.localeCompare(b.muscle))

  return {
    zones,
    max,
    total,
    topArea: zones ? topArea : null,
    flagText: flag.text,
    flagColor: flag.color,
    hasData: zones > 0,
    areas,
    details,
  }
}

function mean(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stdev(values: number[]) {
  if (values.length < 2) return null
  const m = mean(values)!
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(v)
}

function zScore(value: number | null, population: number[]) {
  if (value == null) return null
  const m = mean(population)
  const s = stdev(population)
  if (m == null || s == null || s < 1e-6) return 0
  return (value - m) / s
}

function metricRow(
  value: number | null,
  avg3: number | null,
  z: number | null,
): MetricRow {
  const scoreForBar = value == null ? 0 : Math.max(0, value)
  const pct = Math.round(clamp(scoreForBar * 10, 0, 100))
  const markerPct =
    avg3 == null ? null : Math.round(clamp(Math.max(0, avg3) * 10, 0, 100))
  const delta3 = value != null && avg3 != null ? value - avg3 : null
  let delta3Color = '#94a3b8'
  if (delta3 != null) {
    // Higher score is better → rising delta is good
    if (delta3 >= 0.5) delta3Color = '#22c55e'
    else if (delta3 > -0.5) delta3Color = '#cbd5e1'
    else if (delta3 > -1.5) delta3Color = '#f97316'
    else delta3Color = '#ef4444'
  }
  return {
    value,
    z,
    avg3,
    delta3,
    pct,
    color: scaleColor(value),
    markerPct,
    delta3Color,
  }
}

export function buildPlayerWellness(args: {
  today: DayMetrics
  prevFatigue: number | null
  avg3: {
    fatigue: number | null
    soreness: number | null
    sleepQuality: number | null
    mood: number | null
  }
  teamToday: {
    fatigue: number[]
    soreness: number[]
    sleepQuality: number[]
    mood: number[]
  }
}): PlayerWellness {
  const { today, prevFatigue, avg3, teamToday } = args
  const readiness = today.readiness
  const readinessPct = readiness == null ? 0 : Math.round(clamp(readiness * 10, 0, 100))
  const readinessCol = readinessColor(readiness)

  const fatigueZ = zScore(today.fatigue, teamToday.fatigue)
  const sorenessZ = zScore(today.soreness, teamToday.soreness)
  const sleepZ = zScore(today.sleepQuality, teamToday.sleepQuality)
  const moodZ = zScore(today.mood, teamToday.mood)

  // Low scores are risky on 1–10 higher-better scales
  const fatigueRiskZ = Math.max(0, -(fatigueZ ?? 0))
  const sorenessRiskZ = Math.max(0, -(sorenessZ ?? 0))
  const sleepRiskZ = Math.max(0, -(sleepZ ?? 0))
  const moodRiskZ = Math.max(0, -(moodZ ?? 0))
  const riskLoad = fatigueRiskZ + sorenessRiskZ + sleepRiskZ + moodRiskZ

  const pain = summarizeBodyMap(today.painAreas, 'pain')
  const sorenessMap = summarizeBodyMap(today.sorenessAreas, 'soreness')

  let statusText: PlayerWellness['statusText'] = 'NO DATA'
  if (readiness != null && readiness > 0) {
    if (readiness < 6 || riskLoad >= 4) statusText = 'ALERT'
    else if (readiness < 8 || riskLoad >= 2) statusText = 'WATCH'
    else statusText = 'READY'
  }

  const statusColor =
    statusText === 'ALERT'
      ? '#ef4444'
      : statusText === 'WATCH'
        ? '#facc15'
        : statusText === 'READY'
          ? '#22c55e'
          : '#64748b'

  const fatigueDelta =
    today.fatigue != null && prevFatigue != null ? today.fatigue - prevFatigue : null
  let fatigueDeltaColor = '#94a3b8'
  if (fatigueDelta != null) {
    // Rising score = better recovery feel
    if (fatigueDelta >= 0.5) fatigueDeltaColor = '#22c55e'
    else if (fatigueDelta > -0.5) fatigueDeltaColor = '#facc15'
    else if (fatigueDelta > -1.5) fatigueDeltaColor = '#f97316'
    else fatigueDeltaColor = '#ef4444'
  }

  const fatigueRisk = (today.fatigue != null && today.fatigue < 6) || (fatigueZ ?? 0) <= -1
  const sorenessRisk = (today.soreness != null && today.soreness < 6) || (sorenessZ ?? 0) <= -1
  const sleepRisk = (today.sleepQuality != null && today.sleepQuality < 6) || (sleepZ ?? 0) <= -1
  const painRisk = pain.hasData
  const sourceCount =
    Number(fatigueRisk) + Number(sorenessRisk) + Number(sleepRisk) + Number(painRisk)

  const flipMode: PlayerWellness['flipMode'] =
    pain.hasData && sorenessMap.hasData
      ? 'both'
      : pain.hasData
        ? 'pain'
        : sorenessMap.hasData
          ? 'soreness'
          : 'none'

  return {
    readiness,
    readinessPct,
    readinessLabel: readinessLabel(readiness),
    readinessHint: readinessHint(readiness),
    readinessColor: readinessCol,
    statusText,
    statusColor,
    sleepBedtime: today.sleepBedtime,
    sleepWake: today.sleepWake,
    sleepDuration: today.sleepDuration,
    fatigue: metricRow(today.fatigue, avg3.fatigue, fatigueZ),
    soreness: metricRow(today.soreness, avg3.soreness, sorenessZ),
    sleepQuality: metricRow(today.sleepQuality, avg3.sleepQuality, sleepZ),
    mood: metricRow(today.mood, avg3.mood, moodZ),
    prevFatigue,
    fatigueDelta,
    fatigueDeltaColor,
    fatigueDeltaText:
      fatigueDelta == null
        ? 'N/A'
        : `${fatigueDelta >= 0 ? '+' : ''}${fatigueDelta.toFixed(1)}`,
    pain,
    sorenessMap,
    risk: {
      fatigue: fatigueRisk,
      soreness: sorenessRisk,
      sleep: sleepRisk,
      pain: painRisk,
      sourceCount,
      sourceText: sourceCount === 0 ? 'NO ACTIVE SOURCE' : `${sourceCount} ACTIVE`,
    },
    flipMode,
  }
}

export function buildTeamWellnessSummary(
  players: Array<{ wellness: PlayerWellness | null }>,
): TeamWellnessSummary {
  const withData = players.map((p) => p.wellness).filter((w): w is PlayerWellness => !!w)
  const readinessVals = withData
    .map((w) => w.readiness)
    .filter((v): v is number => v != null && v > 0)
  const teamReadiness = mean(readinessVals)
  const teamReadinessPct = teamReadiness == null ? null : Math.round(clamp(teamReadiness * 10, 0, 100))

  let alertCount = 0
  let watchCount = 0
  let readyCount = 0
  let fatigueUpCount = 0
  const deltas: number[] = []

  for (const w of withData) {
    if (w.statusText === 'ALERT' || (w.readiness != null && w.readiness > 0 && w.readiness < 6)) {
      alertCount += 1
    } else if (w.statusText === 'WATCH' || (w.readiness != null && w.readiness >= 6 && w.readiness < 8)) {
      watchCount += 1
    } else if (w.statusText === 'READY' || (w.readiness != null && w.readiness >= 8)) {
      readyCount += 1
    }
    // Count worsening (score drop) — 1–10 higher-better
    if (w.fatigueDelta != null && w.fatigueDelta <= -0.5) fatigueUpCount += 1
    if (w.fatigueDelta != null) deltas.push(w.fatigueDelta)
  }

  // Prefer readiness-band counts like Power BI
  alertCount = withData.filter((w) => w.readiness != null && w.readiness > 0 && w.readiness < 6).length
  watchCount = withData.filter((w) => w.readiness != null && w.readiness >= 6 && w.readiness < 8).length
  readyCount = withData.filter((w) => w.readiness != null && w.readiness >= 8).length

  const teamFatigueDelta = mean(deltas)
  let teamFatigueDeltaColor = '#94a3b8'
  if (teamFatigueDelta != null) {
    if (teamFatigueDelta >= 0.4) teamFatigueDeltaColor = '#22c55e'
    else if (teamFatigueDelta > -0.4) teamFatigueDeltaColor = '#facc15'
    else if (teamFatigueDelta > -1.0) teamFatigueDeltaColor = '#f97316'
    else teamFatigueDeltaColor = '#ef4444'
  }

  return {
    teamReadinessPct,
    teamReadinessColor: readinessColor(teamReadiness),
    alertCount,
    watchCount,
    readyCount,
    fatigueUpCount,
    teamFatigueDelta,
    teamFatigueDeltaText:
      teamFatigueDelta == null
        ? 'N/A'
        : `${teamFatigueDelta >= 0 ? '+' : ''}${teamFatigueDelta.toFixed(1)}`,
    teamFatigueDeltaColor,
  }
}

export function averageFromDays(values: Array<number | null | undefined>) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  return mean(nums)
}
