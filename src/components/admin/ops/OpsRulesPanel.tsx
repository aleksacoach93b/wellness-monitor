'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, ShieldAlert } from 'lucide-react'
import {
  OPS_RULE_METRICS,
  OPS_RULE_OPERATORS,
  OPS_RULE_SEVERITIES,
  operatorSymbol,
  type OpsRuleDTO,
  type OpsRuleMetric,
  type OpsRuleOperator,
  type OpsRuleSeverity,
} from '@/lib/opsRules'

type Props = {
  rules: OpsRuleDTO[]
  surveys: Array<{ id: string; title: string }>
  onCreate: (input: {
    name: string
    metric: OpsRuleMetric
    operator: OpsRuleOperator
    threshold: number
    severity: OpsRuleSeverity
    enabled: boolean
    surveyId: string | null
  }) => Promise<{ ok: boolean; error?: string; rule?: OpsRuleDTO }>
  onPatch: (id: string, patch: Partial<OpsRuleDTO>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  busy?: boolean
}

export default function OpsRulesPanel({
  rules,
  surveys,
  onCreate,
  onPatch,
  onDelete,
  busy,
}: Props) {
  // Open by default so saved rules are visible immediately.
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('Custom rule')
  const [metric, setMetric] = useState<OpsRuleMetric>('readiness')
  const [operator, setOperator] = useState<OpsRuleOperator>('LT')
  const [threshold, setThreshold] = useState(6)
  const [severity, setSeverity] = useState<OpsRuleSeverity>('ALERT')
  const [surveyId, setSurveyId] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const metricMeta = useMemo(
    () => OPS_RULE_METRICS.find((m) => m.id === metric),
    [metric],
  )

  useEffect(() => {
    if (!flashId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-rule-id="${flashId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [flashId, rules.length])

  const submit = async () => {
    setFormError(null)
    const result = await onCreate({
      name,
      metric,
      operator,
      threshold,
      severity,
      enabled: true,
      surveyId: surveyId || null,
    })
    if (!result.ok) {
      setFormError(result.error || 'Could not save rule')
      return
    }
    if (result.rule?.id) setFlashId(result.rule.id)
    setName('Custom rule')
  }

  return (
    <section className="ops-rules">
      <header className="ops-rules-head">
        <div>
          <h3>
            <ShieldAlert className="h-4 w-4" />
            Intervention rules
          </h3>
          <p>
            Set your own thresholds — e.g. flag readiness &lt; 4 or &lt; 6. Each club decides
            what counts as risk. Saved rules appear in the list below; when they fire for a
            player, they show under Interventions.
          </p>
        </div>
        <button
          type="button"
          className="ops-rules-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Manage rules'}
        </button>
      </header>

      {!open ? (
        <div className="ops-rules-summary">
          {rules.filter((r) => r.enabled).length} active / {rules.length} total
        </div>
      ) : (
        <>
          <div className="ops-rules-section-label">
            Saved rules ({rules.length})
          </div>

          {rules.length === 0 ? (
            <div className="ops-rules-empty">
              No saved rules yet. Use <strong>Add rule</strong> below — your rule will show up
              here right away.
            </div>
          ) : (
            <ul className="ops-rules-list" ref={listRef}>
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  data-rule-id={rule.id}
                  className={`ops-rules-item${rule.enabled ? '' : ' is-off'}${
                    flashId === rule.id ? ' is-flash' : ''
                  }`}
                >
                  <label className="ops-rules-enable">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      disabled={busy}
                      onChange={(e) => onPatch(rule.id, { enabled: e.target.checked })}
                    />
                  </label>
                  <div className="ops-rules-fields">
                    <input
                      className="ops-rules-name"
                      defaultValue={rule.name}
                      key={`${rule.id}-${rule.name}`}
                      disabled={busy}
                      onBlur={(e) => {
                        const next = e.target.value.trim()
                        if (next && next !== rule.name) onPatch(rule.id, { name: next })
                      }}
                    />
                    <div className="ops-rules-row">
                      <select
                        value={rule.metric}
                        disabled={busy}
                        onChange={(e) =>
                          onPatch(rule.id, { metric: e.target.value as OpsRuleMetric })
                        }
                      >
                        {OPS_RULE_METRICS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={rule.operator}
                        disabled={busy}
                        onChange={(e) =>
                          onPatch(rule.id, { operator: e.target.value as OpsRuleOperator })
                        }
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
                        value={rule.threshold}
                        disabled={busy}
                        onChange={(e) =>
                          onPatch(rule.id, { threshold: Number(e.target.value) })
                        }
                      />
                      <select
                        value={rule.severity}
                        disabled={busy}
                        onChange={(e) =>
                          onPatch(rule.id, { severity: e.target.value as OpsRuleSeverity })
                        }
                      >
                        {OPS_RULE_SEVERITIES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <small>
                      If {rule.metric} {operatorSymbol(rule.operator)} {rule.threshold} →{' '}
                      {rule.severity}
                      {rule.surveyId ? ` · survey-limited` : ' · all surveys'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="ops-rules-del"
                    disabled={busy}
                    aria-label="Delete rule"
                    onClick={() => onDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ops-rules-create">
            <strong>Add rule</strong>
            <div className="ops-rules-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rule name"
              />
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as OpsRuleMetric)}
              >
                {OPS_RULE_METRICS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as OpsRuleOperator)}
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
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as OpsRuleSeverity)}
              >
                {OPS_RULE_SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
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
              <button
                type="button"
                className="ops-rules-add"
                disabled={busy}
                onClick={() => void submit()}
              >
                <Plus className="h-4 w-4" />
                Add rule
              </button>
            </div>
            {metricMeta ? <small>{metricMeta.hint}</small> : null}
            {formError ? <p className="ops-rules-error">{formError}</p> : null}
          </div>
        </>
      )}
    </section>
  )
}
