/**
 * Live Ops derived metrics — formulas + statistical transforms.
 */

import { compareRule, type OpsRuleOperator } from '@/lib/opsRules'

export type OpsMetricKind =
  | 'FORMULA'
  | 'ACWR'
  | 'EWMA'
  | 'ROLLING_MEAN'
  | 'ROLLING_SUM'
  | 'PCT_CHANGE'
  | 'ZSCORE'
  | 'MIN'
  | 'MAX'
  | 'RANGE'
  | 'SD'
  | 'CV'
  | 'SPIKE'
  | 'COMPOSITE'

export type OpsBaseVariable =
  | 'fatigue'
  | 'soreness'
  | 'sleepQuality'
  | 'mood'
  | 'stress'
  | 'readiness'
  | 'sleepRisk'
  | 'painMax'

export type FormatRule = {
  operator: OpsRuleOperator
  threshold: number
  color: string
}

export type OpsMetricConfig = {
  /** FORMULA: e.g. "(fatigue+soreness)/2" */
  expression?: string
  /** Single-source transforms */
  source?: OpsBaseVariable
  /** EWMA smoothing factor 0–1 */
  alpha?: number
  /** Rolling / ACWR windows (days) */
  windowDays?: number
  acuteDays?: number
  chronicDays?: number
  /** SPIKE: flag when today > mean * (1 + spikePct/100) */
  spikePct?: number
  /** COMPOSITE: weighted blend */
  weights?: Partial<Record<OpsBaseVariable, number>>
}

export type OpsMetricDTO = {
  id: string
  teamId: string
  surveyId: string | null
  name: string
  key: string
  kind: OpsMetricKind
  config: OpsMetricConfig
  formatting: FormatRule[]
  showInTable: boolean
  enabled: boolean
  sortOrder: number
}

export type DerivedCell = {
  key: string
  metricId: string
  name: string
  value: number | null
  color: string | null
}

export type DaySeriesPoint = {
  date: string
  values: Partial<Record<OpsBaseVariable, number | null>>
}

export const OPS_BASE_VARIABLES: Array<{
  id: OpsBaseVariable
  label: string
  hint: string
}> = [
  { id: 'fatigue', label: 'Fatigue', hint: '1–10 (higher better)' },
  { id: 'soreness', label: 'Soreness', hint: '1–10 (higher better)' },
  { id: 'sleepQuality', label: 'Sleep quality', hint: '1–10' },
  { id: 'mood', label: 'Mood', hint: '1–10' },
  { id: 'stress', label: 'Stress', hint: '1–10' },
  { id: 'readiness', label: 'Readiness', hint: 'Composite readiness' },
  { id: 'sleepRisk', label: 'Sleep risk', hint: '1 = Attention, 0 = Stable' },
  { id: 'painMax', label: 'Max pain', hint: 'Highest body-map rating' },
]

export const OPS_METRIC_KINDS: Array<{
  id: OpsMetricKind
  label: string
  description: string
  needsSource: boolean
  needsFormula: boolean
  needsWeights: boolean
}> = [
  {
    id: 'FORMULA',
    label: 'Custom formula',
    description: 'Combine variables with + − × ÷, e.g. (fatigue+soreness)/2',
    needsSource: false,
    needsFormula: true,
    needsWeights: false,
  },
  {
    id: 'ACWR',
    label: 'ACWR',
    description: 'Acute:Chronic Workload Ratio (default 7:28)',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'EWMA',
    label: 'EWMA',
    description: 'Exponentially weighted moving average',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'ROLLING_MEAN',
    label: 'Rolling mean',
    description: 'Average over the last N days',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'ROLLING_SUM',
    label: 'Rolling sum',
    description: 'Sum over the last N days',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'PCT_CHANGE',
    label: '% change',
    description: 'Percent change vs previous day',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'ZSCORE',
    label: 'Z-score',
    description: 'Today vs personal mean/SD in window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'MIN',
    label: 'Window min',
    description: 'Lowest value in the window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'MAX',
    label: 'Window max',
    description: 'Highest value in the window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'RANGE',
    label: 'Window range',
    description: 'Max − min in the window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'SD',
    label: 'Std deviation',
    description: 'Variability (SD) in the window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'CV',
    label: 'Coefficient of variation',
    description: 'SD / mean × 100 in the window',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'SPIKE',
    label: 'Spike detector',
    description: '1 if today exceeds mean by spike %, else 0',
    needsSource: true,
    needsFormula: false,
    needsWeights: false,
  },
  {
    id: 'COMPOSITE',
    label: 'Weighted composite',
    description: 'Weighted blend of multiple variables',
    needsSource: false,
    needsFormula: false,
    needsWeights: true,
  },
]

const KIND_IDS = new Set(OPS_METRIC_KINDS.map((k) => k.id))
const VAR_IDS = new Set(OPS_BASE_VARIABLES.map((v) => v.id))

export function isOpsMetricKind(v: unknown): v is OpsMetricKind {
  return typeof v === 'string' && KIND_IDS.has(v as OpsMetricKind)
}

export function isOpsBaseVariable(v: unknown): v is OpsBaseVariable {
  return typeof v === 'string' && VAR_IDS.has(v as OpsBaseVariable)
}

export function slugifyMetricKey(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || `metric_${Date.now().toString(36)}`
}

/** Safe arithmetic expression over whitelisted variable names. */
export function evaluateFormula(
  expression: string,
  vars: Partial<Record<OpsBaseVariable, number | null>>,
): number | null {
  const expr = expression.trim()
  if (!expr || expr.length > 200) return null

  // Reject anything that isn't identifiers, numbers, whitespace, or + - * / ( ) .
  if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(expr)) return null

  const identifiers = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
  for (const id of identifiers) {
    if (!isOpsBaseVariable(id)) return null
    if (vars[id] == null || !Number.isFinite(vars[id]!)) return null
  }

  let js = expr
  for (const id of identifiers) {
    js = js.replace(new RegExp(`\\b${id}\\b`, 'g'), String(vars[id as OpsBaseVariable]))
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${js});`)()
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v))
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values)
  if (m == null) return null
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function seriesForSource(
  series: DaySeriesPoint[],
  source: OpsBaseVariable,
  upToDate: string,
): Array<{ date: string; value: number }> {
  return series
    .filter((p) => p.date <= upToDate)
    .map((p) => ({ date: p.date, value: p.values[source] ?? null }))
    .filter((p): p is { date: string; value: number } => p.value != null && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function windowValues(
  series: DaySeriesPoint[],
  source: OpsBaseVariable,
  upToDate: string,
  windowDays: number,
): number[] {
  const all = seriesForSource(series, source, upToDate)
  if (!all.length) return []
  // Take last N calendar-ish points available (by count of observations).
  return all.slice(-Math.max(1, windowDays)).map((p) => p.value)
}

function ewma(values: number[], alpha: number): number | null {
  if (!values.length) return null
  const a = Math.min(1, Math.max(0.01, alpha))
  let acc = values[0]
  for (let i = 1; i < values.length; i++) {
    acc = a * values[i] + (1 - a) * acc
  }
  return acc
}

function acwr(values: number[], acuteDays: number, chronicDays: number): number | null {
  if (values.length < Math.max(acuteDays, 2)) return null
  const acute = mean(values.slice(-acuteDays))
  const chronic = mean(values.slice(-chronicDays))
  if (acute == null || chronic == null || Math.abs(chronic) < 1e-9) return null
  return acute / chronic
}

export function applyFormatting(
  value: number | null,
  formatting: FormatRule[],
): string | null {
  if (value == null || !formatting?.length) return null
  for (const rule of formatting) {
    if (compareRule(value, rule.operator, rule.threshold)) {
      return rule.color || null
    }
  }
  return null
}

export function defaultColorForValue(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  // Heuristic for 1–10 style scales; ACWR/z-score get formatting from admin.
  if (value >= 0 && value <= 10) {
    if (value < 3) return '#ef4444'
    if (value < 5) return '#f97316'
    if (value < 7) return '#facc15'
    if (value < 9) return '#84cc16'
    return '#22c55e'
  }
  return '#67e8f9'
}

export function computeMetricValue(args: {
  metric: Pick<OpsMetricDTO, 'kind' | 'config'>
  today: Partial<Record<OpsBaseVariable, number | null>>
  series: DaySeriesPoint[]
  selectedDate: string
}): number | null {
  const { metric, today, series, selectedDate } = args
  const cfg = metric.config || {}
  const source = cfg.source
  const windowDays = Math.min(60, Math.max(2, Math.round(cfg.windowDays ?? 7)))
  const alpha = cfg.alpha ?? 0.3
  const acuteDays = Math.min(14, Math.max(2, Math.round(cfg.acuteDays ?? 7)))
  const chronicDays = Math.min(60, Math.max(acuteDays + 1, Math.round(cfg.chronicDays ?? 28)))
  const spikePct = cfg.spikePct ?? 30

  switch (metric.kind) {
    case 'FORMULA':
      return evaluateFormula(cfg.expression || '', today)

    case 'COMPOSITE': {
      const weights = cfg.weights || {}
      let sum = 0
      let wSum = 0
      for (const [k, w] of Object.entries(weights)) {
        if (!isOpsBaseVariable(k) || w == null || !Number.isFinite(w) || w === 0) continue
        const v = today[k]
        if (v == null || !Number.isFinite(v)) continue
        sum += v * w
        wSum += w
      }
      return wSum > 0 ? sum / wSum : null
    }

    case 'PCT_CHANGE': {
      if (!source) return null
      const pts = seriesForSource(series, source, selectedDate)
      if (pts.length < 2) return null
      const prev = pts[pts.length - 2].value
      const cur = pts[pts.length - 1].value
      if (Math.abs(prev) < 1e-9) return null
      return ((cur - prev) / Math.abs(prev)) * 100
    }

    case 'ACWR': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, chronicDays)
      return acwr(vals, acuteDays, chronicDays)
    }

    case 'EWMA': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      return ewma(vals, alpha)
    }

    case 'ROLLING_MEAN': {
      if (!source) return null
      return mean(windowValues(series, source, selectedDate, windowDays))
    }

    case 'ROLLING_SUM': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null
    }

    case 'ZSCORE': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      const cur = today[source]
      const m = mean(vals)
      const sd = stddev(vals)
      if (cur == null || m == null || sd == null || sd < 1e-9) return null
      return (cur - m) / sd
    }

    case 'MIN': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      return vals.length ? Math.min(...vals) : null
    }

    case 'MAX': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      return vals.length ? Math.max(...vals) : null
    }

    case 'RANGE': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      if (!vals.length) return null
      return Math.max(...vals) - Math.min(...vals)
    }

    case 'SD': {
      if (!source) return null
      return stddev(windowValues(series, source, selectedDate, windowDays))
    }

    case 'CV': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      const m = mean(vals)
      const sd = stddev(vals)
      if (m == null || sd == null || Math.abs(m) < 1e-9) return null
      return (sd / Math.abs(m)) * 100
    }

    case 'SPIKE': {
      if (!source) return null
      const vals = windowValues(series, source, selectedDate, windowDays)
      const cur = today[source]
      const m = mean(vals.slice(0, -1).length ? vals.slice(0, -1) : vals)
      if (cur == null || m == null) return null
      return cur > m * (1 + spikePct / 100) ? 1 : 0
    }

    default:
      return null
  }
}

export function computeDerivedForPlayer(args: {
  metrics: OpsMetricDTO[]
  today: Partial<Record<OpsBaseVariable, number | null>>
  series: DaySeriesPoint[]
  selectedDate: string
}): DerivedCell[] {
  const active = args.metrics.filter((m) => m.enabled)
  return active.map((metric) => {
    const value = computeMetricValue({
      metric,
      today: args.today,
      series: args.series,
      selectedDate: args.selectedDate,
    })
    const color =
      applyFormatting(value, metric.formatting) ?? defaultColorForValue(value)
    return {
      key: metric.key,
      metricId: metric.id,
      name: metric.name,
      value,
      color,
    }
  })
}

/** Custom rule metric id for a derived key. */
export function customRuleMetricId(key: string): string {
  return `custom:${key}`
}

export function parseCustomRuleMetric(metric: string): string | null {
  if (!metric.startsWith('custom:')) return null
  const key = metric.slice('custom:'.length).trim()
  return key || null
}
