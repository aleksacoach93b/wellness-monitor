'use client'

import BodyMap from '@/components/BodyMap'
import type { BodyMapSummary } from '@/lib/opsWellness'

type Props = {
  kind: 'pain' | 'soreness'
  athleteName: string
  summary: BodyMapSummary
}

const noop = () => {}

export default function OpsBodyMapFace({ kind, athleteName, summary }: Props) {
  const isPain = kind === 'pain'
  const kicker = isPain ? 'PAIN MAP' : 'SORENESS MAP'
  const mainLabel = isPain ? 'REPORTED PAINFUL AREA' : 'REPORTED SORENESS AREA'

  return (
    <div
      className={`sg7-face ${isPain ? 'sg7-back sg8-pain-face' : 'sg7-soreness sg8-soreness-face'}`}
    >
      <div className="sg7-back-top">
        <div className="sg7-back-kicker">{kicker}</div>
        <div className="sg7-back-name">{athleteName}</div>
        <div
          className="sg7-back-flag"
          style={{ color: summary.flagColor, borderColor: summary.flagColor }}
        >
          {summary.flagText}
        </div>
      </div>

      <div className="sg7-back-maps">
        <div className="sg7-map-shell">
          <div className="sg7-map-label">Front</div>
          <div className="sg7-map-svg">
            <BodyMap
              mode="preview"
              view="front"
              colorScheme={isPain ? 'pain' : 'soreness'}
              selectedAreas={summary.areas}
              onAreaClick={noop}
              onViewChange={noop}
              onContinue={noop}
              onClose={noop}
            />
          </div>
        </div>
        <div className="sg7-map-shell">
          <div className="sg7-map-label">Back</div>
          <div className="sg7-map-svg">
            <BodyMap
              mode="preview"
              view="back"
              colorScheme={isPain ? 'pain' : 'soreness'}
              selectedAreas={summary.areas}
              onAreaClick={noop}
              onViewChange={noop}
              onContinue={noop}
              onClose={noop}
            />
          </div>
        </div>
      </div>

      <div className="sg7-zone-scroll">
        {summary.details.length === 0 ? (
          <p className="sg7-zone-empty">No zones marked</p>
        ) : (
          summary.details.map((z) => (
            <div key={z.areaId} className="sg7-zone-card">
              <div className="sg7-zone-head">
                <span className="sg7-zone-muscle">{z.muscle}</span>
                <span
                  className="sg7-zone-rating"
                  style={{
                    color: summary.flagColor,
                    borderColor: summary.flagColor,
                  }}
                >
                  {z.rating}/10
                </span>
              </div>
              <div className="sg7-zone-meta">
                <span className="sg7-zone-side">{z.side === 'front' ? 'Front' : 'Back'}</span>
                {z.location ? (
                  <span className="sg7-zone-location" title="Exact spot">
                    {z.location}
                  </span>
                ) : (
                  <span className="sg7-zone-location muted">Spot not set</span>
                )}
              </div>
              {z.when.length > 0 ? (
                <div className="sg7-when-tags">
                  {z.when.map((w) => (
                    <span key={w} className="sg7-when-tag">
                      {w}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="sg7-zone-empty-when">When not reported</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sg7-back-summary">
        <div>
          <span>ZONES</span>
          <b>{summary.zones}</b>
        </div>
        <div>
          <span>MAX</span>
          <b style={{ color: summary.flagColor }}>{summary.max ?? '-'}</b>
        </div>
        <div>
          <span>TOTAL</span>
          <b style={{ color: summary.flagColor }}>{summary.total ?? '-'}</b>
        </div>
      </div>
      <div className="sg7-back-main">
        <span>{mainLabel}</span>
        <b>{summary.topArea ?? '-'}</b>
      </div>
    </div>
  )
}
