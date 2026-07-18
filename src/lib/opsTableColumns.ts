/**
 * Live Ops monitoring table — configurable columns per team + admin account.
 */

export type OpsColumnId =
  | 'athlete'
  | 'performance'
  | 'submitted'
  | 'bed'
  | 'wake'
  | 'duration'
  | 'quality'
  | 'sleepRisk'
  | 'fatigue'
  | 'soreness'
  | 'mood'
  | 'stress'
  | 'readiness'

export type OpsColumnConfig = {
  id: OpsColumnId
  enabled: boolean
}

export type OpsColumnMeta = {
  id: OpsColumnId
  label: string
  group: 'Identity & status' | 'Sleep' | 'Wellness load' | 'Readiness'
  /** Athlete identity column cannot be removed. */
  required?: boolean
  description?: string
}

export const OPS_COLUMN_CATALOG: OpsColumnMeta[] = [
  {
    id: 'athlete',
    label: 'Athlete',
    group: 'Identity & status',
    required: true,
    description: 'Name, photo, rank',
  },
  {
    id: 'performance',
    label: 'Performance',
    group: 'Identity & status',
    description: 'Watch / pending / stable badge',
  },
  {
    id: 'submitted',
    label: 'Submitted',
    group: 'Identity & status',
    description: 'Check-in time',
  },
  { id: 'bed', label: 'Bed', group: 'Sleep', description: 'Bedtime' },
  { id: 'wake', label: 'Wake', group: 'Sleep', description: 'Wake-up time' },
  { id: 'duration', label: 'Duration', group: 'Sleep', description: 'Sleep length' },
  { id: 'quality', label: 'Quality', group: 'Sleep', description: 'Sleep quality 1–10' },
  {
    id: 'sleepRisk',
    label: 'Sleep risk',
    group: 'Sleep',
    description: 'Stable / Attention',
  },
  {
    id: 'fatigue',
    label: 'Fatigue',
    group: 'Wellness load',
    description: 'Fatigue 1–10',
  },
  {
    id: 'soreness',
    label: 'Soreness',
    group: 'Wellness load',
    description: 'Soreness 1–10',
  },
  { id: 'mood', label: 'Mood', group: 'Wellness load', description: 'Mood 1–10' },
  {
    id: 'stress',
    label: 'Stress',
    group: 'Wellness load',
    description: 'Stress 1–10',
  },
  {
    id: 'readiness',
    label: 'Readiness',
    group: 'Readiness',
    description: 'Readiness score',
  },
]

/** Default layout matching the current Live Ops board. */
export const DEFAULT_OPS_COLUMNS: OpsColumnConfig[] = [
  { id: 'athlete', enabled: true },
  { id: 'performance', enabled: true },
  { id: 'submitted', enabled: true },
  { id: 'bed', enabled: true },
  { id: 'wake', enabled: true },
  { id: 'duration', enabled: true },
  { id: 'quality', enabled: true },
  { id: 'sleepRisk', enabled: true },
  { id: 'fatigue', enabled: true },
  { id: 'soreness', enabled: true },
  { id: 'mood', enabled: true },
  { id: 'stress', enabled: true },
  { id: 'readiness', enabled: true },
]

const CATALOG_IDS = new Set(OPS_COLUMN_CATALOG.map((c) => c.id))

export function metaFor(id: OpsColumnId): OpsColumnMeta {
  return OPS_COLUMN_CATALOG.find((c) => c.id === id) ?? {
    id,
    label: id,
    group: 'Wellness load',
  }
}

/** Normalize API/DB payload → valid ordered config (required athlete always on). */
export function normalizeOpsColumns(input: unknown): OpsColumnConfig[] {
  const incoming = Array.isArray(input) ? input : []
  const seen = new Set<OpsColumnId>()
  const out: OpsColumnConfig[] = []

  for (const row of incoming) {
    if (!row || typeof row !== 'object') continue
    const id = (row as { id?: unknown }).id
    const enabled = (row as { enabled?: unknown }).enabled
    if (typeof id !== 'string' || !CATALOG_IDS.has(id as OpsColumnId)) continue
    if (seen.has(id as OpsColumnId)) continue
    seen.add(id as OpsColumnId)
    const required = metaFor(id as OpsColumnId).required
    out.push({
      id: id as OpsColumnId,
      enabled: required ? true : Boolean(enabled),
    })
  }

  // Append any new catalog columns the saved layout doesn't know about yet.
  for (const col of DEFAULT_OPS_COLUMNS) {
    if (seen.has(col.id)) continue
    out.push({ ...col })
  }

  // Guarantee athlete first among identity if somehow missing order — keep user order otherwise.
  const athleteIdx = out.findIndex((c) => c.id === 'athlete')
  if (athleteIdx > 0) {
    const [athlete] = out.splice(athleteIdx, 1)
    out.unshift({ ...athlete, enabled: true })
  } else if (athleteIdx === 0) {
    out[0] = { ...out[0], enabled: true }
  }

  return out
}

export function enabledColumns(columns: OpsColumnConfig[]): OpsColumnConfig[] {
  return normalizeOpsColumns(columns).filter((c) => c.enabled)
}

/** Build group header spans from the visible column list. */
export function groupSpans(
  visible: OpsColumnConfig[],
): Array<{ group: string; span: number }> {
  const spans: Array<{ group: string; span: number }> = []
  for (const col of visible) {
    const group = metaFor(col.id).group
    const last = spans[spans.length - 1]
    if (last && last.group === group) last.span += 1
    else spans.push({ group, span: 1 })
  }
  return spans
}
