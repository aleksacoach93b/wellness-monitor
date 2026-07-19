'use client'

import Image from 'next/image'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'
import {
  DEFAULT_OPS_COLUMNS,
  enabledColumns,
  groupSpans,
  headerLabel,
  type OpsColumnConfig,
  type OpsColumnId,
} from '@/lib/opsTableColumns'

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

/** 1 = worst (red), 10 = best (green) — all wellness 1–10 scales. */
function scaleColor(value: number) {
  if (value < 3) return '#ef4444'
  if (value < 5) return '#f97316'
  if (value < 7) return '#facc15'
  if (value < 9) return '#84cc16'
  return '#22c55e'
}

function LoadCell({ value }: { value: number | null }) {
  if (value == null) return <span className="ops-t-muted">—</span>
  const pct = Math.round(Math.min(100, Math.max(8, value * 10)))
  const barColor = scaleColor(value)
  return (
    <div className="ops-load-cell">
      <div className="ops-load-bar">
        <i style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <b style={{ color: barColor }}>{fmt(value, 0)}</b>
    </div>
  )
}

function durationHours(text: string | null | undefined): number | null {
  if (!text || text === '-' || text === '—') return null
  const hm = text.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i)
  if (hm) {
    const h = Number(hm[1])
    const m = Number(hm[2] ?? 0)
    if (!Number.isFinite(h)) return null
    return h + (Number.isFinite(m) ? m / 60 : 0)
  }
  const n = Number(String(text).replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function durationColor(text: string | null | undefined): string {
  const h = durationHours(text)
  if (h == null) return '#94a3b8'
  if (h >= 9) return '#22c55e'
  if (h >= 7) return '#facc15'
  return '#ef4444'
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

function renderCell(id: OpsColumnId, p: OpsPlayerCard) {
  const w = p.wellness
  const pending = p.status === 'pending' || !w
  const name = `${p.firstName} ${p.lastName}`
  const initials =
    `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  switch (id) {
    case 'athlete':
      return (
        <td key={id} className="ops-sticky-col">
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
              <div className="ops-cell-sub">{p.rank != null ? `#${p.rank}` : '—'}</div>
            </div>
          </div>
        </td>
      )
    case 'performance':
      return <td key={id}>{statusBadge(w, pending)}</td>
    case 'submitted':
      return (
        <td key={id} className="ops-mono">
          {timeShort(p.submittedAt)}
        </td>
      )
    case 'bed':
      return (
        <td key={id} className="ops-mono">
          {w?.sleepBedtime ?? '—'}
        </td>
      )
    case 'wake':
      return (
        <td key={id} className="ops-mono">
          {w?.sleepWake ?? '—'}
        </td>
      )
    case 'duration':
      return (
        <td key={id}>
          <span style={{ color: durationColor(w?.sleepDuration), fontWeight: 650 }}>
            {w?.sleepDuration ?? '—'}
          </span>
        </td>
      )
    case 'quality':
      return (
        <td key={id}>
          <LoadCell value={w?.sleepQuality.value ?? null} />
        </td>
      )
    case 'sleepRisk':
      return (
        <td key={id}>
          {w ? (
            <span className={`ops-badge ${w.risk.sleep ? 'is-warn' : 'is-ok'}`}>
              {w.risk.sleep ? 'Attention' : 'Stable'}
            </span>
          ) : (
            <span className="ops-t-muted">—</span>
          )}
        </td>
      )
    case 'fatigue':
      return (
        <td key={id}>
          <LoadCell value={w?.fatigue.value ?? null} />
        </td>
      )
    case 'soreness':
      return (
        <td key={id}>
          <LoadCell value={w?.soreness.value ?? null} />
        </td>
      )
    case 'mood':
      return (
        <td key={id}>
          <LoadCell value={w?.mood.value ?? null} />
        </td>
      )
    case 'stress':
      return (
        <td key={id}>
          <LoadCell value={w?.stress.value ?? null} />
        </td>
      )
    case 'readiness':
      return (
        <td key={id}>
          {w?.readiness != null ? (
            <span className="ops-ready-score" style={{ color: w.readinessColor }}>
              {w.readiness.toFixed(1)}
            </span>
          ) : (
            <span className="ops-t-muted">—</span>
          )}
        </td>
      )
    default:
      return (
        <td key={id}>
          <span className="ops-t-muted">—</span>
        </td>
      )
  }
}

export type OpsMetricColumn = {
  key: string
  name: string
}

function DerivedCell({
  value,
  color,
}: {
  value: number | null
  color: string | null
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="ops-t-muted">—</span>
  }
  const display = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return (
    <span className="ops-derived-val" style={{ color: color || '#e2e8f0' }}>
      {display}
    </span>
  )
}

export default function OpsWellnessTable({
  players,
  columns = DEFAULT_OPS_COLUMNS,
  metricColumns = [],
}: {
  players: OpsPlayerCard[]
  columns?: OpsColumnConfig[]
  /** Custom derived metrics with showInTable */
  metricColumns?: OpsMetricColumn[]
}) {
  const visible = enabledColumns(columns)
  const spans = groupSpans(visible)
  if (metricColumns.length) {
    spans.push({ group: 'Custom metrics', span: metricColumns.length })
  }

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
              {spans.map((s) => (
                <th key={`${s.group}-${s.span}`} colSpan={s.span}>
                  {s.group}
                </th>
              ))}
            </tr>
            <tr className="ops-col-row">
              {visible.map((col) => (
                <th
                  key={col.id}
                  className={col.id === 'athlete' ? 'ops-sticky-col' : undefined}
                  title={headerLabel(col)}
                >
                  {headerLabel(col)}
                </th>
              ))}
              {metricColumns.map((col) => (
                <th key={`m-${col.key}`} title={col.name}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const w = p.wellness
              const pending = p.status === 'pending' || !w
              const derivedByKey = new Map((p.derived ?? []).map((d) => [d.key, d]))
              return (
                <tr
                  key={p.id}
                  className={`${pending ? 'is-pending' : ''} ${
                    w?.statusText === 'ALERT' ? 'is-alert' : ''
                  }`}
                >
                  {visible.map((col) => renderCell(col.id, p))}
                  {metricColumns.map((col) => {
                    const cell = derivedByKey.get(col.key)
                    return (
                      <td key={`m-${col.key}`}>
                        <DerivedCell
                          value={cell?.value ?? null}
                          color={cell?.color ?? null}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
