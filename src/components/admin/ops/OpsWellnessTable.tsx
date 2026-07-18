'use client'

import Image from 'next/image'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function MetricCell({
  value,
  color,
  higherIsWorse,
}: {
  value: number | null
  color: string
  higherIsWorse?: boolean
}) {
  if (value == null) {
    return <span className="ops-t-muted">—</span>
  }
  const pct = higherIsWorse
    ? Math.round(Math.min(100, Math.max(0, (10 - value) * 10)))
    : Math.round(Math.min(100, Math.max(0, value * 10)))
  return (
    <div className="ops-t-metric">
      <div className="ops-t-metric-top">
        <b style={{ color }}>{fmt(value)}</b>
      </div>
      <div className="ops-t-bar">
        <i style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  )
}

export default function OpsWellnessTable({ players }: { players: OpsPlayerCard[] }) {
  const rows = [...players].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? -1 : 1
    const ar = a.wellness?.readiness ?? -1
    const br = b.wellness?.readiness ?? -1
    if (ar !== br) return ar - br // worst readiness first for speed
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
  })

  return (
    <div className="ops-table-shell">
      <div className="ops-table-scroll">
        <table className="ops-table">
          <thead>
            <tr>
              <th className="ops-th-sticky">Athlete</th>
              <th>Status</th>
              <th>Readiness</th>
              <th>Fatigue</th>
              <th>Soreness</th>
              <th>Sleep</th>
              <th>Mood</th>
              <th>Δ Fatigue</th>
              <th>Pain</th>
              <th>Soreness map</th>
              <th>Top issue</th>
              <th>When</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, idx) => {
              const w = p.wellness
              const name = `${p.firstName} ${p.lastName}`
              const initials =
                `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?'
              const topPain = w?.pain.details[0]
              const topSore = w?.sorenessMap.details[0]
              const topIssue = topPain ?? topSore
              const whenText = topIssue?.whenSummary ?? topIssue?.when.slice(0, 2).join(', ')

              return (
                <tr
                  key={p.id}
                  className={`ops-tr ${p.status === 'pending' ? 'is-pending' : ''} ${
                    w?.statusText === 'ALERT' ? 'is-alert' : ''
                  }`}
                  style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                >
                  <td className="ops-td-athlete ops-th-sticky">
                    <div className="ops-t-athlete">
                      <div className="ops-t-avatar">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="ops-t-avatar-img"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="ops-t-name">{name}</div>
                        <div className="ops-t-sub">
                          {p.rank != null ? `#${p.rank}` : '—'}
                          {p.submittedAt
                            ? ` · ${new Date(p.submittedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ' · pending'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.status === 'pending' || !w ? (
                      <span className="ops-pill" style={{ color: '#facc15', borderColor: '#facc15' }}>
                        PENDING
                      </span>
                    ) : (
                      <span
                        className="ops-pill"
                        style={{ color: w.statusColor, borderColor: w.statusColor }}
                      >
                        {w.statusText}
                      </span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <div className="ops-t-ready">
                        <div
                          className="ops-t-ready-ring"
                          style={
                            {
                              '--ready': `${w.readinessPct}%`,
                              '--accent': w.readinessColor,
                            } as React.CSSProperties
                          }
                        >
                          <b>{w.readinessPct}%</b>
                        </div>
                        <span style={{ color: w.readinessColor }}>{w.readinessLabel}</span>
                      </div>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <MetricCell
                        value={w.fatigue.value}
                        color={w.fatigue.color}
                        higherIsWorse
                      />
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <MetricCell
                        value={w.soreness.value}
                        color={w.soreness.color}
                        higherIsWorse
                      />
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <MetricCell value={w.sleepQuality.value} color={w.sleepQuality.color} />
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <MetricCell value={w.mood.value} color={w.mood.color} />
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <span className="ops-t-delta" style={{ color: w.fatigueDeltaColor }}>
                        {w.fatigueDeltaText}
                      </span>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w?.pain.hasData ? (
                      <div className="ops-t-flag-stack">
                        <span
                          className="ops-pill"
                          style={{ color: w.pain.flagColor, borderColor: w.pain.flagColor }}
                        >
                          {w.pain.flagText}
                        </span>
                        <small>
                          max {w.pain.max} · {w.pain.zones}z
                        </small>
                      </div>
                    ) : (
                      <span className="ops-t-muted">No pain</span>
                    )}
                  </td>
                  <td>
                    {w?.sorenessMap.hasData ? (
                      <div className="ops-t-flag-stack">
                        <span
                          className="ops-pill"
                          style={{
                            color: w.sorenessMap.flagColor,
                            borderColor: w.sorenessMap.flagColor,
                          }}
                        >
                          {w.sorenessMap.flagText}
                        </span>
                        <small>
                          max {w.sorenessMap.max} · {w.sorenessMap.zones}z
                        </small>
                      </div>
                    ) : (
                      <span className="ops-t-muted">No map</span>
                    )}
                  </td>
                  <td>
                    {topIssue ? (
                      <div className="ops-t-issue">
                        <strong>{topIssue.muscle}</strong>
                        <small>
                          {topIssue.side.toUpperCase()}
                          {topIssue.location ? ` · ${topIssue.location}` : ''}
                          {` · ${topIssue.rating}/10`}
                        </small>
                      </div>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {whenText ? (
                      <span className="ops-t-when" title={topIssue?.when.join(', ')}>
                        {whenText}
                      </span>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    {w ? (
                      <div className="ops-t-risk">
                        <span
                          className={`ops-dot${w.risk.fatigue ? ' on' : ''}`}
                          style={{ ['--c' as string]: '#ef4444' }}
                          title="Fatigue"
                        />
                        <span
                          className={`ops-dot${w.risk.soreness ? ' on' : ''}`}
                          style={{ ['--c' as string]: '#f97316' }}
                          title="Soreness"
                        />
                        <span
                          className={`ops-dot${w.risk.sleep ? ' on' : ''}`}
                          style={{ ['--c' as string]: '#38bdf8' }}
                          title="Sleep"
                        />
                        <span
                          className={`ops-dot${w.risk.pain ? ' on' : ''}`}
                          style={{ ['--c' as string]: w.pain.flagColor }}
                          title="Pain"
                        />
                      </div>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
