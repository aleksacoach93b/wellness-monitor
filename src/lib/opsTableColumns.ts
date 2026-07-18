/**
 * Live Ops monitoring table — configurable columns per team + admin + survey.
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

/** Columns that can be wired to a survey question. */
export type OpsMappableColumnId =
  | 'bed'
  | 'wake'
  | 'duration'
  | 'quality'
  | 'fatigue'
  | 'soreness'
  | 'mood'
  | 'stress'
  | 'readiness'

export type OpsColumnConfig = {
  id: OpsColumnId
  enabled: boolean
  /** Custom table header; empty/null → catalog default */
  label?: string | null
  /** Survey question id used as the data source for this column */
  questionId?: string | null
}

export type OpsColumnMeta = {
  id: OpsColumnId
  label: string
  group: 'Identity & status' | 'Sleep' | 'Wellness load' | 'Readiness'
  /** Athlete identity column cannot be removed. */
  required?: boolean
  description?: string
  mappable?: boolean
}

export type OpsSurveyQuestion = {
  id: string
  text: string
  type: string
  order: number
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
  {
    id: 'bed',
    label: 'Bed',
    group: 'Sleep',
    description: 'Bedtime',
    mappable: true,
  },
  {
    id: 'wake',
    label: 'Wake',
    group: 'Sleep',
    description: 'Wake-up time',
    mappable: true,
  },
  {
    id: 'duration',
    label: 'Duration',
    group: 'Sleep',
    description: 'Sleep length (or mapped duration question)',
    mappable: true,
  },
  {
    id: 'quality',
    label: 'Quality',
    group: 'Sleep',
    description: 'Sleep quality 1–10',
    mappable: true,
  },
  {
    id: 'sleepRisk',
    label: 'Sleep risk',
    group: 'Sleep',
    description: 'Stable / Attention (derived)',
  },
  {
    id: 'fatigue',
    label: 'Fatigue',
    group: 'Wellness load',
    description: 'Fatigue 1–10',
    mappable: true,
  },
  {
    id: 'soreness',
    label: 'Soreness',
    group: 'Wellness load',
    description: 'Soreness 1–10',
    mappable: true,
  },
  {
    id: 'mood',
    label: 'Mood',
    group: 'Wellness load',
    description: 'Mood 1–10',
    mappable: true,
  },
  {
    id: 'stress',
    label: 'Stress',
    group: 'Wellness load',
    description: 'Stress 1–10',
    mappable: true,
  },
  {
    id: 'readiness',
    label: 'Readiness',
    group: 'Readiness',
    description: 'Readiness score',
    mappable: true,
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
const MAPPABLE_IDS = new Set(
  OPS_COLUMN_CATALOG.filter((c) => c.mappable).map((c) => c.id),
)

export function metaFor(id: OpsColumnId): OpsColumnMeta {
  return OPS_COLUMN_CATALOG.find((c) => c.id === id) ?? {
    id,
    label: id,
    group: 'Wellness load',
  }
}

export function headerLabel(col: OpsColumnConfig): string {
  const custom = typeof col.label === 'string' ? col.label.trim() : ''
  return custom || metaFor(col.id).label
}

export function isMappableColumn(id: OpsColumnId): id is OpsMappableColumnId {
  return MAPPABLE_IDS.has(id)
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
    const labelRaw = (row as { label?: unknown }).label
    const qidRaw = (row as { questionId?: unknown }).questionId
    const label =
      typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : null
    const questionId =
      isMappableColumn(id as OpsColumnId) &&
      typeof qidRaw === 'string' &&
      qidRaw.trim()
        ? qidRaw.trim()
        : null
    out.push({
      id: id as OpsColumnId,
      enabled: required ? true : Boolean(enabled),
      label,
      questionId,
    })
  }

  for (const col of DEFAULT_OPS_COLUMNS) {
    if (seen.has(col.id)) continue
    out.push({ ...col, label: null, questionId: null })
  }

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

/** columnId → survey questionId for parse overlays. */
export function questionMappingsFromColumns(
  columns: OpsColumnConfig[],
): Partial<Record<OpsMappableColumnId, string>> {
  const out: Partial<Record<OpsMappableColumnId, string>> = {}
  for (const col of normalizeOpsColumns(columns)) {
    if (!isMappableColumn(col.id)) continue
    if (!col.questionId) continue
    out[col.id] = col.questionId
  }
  return out
}
