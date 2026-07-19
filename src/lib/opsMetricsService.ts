import { prisma } from '@/lib/prisma'
import { ensureOpsSchema } from '@/lib/opsSchemaEnsure'
import { getBodyMapRating } from '@/lib/bodyMapPainLocation'
import {
  computeDerivedForPlayer,
  isOpsBaseVariable,
  isOpsMetricKind,
  slugifyMetricKey,
  type DaySeriesPoint,
  type DerivedCell,
  type FormatRule,
  type OpsBaseVariable,
  type OpsMetricConfig,
  type OpsMetricDTO,
  type OpsMetricKind,
} from '@/lib/opsMetrics'
import type { OpsRuleOperator } from '@/lib/opsRules'
import { isOpsRuleOperator } from '@/lib/opsRules'

function mapFormatting(raw: unknown): FormatRule[] {
  if (!Array.isArray(raw)) return []
  const out: FormatRule[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const operator = (row as { operator?: unknown }).operator
    const threshold = Number((row as { threshold?: unknown }).threshold)
    const color = (row as { color?: unknown }).color
    if (!isOpsRuleOperator(operator)) continue
    if (!Number.isFinite(threshold)) continue
    if (typeof color !== 'string' || !color.trim()) continue
    out.push({
      operator: operator as OpsRuleOperator,
      threshold,
      color: color.trim(),
    })
  }
  return out
}

function mapConfig(raw: unknown): OpsMetricConfig {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const config: OpsMetricConfig = {}
  if (typeof o.expression === 'string') config.expression = o.expression
  if (isOpsBaseVariable(o.source)) config.source = o.source
  if (typeof o.alpha === 'number' && Number.isFinite(o.alpha)) config.alpha = o.alpha
  if (typeof o.windowDays === 'number' && Number.isFinite(o.windowDays)) {
    config.windowDays = o.windowDays
  }
  if (typeof o.acuteDays === 'number' && Number.isFinite(o.acuteDays)) {
    config.acuteDays = o.acuteDays
  }
  if (typeof o.chronicDays === 'number' && Number.isFinite(o.chronicDays)) {
    config.chronicDays = o.chronicDays
  }
  if (typeof o.spikePct === 'number' && Number.isFinite(o.spikePct)) {
    config.spikePct = o.spikePct
  }
  if (o.weights && typeof o.weights === 'object') {
    const weights: Partial<Record<OpsBaseVariable, number>> = {}
    for (const [k, v] of Object.entries(o.weights as Record<string, unknown>)) {
      if (!isOpsBaseVariable(k)) continue
      const n = Number(v)
      if (!Number.isFinite(n)) continue
      weights[k] = n
    }
    config.weights = weights
  }
  return config
}

function mapMetric(row: {
  id: string
  teamId: string
  surveyId: string | null
  name: string
  key: string
  kind: string
  config: unknown
  formatting: unknown
  showInTable: boolean
  enabled: boolean
  sortOrder: number
}): OpsMetricDTO | null {
  if (!isOpsMetricKind(row.kind)) return null
  return {
    id: row.id,
    teamId: row.teamId,
    surveyId: row.surveyId,
    name: row.name,
    key: row.key,
    kind: row.kind,
    config: mapConfig(row.config),
    formatting: mapFormatting(row.formatting),
    showInTable: row.showInTable,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  }
}

export async function listOpsMetrics(teamId: string): Promise<OpsMetricDTO[]> {
  try {
    await ensureOpsSchema()
    const rows = await prisma.opsMetric.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(mapMetric).filter((m): m is OpsMetricDTO => !!m)
  } catch (error) {
    console.error('listOpsMetrics failed:', error)
    return []
  }
}

export async function createOpsMetric(args: {
  teamId: string
  name: string
  kind: OpsMetricKind
  config: OpsMetricConfig
  formatting?: FormatRule[]
  showInTable?: boolean
  enabled?: boolean
  surveyId?: string | null
  key?: string
}): Promise<OpsMetricDTO> {
  await ensureOpsSchema()
  const count = await prisma.opsMetric.count({ where: { teamId: args.teamId } })
  let key = slugifyMetricKey(args.key || args.name)
  const existing = await prisma.opsMetric.findUnique({
    where: { teamId_key: { teamId: args.teamId, key } },
    select: { id: true },
  })
  if (existing) key = `${key}_${Date.now().toString(36).slice(-4)}`

  const row = await prisma.opsMetric.create({
    data: {
      teamId: args.teamId,
      surveyId: args.surveyId ?? null,
      name: args.name.trim() || 'Custom metric',
      key,
      kind: args.kind,
      config: args.config as object,
      formatting: (args.formatting ?? []) as object[],
      showInTable: args.showInTable ?? true,
      enabled: args.enabled ?? true,
      sortOrder: count,
    },
  })
  const mapped = mapMetric(row)
  if (!mapped) throw new Error('Invalid metric created')
  return mapped
}

export async function updateOpsMetric(args: {
  teamId: string
  id: string
  patch: Partial<{
    name: string
    kind: OpsMetricKind
    config: OpsMetricConfig
    formatting: FormatRule[]
    showInTable: boolean
    enabled: boolean
    surveyId: string | null
  }>
}): Promise<OpsMetricDTO | null> {
  await ensureOpsSchema()
  const owned = await prisma.opsMetric.findFirst({
    where: { id: args.id, teamId: args.teamId },
    select: { id: true },
  })
  if (!owned) return null
  const row = await prisma.opsMetric.update({
    where: { id: args.id },
    data: {
      ...(args.patch.name != null ? { name: args.patch.name.trim() || 'Custom metric' } : {}),
      ...(args.patch.kind != null ? { kind: args.patch.kind } : {}),
      ...(args.patch.config != null ? { config: args.patch.config as object } : {}),
      ...(args.patch.formatting != null
        ? { formatting: args.patch.formatting as object[] }
        : {}),
      ...(args.patch.showInTable != null ? { showInTable: args.patch.showInTable } : {}),
      ...(args.patch.enabled != null ? { enabled: args.patch.enabled } : {}),
      ...(args.patch.surveyId !== undefined ? { surveyId: args.patch.surveyId } : {}),
    },
  })
  return mapMetric(row)
}

export async function deleteOpsMetric(teamId: string, id: string): Promise<boolean> {
  await ensureOpsSchema()
  const owned = await prisma.opsMetric.findFirst({
    where: { id, teamId },
    select: { id: true },
  })
  if (!owned) return false
  await prisma.opsMetric.delete({ where: { id } })
  return true
}

type DayMetricsLike = {
  fatigue?: number | null
  soreness?: number | null
  sleepQuality?: number | null
  mood?: number | null
  stress?: number | null
  readiness?: number | null
  sleepDuration?: string | null
  painAreas?: Record<string, unknown>
}

function painMaxFromAreas(areas: Record<string, unknown> | undefined): number | null {
  if (!areas) return null
  const ratings = Object.values(areas)
    .map((v) => getBodyMapRating(v as never))
    .filter((r) => r > 0)
  return ratings.length ? Math.max(...ratings) : null
}

/** Rough sleep-risk proxy from duration text when wellness object is unavailable. */
function sleepRiskFromDuration(text: string | null | undefined): number | null {
  if (!text) return null
  const hm = text.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i)
  if (!hm) return null
  const hours = Number(hm[1]) + Number(hm[2] ?? 0) / 60
  if (!Number.isFinite(hours)) return null
  return hours < 7 ? 1 : 0
}

function varsFromDayMetrics(
  m: DayMetricsLike | null | undefined,
  wellness?: {
    readiness?: number | null
    risk?: { sleep?: boolean }
    pain?: { max?: number | null; hasData?: boolean }
  } | null,
): Partial<Record<OpsBaseVariable, number | null>> {
  const painMax =
    wellness?.pain?.hasData
      ? (wellness.pain.max ?? null)
      : painMaxFromAreas(m?.painAreas)

  return {
    fatigue: m?.fatigue ?? null,
    soreness: m?.soreness ?? null,
    sleepQuality: m?.sleepQuality ?? null,
    mood: m?.mood ?? null,
    stress: m?.stress ?? null,
    readiness: wellness?.readiness ?? m?.readiness ?? null,
    sleepRisk:
      wellness?.risk?.sleep != null
        ? wellness.risk.sleep
          ? 1
          : 0
        : sleepRiskFromDuration(m?.sleepDuration),
    painMax,
  }
}

type PlayerWithWellness = {
  id: string
  wellness: {
    readiness: number | null
    fatigue: { value: number | null }
    soreness: { value: number | null }
    sleepQuality: { value: number | null }
    mood: { value: number | null }
    stress: { value: number | null }
    risk: { sleep: boolean }
    pain: { max: number | null; hasData: boolean }
  } | null
}

/**
 * Attach derived metric cells onto each player for the selected day.
 */
export function attachDerivedMetrics<T extends PlayerWithWellness>(args: {
  metrics: OpsMetricDTO[]
  surveyId: string | null
  selectedDate: string
  players: T[]
  byPlayerDay: Map<string, Map<string, DayMetricsLike>>
}): Array<T & { derived: DerivedCell[] }> {
  const active = args.metrics.filter(
    (m) =>
      m.enabled &&
      (!m.surveyId || !args.surveyId || m.surveyId === args.surveyId),
  )

  return args.players.map((player) => {
    const dayMap = args.byPlayerDay.get(player.id)
    const series: DaySeriesPoint[] = []
    if (dayMap) {
      for (const [date, metrics] of [...dayMap.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        series.push({
          date,
          values: varsFromDayMetrics(metrics),
        })
      }
    }

    const today = varsFromDayMetrics(
      dayMap?.get(args.selectedDate) ?? null,
      player.wellness,
    )
    // Prefer live wellness object for today's core vars.
    if (player.wellness) {
      today.fatigue = player.wellness.fatigue.value
      today.soreness = player.wellness.soreness.value
      today.sleepQuality = player.wellness.sleepQuality.value
      today.mood = player.wellness.mood.value
      today.stress = player.wellness.stress.value
      today.readiness = player.wellness.readiness
      today.sleepRisk = player.wellness.risk.sleep ? 1 : 0
      today.painMax = player.wellness.pain.hasData
        ? (player.wellness.pain.max ?? null)
        : null
    }

    const derived = computeDerivedForPlayer({
      metrics: active,
      today,
      series,
      selectedDate: args.selectedDate,
    })

    return { ...player, derived }
  })
}
