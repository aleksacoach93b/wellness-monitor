'use client'

import Image from 'next/image'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function MetricBlock({
  label,
  value,
  color,
  higherIsWorse,
}: {
  label: string
  value: number | null
  color: string
  higherIsWorse?: boolean
}) {
  const pct =
    value == null
      ? 0
      : higherIsWorse
        ? Math.round(Math.min(100, Math.max(0, (10 - value) * 10)))
        : Math.round(Math.min(100, Math.max(0, value * 10)))

  return (
    <div className="ops-metric-block">
      <div className="ops-metric-block-top">
        <span>{label}</span>
        <b style={{ color: value == null ? '#64748b' : color }}>{fmt(value)}</b>
      </div>
      <div className="ops-t-bar ops-t-bar-lg">
        <i
          style={{
            width: `${pct}%`,
            background: value == null ? '#334155' : color,
            boxShadow: value == null ? 'none' : `0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  )
}

export default function OpsWellnessTable({ players }: { players: OpsPlayerCard[] }) {
  const rows = [...players].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? -1 : 1
    const ar = a.wellness?.readiness ?? -1
    const br = b.wellness?.readiness ?? -1
    if (ar !== br) return ar - br
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
  })

  return (
    <div className="ops-roster">
      <div className="ops-roster-head">
        <div>
          <p className="ops-board-kicker">Daily scores</p>
          <h3 className="ops-board-title">Athlete readiness board</h3>
        </div>
        <p className="ops-roster-hint">Sorted by lowest readiness first — scan risks fast.</p>
      </div>

      <div className="ops-roster-list">
        {rows.map((p, idx) => {
          const w = p.wellness
          const name = `${p.firstName} ${p.lastName}`
          const initials =
            `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?'
          const pending = p.status === 'pending' || !w

          return (
            <article
              key={p.id}
              className={`ops-roster-card ${pending ? 'is-pending' : ''} ${
                w?.statusText === 'ALERT' ? 'is-alert' : ''
              }`}
              style={{ animationDelay: `${Math.min(idx, 14) * 35}ms` }}
            >
              <div className="ops-roster-identity">
                <div className="ops-t-avatar ops-t-avatar-lg">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                      className="ops-t-avatar-img"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="ops-roster-name">{name}</h4>
                  <p className="ops-roster-sub">
                    {p.rank != null ? `#${p.rank}` : 'Unranked'}
                    {p.submittedAt
                      ? ` · ${new Date(p.submittedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ' · waiting'}
                  </p>
                  {pending ? (
                    <span className="ops-pill" style={{ color: '#facc15', borderColor: '#facc15' }}>
                      PENDING
                    </span>
                  ) : (
                    <span
                      className="ops-pill"
                      style={{ color: w!.statusColor, borderColor: w!.statusColor }}
                    >
                      {w!.statusText}
                    </span>
                  )}
                </div>
              </div>

              <div className="ops-roster-ready">
                {w ? (
                  <>
                    <div
                      className="ops-ready-hero"
                      style={
                        {
                          '--ready': `${w.readinessPct}%`,
                          '--accent': w.readinessColor,
                        } as React.CSSProperties
                      }
                    >
                      <b>{w.readinessPct}%</b>
                    </div>
                    <div>
                      <p className="ops-ready-label" style={{ color: w.readinessColor }}>
                        {w.readinessLabel}
                      </p>
                      <p className="ops-ready-hint">{w.readinessHint}</p>
                    </div>
                  </>
                ) : (
                  <p className="ops-t-muted">No check-in yet</p>
                )}
              </div>

              <div className="ops-roster-metrics">
                <MetricBlock
                  label="Fatigue"
                  value={w?.fatigue.value ?? null}
                  color={w?.fatigue.color ?? '#64748b'}
                  higherIsWorse
                />
                <MetricBlock
                  label="Soreness"
                  value={w?.soreness.value ?? null}
                  color={w?.soreness.color ?? '#64748b'}
                  higherIsWorse
                />
                <MetricBlock
                  label="Sleep"
                  value={w?.sleepQuality.value ?? null}
                  color={w?.sleepQuality.color ?? '#64748b'}
                />
                <MetricBlock
                  label="Mood"
                  value={w?.mood.value ?? null}
                  color={w?.mood.color ?? '#64748b'}
                />
              </div>

              <div className="ops-roster-aside">
                <div className="ops-aside-box">
                  <span>Fatigue Δ</span>
                  <strong style={{ color: w?.fatigueDeltaColor ?? '#94a3b8' }}>
                    {w?.fatigueDeltaText ?? 'N/A'}
                  </strong>
                </div>
                <div className="ops-aside-box">
                  <span>Sleep window</span>
                  <strong>
                    {w ? `${w.sleepBedtime ?? '—'} → ${w.sleepWake ?? '—'}` : '—'}
                  </strong>
                  <small>{w?.sleepDuration ?? 'Duration —'}</small>
                </div>
                <div className="ops-t-risk ops-t-risk-lg">
                  <span
                    className={`ops-dot${w?.risk.fatigue ? ' on' : ''}`}
                    style={{ ['--c' as string]: '#ef4444' }}
                    title="Fatigue"
                  />
                  <span
                    className={`ops-dot${w?.risk.soreness ? ' on' : ''}`}
                    style={{ ['--c' as string]: '#f97316' }}
                    title="Soreness"
                  />
                  <span
                    className={`ops-dot${w?.risk.sleep ? ' on' : ''}`}
                    style={{ ['--c' as string]: '#38bdf8' }}
                    title="Sleep"
                  />
                  <span
                    className={`ops-dot${w?.risk.pain ? ' on' : ''}`}
                    style={{ ['--c' as string]: w?.pain.flagColor ?? '#64748b' }}
                    title="Pain"
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
