'use client'

import Image from 'next/image'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function timeShort(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function LoadCell({
  value,
  color,
  higherIsWorse,
}: {
  value: number | null
  color: string
  higherIsWorse?: boolean
}) {
  if (value == null) return <span className="ops-t-muted">—</span>
  // Reference app shows fuller bar as "better" green for high wellness scores;
  // for fatigue/soreness higher is worse — still show fill by raw value/10 for scan speed.
  const pct = Math.round(Math.min(100, Math.max(8, value * 10)))
  const barColor = higherIsWorse
    ? value >= 7
      ? '#ef4444'
      : value >= 4
        ? '#f97316'
        : '#22c55e'
    : color
  return (
    <div className="ops-load-cell">
      <div className="ops-load-bar">
        <i style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <b style={{ color: barColor }}>{fmt(value, 0)}</b>
    </div>
  )
}

function statusBadge(w: OpsPlayerCard['wellness'], pending: boolean) {
  if (pending || !w) {
    return (
      <span className="ops-badge is-warn">
        <em>!</em> Pending
      </span>
    )
  }
  if (w.statusText === 'ALERT') {
    return (
      <span className="ops-badge is-danger">
        <em>!</em> Attention
      </span>
    )
  }
  if (w.statusText === 'WATCH') {
    return (
      <span className="ops-badge is-warn">
        <em>!</em> Watch
      </span>
    )
  }
  return (
    <span className="ops-badge is-ok">
      <em>✓</em> Stable
    </span>
  )
}

export default function OpsWellnessTable({ players }: { players: OpsPlayerCard[] }) {
  const rows = [...players].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? -1 : 1
    const ar = a.wellness?.readiness ?? -1
    const br = b.wellness?.readiness ?? -1
    if (ar !== br) return br - ar
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
  })

  return (
    <div className="ops-classic-shell">
      <div className="ops-classic-scroll">
        <table className="ops-classic ops-classic-grouped">
          <thead>
            <tr className="ops-group-row">
              <th colSpan={3}>Identity &amp; status</th>
              <th colSpan={4}>Sleep stats</th>
              <th colSpan={4}>Wellness load</th>
              <th colSpan={1}>Readiness</th>
            </tr>
            <tr className="ops-col-row">
              <th className="ops-sticky-col">Athlete</th>
              <th>Performance</th>
              <th>Submitted</th>
              <th>Bed</th>
              <th>Wake</th>
              <th>Duration</th>
              <th>Quality</th>
              <th>Fatigue</th>
              <th>Mood</th>
              <th>Sleep risk</th>
              <th>Soreness</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const w = p.wellness
              const pending = p.status === 'pending' || !w
              const name = `${p.firstName} ${p.lastName}`
              const initials =
                `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?'
              const durationColor =
                !w?.sleepDuration || w.sleepDuration === '-'
                  ? '#94a3b8'
                  : /^(9|1\d)/.test(w.sleepDuration)
                    ? '#22c55e'
                    : /^(7|8)/.test(w.sleepDuration)
                      ? '#facc15'
                      : '#ef4444'

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
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{statusBadge(w, pending)}</td>
                  <td className="ops-mono">{timeShort(p.submittedAt)}</td>
                  <td className="ops-mono">{w?.sleepBedtime ?? '—'}</td>
                  <td className="ops-mono">{w?.sleepWake ?? '—'}</td>
                  <td>
                    <span style={{ color: durationColor, fontWeight: 750 }}>
                      {w?.sleepDuration ?? '—'}
                    </span>
                  </td>
                  <td>
                    <LoadCell
                      value={w?.sleepQuality.value ?? null}
                      color={w?.sleepQuality.color ?? '#64748b'}
                    />
                  </td>
                  <td>
                    <LoadCell
                      value={w?.fatigue.value ?? null}
                      color={w?.fatigue.color ?? '#64748b'}
                      higherIsWorse
                    />
                  </td>
                  <td>
                    <LoadCell
                      value={w?.mood.value ?? null}
                      color={w?.mood.color ?? '#64748b'}
                    />
                  </td>
                  <td>
                    {w ? (
                      <span
                        className={`ops-badge ${w.risk.sleep ? 'is-warn' : 'is-ok'}`}
                      >
                        {w.risk.sleep ? 'Attention' : 'Stable'}
                      </span>
                    ) : (
                      <span className="ops-t-muted">—</span>
                    )}
                  </td>
                  <td>
                    <LoadCell
                      value={w?.soreness.value ?? null}
                      color={w?.soreness.color ?? '#64748b'}
                      higherIsWorse
                    />
                  </td>
                  <td>
                    {w?.readiness != null ? (
                      <span
                        className="ops-ready-score"
                        style={{ color: w.readinessColor }}
                      >
                        {w.readiness.toFixed(1)}
                      </span>
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
