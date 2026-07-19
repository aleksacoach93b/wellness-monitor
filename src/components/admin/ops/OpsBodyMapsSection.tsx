'use client'

import { useMemo, useState } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import BodyMap from '@/components/BodyMap'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'
import {
  getBodyMapLocationLabel,
  getBodyMapRating,
  type BodyMapAreaStored,
} from '@/lib/bodyMapPainLocation'
import { getMuscleName } from '@/lib/muscleNames'

type Kind = 'pain' | 'soreness'
type Band = 'all' | 'critical' | 'moderate' | 'low'

type Report = {
  playerId: string
  playerName: string
  areaId: string
  muscle: string
  rating: number
  location: string | null
  side: 'front' | 'back'
}

const noop = () => {}

function aggregate(players: OpsPlayerCard[], kind: Kind, view: 'front' | 'back') {
  const out: Record<string, number> = {}
  const who = new Set<string>()
  let sum = 0
  let count = 0
  const muscleHits = new Map<string, number>()

  for (const p of players) {
    const areas = kind === 'pain' ? p.wellness?.pain.areas : p.wellness?.sorenessMap.areas
    if (!areas) continue
    let hit = false
    for (const [areaId, stored] of Object.entries(areas)) {
      const rating = getBodyMapRating(stored)
      if (rating <= 0) continue
      const side = areaId.startsWith('path-') ? 'front' : 'back'
      if (side !== view) continue
      hit = true
      out[areaId] = Math.max(out[areaId] ?? 0, rating)
      sum += rating
      count += 1
      const muscle = getMuscleName(areaId)
      muscleHits.set(muscle, (muscleHits.get(muscle) ?? 0) + 1)
    }
    if (hit) who.add(p.id)
  }

  let mostCommon: string | null = null
  let mostHits = 0
  for (const [m, n] of muscleHits) {
    if (n > mostHits) {
      mostHits = n
      mostCommon = m
    }
  }

  return {
    areas: out as Record<string, BodyMapAreaStored>,
    zoneCount: Object.keys(out).length,
    athletes: who.size,
    avg: count ? sum / count : null,
    mostCommon,
  }
}

function buildReports(players: OpsPlayerCard[], kind: Kind): Report[] {
  const rows: Report[] = []
  for (const p of players) {
    if (!p.wellness) continue
    const areas = kind === 'pain' ? p.wellness.pain.areas : p.wellness.sorenessMap.areas
    for (const [areaId, stored] of Object.entries(areas)) {
      const rating = getBodyMapRating(stored)
      if (rating <= 0) continue
      rows.push({
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`.trim(),
        areaId,
        muscle: getMuscleName(areaId),
        rating,
        location: getBodyMapLocationLabel(stored),
        side: areaId.startsWith('path-') ? 'front' : 'back',
      })
    }
  }
  return rows.sort((a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName))
}

function bandOf(rating: number): Exclude<Band, 'all'> {
  if (rating >= 7) return 'critical'
  if (rating >= 4) return 'moderate'
  return 'low'
}

function scaleColor(rating: number) {
  if (rating >= 7) return '#ef4444'
  if (rating >= 4) return '#f97316'
  return '#22c55e'
}

function MapCard({
  title,
  kind,
  view,
  agg,
}: {
  title: string
  kind: Kind
  view: 'front' | 'back'
  agg: ReturnType<typeof aggregate>
}) {
  const isPain = kind === 'pain'
  return (
    <article className={`ops-bm-card ${isPain ? 'is-pain' : 'is-sore'}`}>
      <header className="ops-bm-card-head">
        <div className="ops-bm-card-title">
          {isPain ? (
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          ) : (
            <Activity className="h-4 w-4 text-amber-300" />
          )}
          <span>{title}</span>
        </div>
        <span className={`ops-bm-count ${isPain ? 'is-pain' : 'is-sore'}`}>
          {agg.zoneCount} areas
        </span>
      </header>

      <div className="ops-bm-visual">
        <BodyMap
          mode="preview"
          view={view}
          colorScheme="pain"
          selectedAreas={agg.areas}
          onAreaClick={noop}
          onViewChange={noop}
          onContinue={noop}
          onClose={noop}
        />
      </div>

      <div className="ops-bm-legend">
        <span>
          <i className="lg" /> Low (1-3)
        </span>
        <span>
          <i className="md" /> Moderate (4-6)
        </span>
        <span>
          <i className="hi" /> Critical (7-10)
        </span>
      </div>

      <footer className="ops-bm-foot">
        {agg.zoneCount === 0 ? (
          <span className="ops-t-muted">No reports</span>
        ) : (
          <>
            <span>
              <b>{agg.athletes}</b> athletes affected
            </span>
            <span>
              Most common: <b>{agg.mostCommon ?? '—'}</b>
            </span>
            <span>
              Avg intensity: <b>{agg.avg?.toFixed(1) ?? '—'}</b>
            </span>
          </>
        )}
      </footer>
    </article>
  )
}

function AreaTable({
  title,
  kind,
  reports,
}: {
  title: string
  kind: Kind
  reports: Report[]
}) {
  const [band, setBand] = useState<Band>('all')
  const filtered = useMemo(
    () => (band === 'all' ? reports : reports.filter((r) => bandOf(r.rating) === band)),
    [reports, band],
  )
  const avg = filtered.length
    ? filtered.reduce((s, r) => s + r.rating, 0) / filtered.length
    : null
  const highest = filtered[0] ?? null

  return (
    <article className="ops-area-card">
      <header className="ops-area-head">
        <div className="ops-bm-card-title">
          {kind === 'pain' ? (
            <AlertTriangle className="h-4 w-4 text-sky-400" />
          ) : (
            <Activity className="h-4 w-4 text-sky-400" />
          )}
          <span>{title}</span>
        </div>
        <div className="ops-area-filters">
          {(
            [
              ['all', 'All'],
              ['critical', 'Critical (7-10)'],
              ['moderate', 'Moderate (4-6)'],
              ['low', 'Low (1-3)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={band === key ? 'is-on' : ''}
              onClick={() => setBand(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="ops-area-empty">
          <Activity className="h-10 w-10 opacity-30" />
          <p>No {kind === 'pain' ? 'painful' : 'sore'} areas reported</p>
        </div>
      ) : (
        <div className="ops-area-table-wrap">
          <table className="ops-area-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Body part</th>
                <th>Scale</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.playerId}-${r.areaId}-${kind}`}>
                  <td>{r.playerName}</td>
                  <td>
                    <div className="ops-area-part">
                      <strong>{r.muscle}</strong>
                      <small>
                        {r.side.toUpperCase()}
                        {r.location ? ` · ${r.location}` : ''}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div className="ops-area-scale">
                      <div className="ops-load-bar">
                        <i
                          style={{
                            width: `${r.rating * 10}%`,
                            background: scaleColor(r.rating),
                          }}
                        />
                      </div>
                      <span>{r.rating}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="ops-area-foot">
        <span>
          Total: <b>{filtered.length}</b> areas
        </span>
        <span>
          Avg scale: <b>{avg?.toFixed(1) ?? '—'}</b>
        </span>
        <span>
          Highest: <b>{highest ? `${highest.rating} (${highest.muscle})` : '—'}</b>
        </span>
      </footer>
    </article>
  )
}

export default function OpsBodyMapsSection({ players }: { players: OpsPlayerCard[] }) {
  const done = useMemo(
    () => players.filter((p) => p.status === 'done' && p.wellness),
    [players],
  )
  const painFront = useMemo(() => aggregate(done, 'pain', 'front'), [done])
  const painBack = useMemo(() => aggregate(done, 'pain', 'back'), [done])
  const soreFront = useMemo(() => aggregate(done, 'soreness', 'front'), [done])
  const soreBack = useMemo(() => aggregate(done, 'soreness', 'back'), [done])
  const painReports = useMemo(() => buildReports(done, 'pain'), [done])
  const soreReports = useMemo(() => buildReports(done, 'soreness'), [done])

  return (
    <section className="ops-bm-section">
      <h3 className="ops-section-title">Body Maps</h3>

      <div className="ops-bm-grid">
        <MapCard title="Painful Areas — Front" kind="pain" view="front" agg={painFront} />
        <MapCard title="Sore Areas — Front" kind="soreness" view="front" agg={soreFront} />
        <MapCard title="Painful Areas — Back" kind="pain" view="back" agg={painBack} />
        <MapCard title="Sore Areas — Back" kind="soreness" view="back" agg={soreBack} />
      </div>

      <div className="ops-area-grid">
        <AreaTable title="Painful Areas" kind="pain" reports={painReports} />
        <AreaTable title="Sore Areas" kind="soreness" reports={soreReports} />
      </div>
    </section>
  )
}
