'use client'

import { useMemo, useState } from 'react'
import { Calculator, Plus, Trash2, Table2 } from 'lucide-react'
import {
  OPS_BASE_VARIABLES,
  OPS_METRIC_KINDS,
  customRuleMetricId,
  type FormatRule,
  type OpsBaseVariable,
  type OpsMetricConfig,
  type OpsMetricDTO,
  type OpsMetricKind,
} from '@/lib/opsMetrics'
import { OPS_RULE_OPERATORS, type OpsRuleOperator } from '@/lib/opsRules'

type Props = {
  metrics: OpsMetricDTO[]
  surveys: Array<{ id: string; title: string }>
  onCreate: (input: {
    name: string
    kind: OpsMetricKind
    config: OpsMetricConfig
    formatting: FormatRule[]
    showInTable: boolean
    enabled: boolean
    surveyId: string | null
  }) => Promise<{ ok: boolean; error?: string; metric?: OpsMetricDTO }>
  onPatch: (id: string, patch: Partial<OpsMetricDTO>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreateRuleFromMetric?: (metric: OpsMetricDTO) => void
  busy?: boolean
}

const PRESET_COLORS = ['#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#67e8f9']

export default function OpsMetricsPanel({
  metrics,
  surveys,
  onCreate,
  onPatch,
  onDelete,
  onCreateRuleFromMetric,
  busy,
}: Props) {
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('Tiredness')
  const [kind, setKind] = useState<OpsMetricKind>('FORMULA')
  const [expression, setExpression] = useState('(fatigue+soreness)/2')
  const [source, setSource] = useState<OpsBaseVariable>('fatigue')
  const [windowDays, setWindowDays] = useState(7)
  const [alpha, setAlpha] = useState(0.3)
  const [acuteDays, setAcuteDays] = useState(7)
  const [chronicDays, setChronicDays] = useState(28)
  const [spikePct, setSpikePct] = useState(30)
  const [showInTable, setShowInTable] = useState(true)
  const [surveyId, setSurveyId] = useState('')
  const [formatOp, setFormatOp] = useState<OpsRuleOperator>('GTE')
  const [formatThreshold, setFormatThreshold] = useState(7)
  const [formatColor, setFormatColor] = useState('#ef4444')
  const [formatting, setFormatting] = useState<FormatRule[]>([
    { operator: 'GTE', threshold: 7, color: '#ef4444' },
    { operator: 'GTE', threshold: 5, color: '#facc15' },
  ])
  const [weights, setWeights] = useState<Partial<Record<OpsBaseVariable, number>>>({
    fatigue: 1,
    soreness: 1,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const kindMeta = useMemo(
    () => OPS_METRIC_KINDS.find((k) => k.id === kind),
    [kind],
  )

  const insertVar = (id: OpsBaseVariable) => {
    setExpression((prev) => `${prev}${prev && !prev.endsWith('(') ? '' : ''}${id}`)
  }

  const buildConfig = (): OpsMetricConfig => {
    if (kind === 'FORMULA') return { expression }
    if (kind === 'COMPOSITE') return { weights }
    if (kind === 'ACWR') return { source, acuteDays, chronicDays }
    if (kind === 'EWMA') return { source, alpha, windowDays }
    if (kind === 'SPIKE') return { source, windowDays, spikePct }
    return { source, windowDays }
  }

  const submit = async () => {
    setFormError(null)
    const result = await onCreate({
      name,
      kind,
      config: buildConfig(),
      formatting,
      showInTable,
      enabled: true,
      surveyId: surveyId || null,
    })
    if (!result.ok) {
      setFormError(result.error || 'Could not save metric')
      return
    }
    setName('Custom metric')
  }

  return (
    <section className="ops-metrics">
      <header className="ops-rules-head">
        <div>
          <h3>
            <Calculator className="h-4 w-4" />
            Metrics calculator
          </h3>
          <p>
            Build new columns from formulas (Tiredness = (fatigue+soreness)/2), ACWR, EWMA and
            other stats. Toggle “Show in table”, set conditional colors, then optionally turn
            them into intervention rules.
          </p>
        </div>
        <button
          type="button"
          className="ops-rules-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Open calculator'}
        </button>
      </header>

      {!open ? (
        <div className="ops-rules-summary">
          {metrics.filter((m) => m.enabled).length} active / {metrics.length} total
        </div>
      ) : (
        <>
          <div className="ops-rules-section-label">Saved metrics ({metrics.length})</div>
          {metrics.length === 0 ? (
            <div className="ops-rules-empty">
              No custom metrics yet. Create a formula or pick a statistical transform below.
            </div>
          ) : (
            <ul className="ops-rules-list">
              {metrics.map((metric) => (
                <li
                  key={metric.id}
                  className={`ops-rules-item${metric.enabled ? '' : ' is-off'}`}
                >
                  <label className="ops-rules-enable">
                    <input
                      type="checkbox"
                      checked={metric.enabled}
                      disabled={busy}
                      onChange={(e) => onPatch(metric.id, { enabled: e.target.checked })}
                    />
                  </label>
                  <div className="ops-rules-fields">
                    <div className="ops-metrics-title-row">
                      <input
                        className="ops-rules-name"
                        defaultValue={metric.name}
                        key={`${metric.id}-${metric.name}`}
                        disabled={busy}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next && next !== metric.name) onPatch(metric.id, { name: next })
                        }}
                      />
                      <span className="ops-metrics-kind">
                        {OPS_METRIC_KINDS.find((k) => k.id === metric.kind)?.label ?? metric.kind}
                      </span>
                    </div>
                    <small>
                      key: {metric.key}
                      {metric.kind === 'FORMULA' && metric.config.expression
                        ? ` · ${metric.config.expression}`
                        : metric.config.source
                          ? ` · source ${metric.config.source}`
                          : ''}
                    </small>
                    <div className="ops-metrics-actions">
                      <label className="ops-metrics-toggle">
                        <Table2 className="h-3.5 w-3.5" />
                        <input
                          type="checkbox"
                          checked={metric.showInTable}
                          disabled={busy}
                          onChange={(e) =>
                            onPatch(metric.id, { showInTable: e.target.checked })
                          }
                        />
                        Show in table
                      </label>
                      {onCreateRuleFromMetric ? (
                        <button
                          type="button"
                          className="ops-metrics-rule-btn"
                          disabled={busy}
                          onClick={() => onCreateRuleFromMetric(metric)}
                        >
                          Use in rule →
                        </button>
                      ) : null}
                    </div>
                    {metric.formatting?.length ? (
                      <div className="ops-metrics-swatches">
                        {metric.formatting.map((f, i) => (
                          <span key={i} style={{ background: f.color }}>
                            {f.operator} {f.threshold}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="ops-rules-del"
                    disabled={busy}
                    aria-label="Delete metric"
                    onClick={() => onDelete(metric.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ops-rules-create">
            <strong>Create metric</strong>

            <div className="ops-rules-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Metric name (e.g. Tiredness)"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as OpsMetricKind)}
              >
                {OPS_METRIC_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            {kindMeta ? <small>{kindMeta.description}</small> : null}

            {kindMeta?.needsFormula ? (
              <div className="ops-metrics-formula">
                <div className="ops-metrics-chips">
                  {OPS_BASE_VARIABLES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => insertVar(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="(fatigue+soreness)/2"
                />
              </div>
            ) : null}

            {kindMeta?.needsSource ? (
              <div className="ops-rules-row">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as OpsBaseVariable)}
                >
                  {OPS_BASE_VARIABLES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {kind === 'ACWR' ? (
                  <>
                    <input
                      type="number"
                      value={acuteDays}
                      min={2}
                      max={14}
                      onChange={(e) => setAcuteDays(Number(e.target.value))}
                      title="Acute days"
                    />
                    <input
                      type="number"
                      value={chronicDays}
                      min={7}
                      max={60}
                      onChange={(e) => setChronicDays(Number(e.target.value))}
                      title="Chronic days"
                    />
                  </>
                ) : kind === 'EWMA' ? (
                  <>
                    <input
                      type="number"
                      step="0.05"
                      min={0.05}
                      max={1}
                      value={alpha}
                      onChange={(e) => setAlpha(Number(e.target.value))}
                      title="Alpha"
                    />
                    <input
                      type="number"
                      value={windowDays}
                      min={2}
                      max={60}
                      onChange={(e) => setWindowDays(Number(e.target.value))}
                      title="Window days"
                    />
                  </>
                ) : kind === 'SPIKE' ? (
                  <>
                    <input
                      type="number"
                      value={spikePct}
                      min={5}
                      max={200}
                      onChange={(e) => setSpikePct(Number(e.target.value))}
                      title="Spike %"
                    />
                    <input
                      type="number"
                      value={windowDays}
                      min={2}
                      max={60}
                      onChange={(e) => setWindowDays(Number(e.target.value))}
                      title="Window days"
                    />
                  </>
                ) : (
                  <input
                    type="number"
                    value={windowDays}
                    min={2}
                    max={60}
                    onChange={(e) => setWindowDays(Number(e.target.value))}
                    title="Window days"
                  />
                )}
              </div>
            ) : null}

            {kindMeta?.needsWeights ? (
              <div className="ops-metrics-weights">
                {OPS_BASE_VARIABLES.slice(0, 6).map((v) => (
                  <label key={v.id}>
                    {v.label}
                    <input
                      type="number"
                      step="0.1"
                      value={weights[v.id] ?? 0}
                      onChange={(e) =>
                        setWeights((prev) => ({
                          ...prev,
                          [v.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <div className="ops-metrics-format">
              <strong>Conditional formatting</strong>
              <div className="ops-rules-row">
                <select
                  value={formatOp}
                  onChange={(e) => setFormatOp(e.target.value as OpsRuleOperator)}
                >
                  {OPS_RULE_OPERATORS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={formatThreshold}
                  onChange={(e) => setFormatThreshold(Number(e.target.value))}
                />
                <div className="ops-metrics-color-picks">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={formatColor === c ? 'is-on' : ''}
                      style={{ background: c }}
                      onClick={() => setFormatColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="ops-metrics-rule-btn"
                  onClick={() =>
                    setFormatting((prev) => [
                      ...prev,
                      { operator: formatOp, threshold: formatThreshold, color: formatColor },
                    ])
                  }
                >
                  Add color rule
                </button>
              </div>
              {formatting.length ? (
                <div className="ops-metrics-swatches">
                  {formatting.map((f, i) => (
                    <button
                      key={`${f.color}-${i}`}
                      type="button"
                      style={{ background: f.color }}
                      onClick={() =>
                        setFormatting((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      title="Remove"
                    >
                      {f.operator} {f.threshold} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="ops-rules-row">
              <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
                <option value="">All surveys</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <label className="ops-metrics-toggle">
                <input
                  type="checkbox"
                  checked={showInTable}
                  onChange={(e) => setShowInTable(e.target.checked)}
                />
                Add column to table
              </label>
              <button
                type="button"
                className="ops-rules-add"
                disabled={busy}
                onClick={() => void submit()}
              >
                <Plus className="h-4 w-4" />
                Create metric
              </button>
            </div>
            {formError ? <p className="ops-rules-error">{formError}</p> : null}
            <small className="ops-metrics-hint">
              Tip: after creating, use “Use in rule” or pick metric{' '}
              <code>{customRuleMetricId('your_key')}</code> in Intervention rules.
            </small>
          </div>
        </>
      )}
    </section>
  )
}
