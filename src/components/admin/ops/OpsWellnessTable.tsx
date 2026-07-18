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
  if (value == null) return <span className="ops-t-muted">—</span>
  const pct = higherIsWorse
    ? Math.round(Math.min(100, Math.max(0, (10 - value) * 10)))
    : Math.round(Math.min(100, Math.max(0, value * 10)))
  return (
    <div className="ops-cell-metric">
      <b style={{ color }}>{fmt(value)}</b>
      <div className="ops-cell-bar">
        <i style={{ width: `${pct}%`, background: color }} />
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
    <div className="ops-classic-shell">
      <div className="ops-classic-scroll">
        <table className="ops-classic">
          <thead>
            <tr>
              <th className="ops-sticky-col">Athlete</th>
              <th>Status</th>
              <th>Readiness</th>
              <th>Fatigue</th>
              <th>Soreness</th>
              <th>Sleep</th>
              <th>Mood</th>
              <th>Δ Fatigue</th>
              <th>Pain</th>
              <th>Soreness map</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const w = p.wellness
              const name = `${p.firstName} ${p.lastName}`
              const initials =
                `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?'
              const pending = p.status === 'pending' || !w
              const topPain = w?.pain.details[0]
              const topSore = w?.sorenessMap.details[0]

              return (
                <tr
                  key={p.id}
                  className={`${pending ? 'is-pending' : ''} ${
                    w?.statusText === 'ALERT' ? 'is-alert' : ''
                  }`}
                >
                  <td className="ops-sticky-col">
                    <div className="ops-cell-athlete">
                      <div className="ops-cell-avatar">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="ops-t-avatar-img"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="ops-cell-name">{name}</div>
                        <div className="ops-cell-sub">
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
                  </td>

                  <td>
                    {w ? (
                      <div className="ops-cell-ready">
                        <div
                          className="ops-cell-ring"
                          style={
                            {
                              '--ready': `${w.readinessPct}%`,
                              '--accent': w.readinessColor,
                            } as React.CSSProperties
                          }
                        >
                          <b>{w.readinessPct}</b>
                        </div>
                        <span style={{ color: w.readinessColor }}>{w.readinessLabel}</span>
                      </div>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>

                  <td>
                    <MetricCell
                      value={w?.fatigue.value ?? null}
                      color={w?.fatigue.color ?? '#64748b'}
                      higherIsWorse
                    />
                  </td>
                  <td>
                    <MetricCell
                      value={w?.soreness.value ?? null}
                      color={w?.soreness.color ?? '#64748b'}
                      higherIsWorse
                    />
                  </td>
                  <td>
                    <MetricCell
                      value={w?.sleepQuality.value ?? null}
                      color={w?.sleepQuality.color ?? '#64748b'}
                    />
                  </td>
                  <td>
                    <MetricCell
                      value={w?.mood.value ?? null}
                      color={w?.mood.color ?? '#64748b'}
                    />
                  </td>

                  <td>
                    <span
                      className="ops-cell-delta"
                      style={{ color: w?.fatigueDeltaColor ?? '#94a3b8' }}
                    >
                      {w?.fatigueDeltaText ?? '—'}
                    </span>
                  </td>

                  <td>
                    {w?.pain.hasData ? (
                      <div className="ops-cell-zone">
                        <span
                          className="ops-pill"
                          style={{ color: w.pain.flagColor, borderColor: w.pain.flagColor }}
                        >
                          {w.pain.max}/10
                        </span>
                        <small title={topPain?.when.join(', ')}>
                          {topPain?.muscle ?? w.pain.topArea}
                          {topPain?.location ? ` · ${topPain.location}` : ''}
                        </small>
                      </div>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>

                  <td>
                    {w?.sorenessMap.hasData ? (
                      <div className="ops-cell-zone">
                        <span
                          className="ops-pill"
                          style={{
                            color: w.sorenessMap.flagColor,
                            borderColor: w.sorenessMap.flagColor,
                          }}
                        >
                          {w.sorenessMap.max}/10
                        </span>
                        <small title={topSore?.when.join(', ')}>
                          {topSore?.muscle ?? w.sorenessMap.topArea}
                          {topSore?.location ? ` · ${topSore.location}` : ''}
                        </small>
                      </div>
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
