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
  const top = summary.details[0] ?? null

  return (
    <div
      className={`sg7-face sg7-map-face ${isPain ? 'sg7-back sg8-pain-face' : 'sg7-soreness sg8-soreness-face'}`}
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
          <div className="sg7-map-label">FRONT</div>
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
          <div className="sg7-map-label">BACK</div>
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

      <div className="sg7-zone-featured">
        {top ? (
          <div className="sg7-zone-card">
            <div className="sg7-zone-head">
              <span className="sg7-zone-muscle">{top.muscle}</span>
              <span
                className="sg7-zone-rating"
                style={{
                  color: summary.flagColor,
                  borderColor: summary.flagColor,
                }}
              >
                {top.rating}/10
              </span>
            </div>
            <div className="sg7-zone-meta">
              <span className="sg7-zone-side">{top.side === 'front' ? 'FRONT' : 'BACK'}</span>
              {top.location ? (
                <span className="sg7-zone-location">{top.location}</span>
              ) : (
                <span className="sg7-zone-location muted">Spot not set</span>
              )}
            </div>
            {top.when.length > 0 ? (
              <div className="sg7-when-tags">
                {top.when.map((w) => (
                  <span key={w} className="sg7-when-tag">
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <p className="sg7-zone-empty-when">When not reported</p>
            )}
            {summary.details.length > 1 ? (
              <p className="sg7-zone-more">+{summary.details.length - 1} more zone(s)</p>
            ) : null}
          </div>
        ) : (
          <p className="sg7-zone-empty">No zones marked</p>
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
