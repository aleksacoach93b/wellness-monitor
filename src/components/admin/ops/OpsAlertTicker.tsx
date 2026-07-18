'use client'

import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'

export type TickerItem = {
  id: string
  kind: 'fatigue' | 'pain' | 'soreness' | 'alert' | 'sleep' | 'delta'
  label: string
  detail: string
  color: string
}

function buildTickerItems(players: OpsPlayerCard[]): TickerItem[] {
  const done = players.filter((p) => p.status === 'done' && p.wellness)
  const items: TickerItem[] = []

  const byFatigue = [...done]
    .filter((p) => (p.wellness?.fatigue.value ?? 0) >= 6)
    .sort((a, b) => (b.wellness!.fatigue.value ?? 0) - (a.wellness!.fatigue.value ?? 0))
    .slice(0, 6)
  for (const p of byFatigue) {
    const v = p.wellness!.fatigue.value!
    items.push({
      id: `fat-${p.id}`,
      kind: 'fatigue',
      label: `${p.firstName} ${p.lastName}`,
      detail: `Fatigue ${v.toFixed(1)}`,
      color: p.wellness!.fatigue.color,
    })
  }

  const byPain = [...done]
    .filter((p) => p.wellness!.pain.hasData)
    .sort((a, b) => (b.wellness!.pain.max ?? 0) - (a.wellness!.pain.max ?? 0))
    .slice(0, 6)
  for (const p of byPain) {
    const w = p.wellness!
    items.push({
      id: `pain-${p.id}`,
      kind: 'pain',
      label: `${p.firstName} ${p.lastName}`,
      detail: `${w.pain.flagText}${w.pain.topArea ? ` · ${w.pain.topArea}` : ''}`,
      color: w.pain.flagColor,
    })
  }

  const bySore = [...done]
    .filter((p) => p.wellness!.sorenessMap.hasData || (p.wellness!.soreness.value ?? 0) >= 6)
    .sort((a, b) => {
      const as = b.wellness!.sorenessMap.max ?? b.wellness!.soreness.value ?? 0
      const bs = a.wellness!.sorenessMap.max ?? a.wellness!.soreness.value ?? 0
      return as - bs
    })
    .slice(0, 5)
  for (const p of bySore) {
    const w = p.wellness!
    const detail = w.sorenessMap.hasData
      ? `${w.sorenessMap.flagText}${w.sorenessMap.topArea ? ` · ${w.sorenessMap.topArea}` : ''}`
      : `Soreness ${(w.soreness.value ?? 0).toFixed(1)}`
    items.push({
      id: `sore-${p.id}`,
      kind: 'soreness',
      label: `${p.firstName} ${p.lastName}`,
      detail,
      color: w.sorenessMap.hasData ? w.sorenessMap.flagColor : w.soreness.color,
    })
  }

  const alerts = done.filter((p) => p.wellness!.statusText === 'ALERT').slice(0, 6)
  for (const p of alerts) {
    items.push({
      id: `alert-${p.id}`,
      kind: 'alert',
      label: `${p.firstName} ${p.lastName}`,
      detail: `ALERT · readiness ${p.wellness!.readinessPct}%`,
      color: '#ef4444',
    })
  }

  const sleepRisk = done
    .filter((p) => p.wellness!.risk.sleep)
    .sort((a, b) => (a.wellness!.sleepQuality.value ?? 10) - (b.wellness!.sleepQuality.value ?? 10))
    .slice(0, 4)
  for (const p of sleepRisk) {
    items.push({
      id: `sleep-${p.id}`,
      kind: 'sleep',
      label: `${p.firstName} ${p.lastName}`,
      detail: `Sleep ${(p.wellness!.sleepQuality.value ?? 0).toFixed(1)}`,
      color: '#38bdf8',
    })
  }

  const fatigueUp = done
    .filter((p) => (p.wellness!.fatigueDelta ?? 0) >= 0.5)
    .sort((a, b) => (b.wellness!.fatigueDelta ?? 0) - (a.wellness!.fatigueDelta ?? 0))
    .slice(0, 4)
  for (const p of fatigueUp) {
    items.push({
      id: `delta-${p.id}`,
      kind: 'delta',
      label: `${p.firstName} ${p.lastName}`,
      detail: `Fatigue Δ ${p.wellness!.fatigueDeltaText}`,
      color: p.wellness!.fatigueDeltaColor,
    })
  }

  return items
}

const KIND_LABEL: Record<TickerItem['kind'], string> = {
  fatigue: 'HIGH FATIGUE',
  pain: 'PAIN',
  soreness: 'SORENESS',
  alert: 'ALERT',
  sleep: 'SLEEP RISK',
  delta: 'FATIGUE ↑',
}

export default function OpsAlertTicker({ players }: { players: OpsPlayerCard[] }) {
  const items = buildTickerItems(players)

  if (items.length === 0) {
    return (
      <div className="ops-ticker ops-ticker-empty">
        <span className="ops-ticker-live">LIVE</span>
        <span className="ops-ticker-empty-text">
          No fatigue / pain / alert flags for this date — squad looks clean.
        </span>
      </div>
    )
  }

  // Duplicate for seamless marquee
  const loop = [...items, ...items]

  return (
    <div className="ops-ticker" aria-label="Priority athlete alerts">
      <div className="ops-ticker-rail">
        <span className="ops-ticker-live">LIVE</span>
        <span className="ops-ticker-title">PRIORITY FEED</span>
      </div>
      <div className="ops-ticker-viewport">
        <div className="ops-ticker-track">
          {loop.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="ops-ticker-chip"
              style={{ ['--chip' as string]: item.color }}
            >
              <em>{KIND_LABEL[item.kind]}</em>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
