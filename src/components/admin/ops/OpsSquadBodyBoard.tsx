'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import BodyMap from '@/components/BodyMap'
import type { OpsPlayerCard } from '@/components/admin/ops/WellnessFlipCard'
import {
  getBodyMapLocationLabel,
  getBodyMapRating,
  getBodyMapWhenLabels,
  type BodyMapAreaStored,
} from '@/lib/bodyMapPainLocation'
import { getMuscleName } from '@/lib/muscleNames'

type Kind = 'pain' | 'soreness'
type View = 'front' | 'back'

type ZoneReport = {
  playerId: string
  playerName: string
  image: string | null
  kind: Kind
  areaId: string
  muscle: string
  rating: number
  location: string | null
  when: string[]
  side: View
}

const noop = () => {}

function isFront(areaId: string) {
  return areaId.startsWith('path-')
}

function aggregateAreas(players: OpsPlayerCard[], kind: Kind): Record<string, BodyMapAreaStored> {
  const out: Record<string, number> = {}
  for (const p of players) {
    const map = kind === 'pain' ? p.wellness?.pain.areas : p.wellness?.sorenessMap.areas
    if (!map) continue
    for (const [areaId, stored] of Object.entries(map)) {
      const rating = getBodyMapRating(stored)
      if (rating <= 0) continue
      out[areaId] = Math.max(out[areaId] ?? 0, rating)
    }
  }
  return out
}

function buildReports(players: OpsPlayerCard[]): ZoneReport[] {
  const rows: ZoneReport[] = []
  for (const p of players) {
    if (!p.wellness) continue
    const name = `${p.firstName} ${p.lastName}`.trim()
    const packs: Array<{ kind: Kind; areas: Record<string, BodyMapAreaStored> }> = [
      { kind: 'pain', areas: p.wellness.pain.areas },
      { kind: 'soreness', areas: p.wellness.sorenessMap.areas },
    ]
    for (const pack of packs) {
      for (const [areaId, stored] of Object.entries(pack.areas)) {
        const rating = getBodyMapRating(stored)
        if (rating <= 0) continue
        rows.push({
          playerId: p.id,
          playerName: name,
          image: p.image,
          kind: pack.kind,
          areaId,
          muscle: getMuscleName(areaId),
          rating,
          location: getBodyMapLocationLabel(stored),
          when: getBodyMapWhenLabels(stored),
          side: isFront(areaId) ? 'front' : 'back',
        })
      }
    }
  }
  return rows.sort((a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName))
}

function MapPanel({
  title,
  subtitle,
  kind,
  view,
  areas,
  active,
  onClick,
}: {
  title: string
  subtitle: string
  kind: Kind
  view: View
  areas: Record<string, BodyMapAreaStored>
  active: boolean
  onClick: () => void
}) {
  const zoneCount = Object.values(areas).filter((v) => getBodyMapRating(v) > 0).length
  return (
    <button
      type="button"
      className={`ops-map-panel ${kind === 'pain' ? 'is-pain' : 'is-sore'} ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <div className="ops-map-panel-head">
        <div>
          <p className="ops-map-kicker">{title}</p>
          <p className="ops-map-sub">{subtitle}</p>
        </div>
        <span className="ops-map-count">{zoneCount} zones</span>
      </div>
      <div className="ops-map-panel-body">
        <BodyMap
          mode="preview"
          view={view}
          colorScheme={kind === 'pain' ? 'pain' : 'soreness'}
          selectedAreas={areas}
          onAreaClick={noop}
          onViewChange={noop}
          onContinue={noop}
          onClose={noop}
        />
      </div>
    </button>
  )
}

export default function OpsSquadBodyBoard({ players }: { players: OpsPlayerCard[] }) {
  const done = useMemo(
    () => players.filter((p) => p.status === 'done' && p.wellness),
    [players],
  )
  const painAreas = useMemo(() => aggregateAreas(done, 'pain'), [done])
  const soreAreas = useMemo(() => aggregateAreas(done, 'soreness'), [done])
  const reports = useMemo(() => buildReports(done), [done])

  const [filter, setFilter] = useState<'all' | Kind | View | `${Kind}-${View}`>('all')

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter === 'all') return true
      if (filter === 'pain' || filter === 'soreness') return r.kind === filter
      if (filter === 'front' || filter === 'back') return r.side === filter
      const [kind, view] = filter.split('-') as [Kind, View]
      return r.kind === kind && r.side === view
    })
  }, [reports, filter])

  return (
    <section className="ops-board">
      <header className="ops-board-head">
        <div>
          <p className="ops-board-kicker">Squad body intelligence</p>
          <h3 className="ops-board-title">Pain &amp; Soreness maps</h3>
          <p className="ops-board-copy">
            Four live visuals — max intensity across the squad for each zone. Tap a map to filter
            the list below.
          </p>
        </div>
        <div className="ops-board-stats">
          <div>
            <small>Pain reports</small>
            <strong>{reports.filter((r) => r.kind === 'pain').length}</strong>
          </div>
          <div>
            <small>Soreness reports</small>
            <strong>{reports.filter((r) => r.kind === 'soreness').length}</strong>
          </div>
          <div>
            <small>Athletes flagged</small>
            <strong>{new Set(reports.map((r) => r.playerId)).size}</strong>
          </div>
        </div>
      </header>

      <div className="ops-map-grid">
        <MapPanel
          title="PAIN · FRONT"
          subtitle="Anterior body"
          kind="pain"
          view="front"
          areas={painAreas}
          active={filter === 'pain-front'}
          onClick={() => setFilter((f) => (f === 'pain-front' ? 'all' : 'pain-front'))}
        />
        <MapPanel
          title="PAIN · BACK"
          subtitle="Posterior body"
          kind="pain"
          view="back"
          areas={painAreas}
          active={filter === 'pain-back'}
          onClick={() => setFilter((f) => (f === 'pain-back' ? 'all' : 'pain-back'))}
        />
        <MapPanel
          title="SORENESS · FRONT"
          subtitle="Anterior body"
          kind="soreness"
          view="front"
          areas={soreAreas}
          active={filter === 'soreness-front'}
          onClick={() => setFilter((f) => (f === 'soreness-front' ? 'all' : 'soreness-front'))}
        />
        <MapPanel
          title="SORENESS · BACK"
          subtitle="Posterior body"
          kind="soreness"
          view="back"
          areas={soreAreas}
          active={filter === 'soreness-back'}
          onClick={() => setFilter((f) => (f === 'soreness-back' ? 'all' : 'soreness-back'))}
        />
      </div>

      <div className="ops-report-block">
        <div className="ops-report-head">
          <div>
            <p className="ops-board-kicker">Marked by athletes</p>
            <h4 className="ops-report-title">Who reported what</h4>
          </div>
          <div className="ops-report-filters">
            {(
              [
                ['all', 'All'],
                ['pain', 'Pain'],
                ['soreness', 'Soreness'],
                ['front', 'Front'],
                ['back', 'Back'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? 'is-on' : ''}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="ops-report-empty">
            No pain or soreness zones marked for this filter.
          </div>
        ) : (
          <ul className="ops-report-list">
            {filtered.map((r) => {
              const initials = r.playerName
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
              return (
                <li key={`${r.playerId}-${r.kind}-${r.areaId}`} className="ops-report-row">
                  <div className="ops-report-athlete">
                    <div className="ops-t-avatar">
                      {r.image ? (
                        <Image
                          src={r.image}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized
                          className="ops-t-avatar-img"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div>
                      <p className="ops-report-name">{r.playerName}</p>
                      <p className="ops-report-meta">
                        <span className={r.kind === 'pain' ? 'is-pain' : 'is-sore'}>
                          {r.kind === 'pain' ? 'PAIN' : 'SORENESS'}
                        </span>
                        <span>· {r.side.toUpperCase()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="ops-report-zone">
                    <strong>{r.muscle}</strong>
                    <span>{r.location ?? 'Exact spot not set'}</span>
                  </div>

                  <div
                    className="ops-report-score"
                    style={{
                      color: r.kind === 'pain'
                        ? r.rating >= 7
                          ? '#ef4444'
                          : r.rating >= 4
                            ? '#f97316'
                            : '#facc15'
                        : r.rating >= 7
                          ? '#fb7185'
                          : r.rating >= 4
                            ? '#fbbf24'
                            : '#67e8f9',
                    }}
                  >
                    <b>{r.rating}</b>
                    <small>/10</small>
                  </div>

                  <div className="ops-report-when">
                    {r.when.length ? (
                      r.when.map((w) => (
                        <span key={w} className="sg7-when-tag">
                          {w}
                        </span>
                      ))
                    ) : (
                      <span className="ops-t-muted">When not reported</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
