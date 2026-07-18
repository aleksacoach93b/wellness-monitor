/**
 * Live Ops intervention rules — admin-configurable thresholds per team.
 */

export type OpsRuleMetric =
  | 'readiness'
  | 'fatigue'
  | 'soreness'
  | 'sleepQuality'
  | 'mood'
  | 'stress'
  | 'sleepRisk'
  | 'painMax'
  | 'pending'

export type OpsRuleOperator = 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ'
export type OpsRuleSeverity = 'WATCH' | 'ALERT' | 'CRITICAL'
export type OpsInterventionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export type OpsRuleDTO = {
  id: string
  teamId: string
  surveyId: string | null
  name: string
  metric: OpsRuleMetric
  operator: OpsRuleOperator
  threshold: number
  severity: OpsRuleSeverity
  enabled: boolean
  sortOrder: number
}

export type OpsInterventionDTO = {
  id: string
  teamId: string
  surveyId: string | null
  ruleId: string
  ruleName: string
  playerId: string
  playerName: string
  date: string
  severity: OpsRuleSeverity
  metric: OpsRuleMetric
  value: number | null
  message: string
  status: OpsInterventionStatus
  note: string | null
  createdAt: string
  updatedAt: string
}

export type OpsRuleMetricMeta = {
  id: OpsRuleMetric
  label: string
  description: string
  /** How to read the scale in the UI */
  hint: string
}

export const OPS_RULE_METRICS: OpsRuleMetricMeta[] = [
  {
    id: 'readiness',
    label: 'Readiness',
    description: 'Readiness score 1–10',
    hint: 'Higher is better. Example: < 6',
  },
  {
    id: 'fatigue',
    label: 'Fatigue',
    description: 'Fatigue 1–10',
    hint: 'Higher is better. Example: < 4',
  },
  {
    id: 'soreness',
    label: 'Soreness',
    description: 'Soreness 1–10',
    hint: 'Higher is better. Example: < 5',
  },
  {
    id: 'sleepQuality',
    label: 'Sleep quality',
    description: 'Sleep quality 1–10',
    hint: 'Higher is better. Example: < 6',
  },
  {
    id: 'mood',
    label: 'Mood',
    description: 'Mood 1–10',
    hint: 'Higher is better. Example: < 5',
  },
  {
    id: 'stress',
    label: 'Stress',
    description: 'Stress 1–10',
    hint: 'Higher is better. Example: < 5',
  },
  {
    id: 'sleepRisk',
    label: 'Sleep risk',
    description: '1 = Attention, 0 = Stable',
    hint: 'Flag when ≥ 1 (Attention)',
  },
  {
    id: 'painMax',
    label: 'Max pain',
    description: 'Highest pain zone rating',
    hint: 'Higher is worse. Example: ≥ 7',
  },
  {
    id: 'pending',
    label: 'Pending check-in',
    description: '1 = not submitted, 0 = done',
    hint: 'Flag when ≥ 1 (still pending)',
  },
]

export const OPS_RULE_OPERATORS: Array<{ id: OpsRuleOperator; label: string }> = [
  { id: 'LT', label: '<' },
  { id: 'LTE', label: '≤' },
  { id: 'GT', label: '>' },
  { id: 'GTE', label: '≥' },
  { id: 'EQ', label: '=' },
]

export const OPS_RULE_SEVERITIES: Array<{ id: OpsRuleSeverity; label: string }> = [
  { id: 'WATCH', label: 'Watch' },
  { id: 'ALERT', label: 'Alert' },
  { id: 'CRITICAL', label: 'Critical' },
]

/** Sensible starter rules — each club can edit thresholds. */
export const DEFAULT_OPS_RULES: Array<
  Omit<OpsRuleDTO, 'id' | 'teamId' | 'surveyId' | 'sortOrder'>
> = [
  {
    name: 'Low readiness',
    metric: 'readiness',
    operator: 'LT',
    threshold: 6,
    severity: 'ALERT',
    enabled: true,
  },
  {
    name: 'Sleep risk attention',
    metric: 'sleepRisk',
    operator: 'GTE',
    threshold: 1,
    severity: 'WATCH',
    enabled: true,
  },
  {
    name: 'Low fatigue score',
    metric: 'fatigue',
    operator: 'LT',
    threshold: 4,
    severity: 'WATCH',
    enabled: true,
  },
  {
    name: 'High pain',
    metric: 'painMax',
    operator: 'GTE',
    threshold: 7,
    severity: 'CRITICAL',
    enabled: true,
  },
  {
    name: 'Missing check-in',
    metric: 'pending',
    operator: 'GTE',
    threshold: 1,
    severity: 'WATCH',
    enabled: false,
  },
]

const METRIC_IDS = new Set(OPS_RULE_METRICS.map((m) => m.id))
const OP_IDS = new Set(OPS_RULE_OPERATORS.map((o) => o.id))
const SEV_IDS = new Set(OPS_RULE_SEVERITIES.map((s) => s.id))

export function isOpsRuleMetric(v: unknown): v is OpsRuleMetric {
  return typeof v === 'string' && METRIC_IDS.has(v as OpsRuleMetric)
}

export function isOpsRuleOperator(v: unknown): v is OpsRuleOperator {
  return typeof v === 'string' && OP_IDS.has(v as OpsRuleOperator)
}

export function isOpsRuleSeverity(v: unknown): v is OpsRuleSeverity {
  return typeof v === 'string' && SEV_IDS.has(v as OpsRuleSeverity)
}

export function compareRule(
  value: number,
  operator: OpsRuleOperator,
  threshold: number,
): boolean {
  switch (operator) {
    case 'LT':
      return value < threshold
    case 'LTE':
      return value <= threshold
    case 'GT':
      return value > threshold
    case 'GTE':
      return value >= threshold
    case 'EQ':
      return Math.abs(value - threshold) < 1e-6
    default:
      return false
  }
}

export function operatorSymbol(op: OpsRuleOperator): string {
  return OPS_RULE_OPERATORS.find((o) => o.id === op)?.label ?? op
}

export function metricLabel(metric: OpsRuleMetric): string {
  return OPS_RULE_METRICS.find((m) => m.id === metric)?.label ?? metric
}

type PlayerForEval = {
  id: string
  firstName: string
  lastName: string
  status: 'done' | 'pending'
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

export function metricValueForPlayer(
  player: PlayerForEval,
  metric: OpsRuleMetric,
): number | null {
  if (metric === 'pending') return player.status === 'pending' ? 1 : 0

  const w = player.wellness
  if (!w) return null

  switch (metric) {
    case 'readiness':
      return w.readiness
    case 'fatigue':
      return w.fatigue.value
    case 'soreness':
      return w.soreness.value
    case 'sleepQuality':
      return w.sleepQuality.value
    case 'mood':
      return w.mood.value
    case 'stress':
      return w.stress.value
    case 'sleepRisk':
      return w.risk.sleep ? 1 : 0
    case 'painMax':
      return w.pain.hasData ? (w.pain.max ?? null) : null
    case 'pending':
      return player.status === 'pending' ? 1 : 0
  }
}

export type EvaluatedHit = {
  ruleId: string
  ruleName: string
  playerId: string
  playerName: string
  severity: OpsRuleSeverity
  metric: OpsRuleMetric
  value: number
  message: string
}

export function evaluateOpsRules(args: {
  players: PlayerForEval[]
  rules: Array<Pick<OpsRuleDTO, 'id' | 'name' | 'metric' | 'operator' | 'threshold' | 'severity' | 'enabled' | 'surveyId'>>
  surveyId: string | null
}): EvaluatedHit[] {
  const active = args.rules.filter(
    (r) =>
      r.enabled &&
      (!r.surveyId || !args.surveyId || r.surveyId === args.surveyId),
  )
  const hits: EvaluatedHit[] = []

  for (const player of args.players) {
    const playerName = `${player.firstName} ${player.lastName}`.trim()
    for (const rule of active) {
      const value = metricValueForPlayer(player, rule.metric)
      if (value == null || !Number.isFinite(value)) continue
      if (!compareRule(value, rule.operator, rule.threshold)) continue
      hits.push({
        ruleId: rule.id,
        ruleName: rule.name,
        playerId: player.id,
        playerName,
        severity: rule.severity,
        metric: rule.metric,
        value,
        message: `${rule.name}: ${metricLabel(rule.metric)} ${operatorSymbol(rule.operator)} ${rule.threshold} (now ${formatMetricValue(rule.metric, value)})`,
      })
    }
  }

  const rank = { CRITICAL: 0, ALERT: 1, WATCH: 2 } as const
  return hits.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      a.playerName.localeCompare(b.playerName) ||
      a.ruleName.localeCompare(b.ruleName),
  )
}

function formatMetricValue(metric: OpsRuleMetric, value: number): string {
  if (metric === 'sleepRisk') return value >= 1 ? 'Attention' : 'Stable'
  if (metric === 'pending') return value >= 1 ? 'Pending' : 'Done'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
