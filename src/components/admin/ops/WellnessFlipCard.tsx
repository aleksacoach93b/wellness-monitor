'use client'

import Image from 'next/image'
import type { PlayerWellness } from '@/lib/opsWellness'
import OpsBodyMapFace from '@/components/admin/ops/OpsBodyMapFace'

export type OpsDerivedCell = {
  key: string
  metricId: string
  name: string
  value: number | null
  color: string | null
}

export type OpsPlayerCard = {
  id: string
  firstName: string
  lastName: string
  image: string | null
  status: 'done' | 'pending'
  submittedAt: string | null
  rank: number | null
  wellness: PlayerWellness | null
  derived?: OpsDerivedCell[]
}

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '-'
  return n.toFixed(digits)
}

function MetricRow({
  icon,
  label,
  metric,
}: {
  icon: string
  label: string
  metric: PlayerWellness['fatigue']
}) {
  return (
    <div className="sg7-row">
      <div className="sg7-row-label">
        <span className="sg7-ico">{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className="sg7-row-bar"
        style={
          {
            '--fill': `${metric.pct}%`,
            '--bar': metric.color,
          } as React.CSSProperties
        }
      >
        <div className="sg7-row-fill" />
        {metric.markerPct != null ? (
          <div className="sg7-marker" style={{ left: `${metric.markerPct}%` }} />
        ) : null}
      </div>
      <div className="sg7-row-num">{fmt(metric.value)}</div>
      <div
        className="sg7-z"
        style={{ color: metric.color, borderColor: metric.color }}
      >
        z {metric.z == null ? '-' : `${metric.z >= 0 ? '+' : ''}${metric.z.toFixed(1)}`}
      </div>
      <div className="sg7-delta3" style={{ color: metric.delta3Color }}>
        <b>
          {metric.delta3 == null
            ? '-'
            : `${metric.delta3 >= 0 ? '+' : ''}${metric.delta3.toFixed(1)}`}
        </b>
        <small>3d</small>
      </div>
    </div>
  )
}

export default function WellnessFlipCard({ player }: { player: OpsPlayerCard }) {
  const name = `${player.firstName} ${player.lastName}`.trim()
  const w = player.wellness
  const initials =
    `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`.toUpperCase() || '?'

  if (!w || player.status === 'pending') {
    return (
      <div className="sg7-card sg8-no-flip" style={{ ['--accent' as string]: '#64748b' }}>
        <div className="sg7-flip">
          <div className="sg7-face sg7-front">
            <div className="sg7-head">
              <div className="sg7-photo-block">
                <div className="sg7-rank">—</div>
                <div className="sg7-avatar-wrap">
                  {player.image ? (
                    <Image
                      src={player.image}
                      alt=""
                      width={78}
                      height={78}
                      unoptimized
                      className="sg7-avatar"
                    />
                  ) : (
                    <div className="sg7-avatar sg7-avatar-fallback">{initials}</div>
                  )}
                </div>
              </div>
              <div className="sg7-name-block">
                <div className="sg7-pos">DAILY WELLNESS</div>
                <div className="sg7-name">{name}</div>
                <div className="sg7-status-line">
                  <span style={{ color: '#facc15', borderColor: '#facc15' }}>PENDING</span>
                </div>
              </div>
              <div className="sg7-gauge-block">
                <div className="sg7-gauge-title">READINESS</div>
                <div
                  className="sg7-gauge"
                  style={{ ['--gauge' as string]: '0%', ['--accent' as string]: '#64748b' }}
                >
                  <div className="sg7-gauge-mask" />
                  <div className="sg7-gauge-core">
                    <b>—</b>
                  </div>
                </div>
                <div className="sg7-gauge-label">NO DATA</div>
                <div className="sg7-gauge-hint">Waiting for check-in</div>
              </div>
            </div>
            <p className="sg7-pending-copy">Player has not submitted today&apos;s wellness survey.</p>
          </div>
        </div>
      </div>
    )
  }

  const flipClass =
    w.flipMode === 'both'
      ? ' sg8-both'
      : w.flipMode === 'pain'
        ? ' sg8-pain-only'
        : w.flipMode === 'soreness'
          ? ' sg8-soreness-only'
          : ' sg8-no-flip'

  return (
    <div
      className={`sg7-card${flipClass}`}
      style={
        {
          '--accent': w.readinessColor,
          '--status': w.statusColor,
          '--pain': w.pain.flagColor,
          '--sore': w.sorenessMap.flagColor,
        } as React.CSSProperties
      }
    >
      <div className="sg7-flip">
        <div className="sg7-face sg7-front">
          <div className="sg7-head">
            <div className="sg7-photo-block">
              <div className="sg7-rank">#{player.rank ?? '—'}</div>
              <div className="sg7-avatar-wrap">
                {player.image ? (
                  <Image
                    src={player.image}
                    alt=""
                    width={78}
                    height={78}
                    unoptimized
                    className="sg7-avatar"
                  />
                ) : (
                  <div className="sg7-avatar sg7-avatar-fallback">{initials}</div>
                )}
              </div>
            </div>

            <div className="sg7-name-block">
              <div className="sg7-pos">DAILY WELLNESS</div>
              <div className="sg7-name">{name}</div>
              <div className="sg7-status-line">
                <span style={{ color: w.statusColor, borderColor: w.statusColor }}>
                  {w.statusText}
                </span>
                <span style={{ color: w.pain.flagColor, borderColor: w.pain.flagColor }}>
                  {w.pain.flagText}
                </span>
              </div>
            </div>

            <div className="sg7-gauge-block">
              <div className="sg7-gauge-title">READINESS</div>
              <div
                className={`sg7-gauge${w.readinessColor !== '#22c55e' ? ' sg7-gauge-dynamic' : ''}`}
                style={
                  {
                    '--gauge': `${w.readinessPct}%`,
                    '--accent': w.readinessColor,
                  } as React.CSSProperties
                }
              >
                <div className="sg7-gauge-mask" />
                <div className="sg7-gauge-core">
                  <b>{w.readinessPct}%</b>
                </div>
              </div>
              <div className="sg7-gauge-label">{w.readinessLabel}</div>
              <div className="sg7-gauge-hint">{w.readinessHint}</div>
            </div>
          </div>

          <div className="sg7-sleep">
            <div className="sg7-sleep-icon">☾</div>
            <div className="sg7-sleep-title">SLEEP</div>
            <div>
              <b>{w.sleepBedtime || '-'}</b>
              <span>BEDTIME</span>
            </div>
            <div>
              <b>{w.sleepWake || '-'}</b>
              <span>WAKE</span>
            </div>
            <div>
              <b>{w.sleepDuration || '-'}</b>
              <span>DURATION</span>
            </div>
          </div>

          <div className="sg7-rows">
            <MetricRow icon="⚡" label="FATIGUE" metric={w.fatigue} />
            <MetricRow icon="💪" label="SORENESS" metric={w.soreness} />
            <MetricRow icon="☾" label="SLEEP QUALITY" metric={w.sleepQuality} />
            <MetricRow icon="☺" label="MOOD" metric={w.mood} />
          </div>

          <div className="sg7-front-footer">
            <div className="sg7-risk-stack">
              <div className="sg7-risk-head">
                <span>RISK SOURCE</span>
                <b>{w.risk.sourceText}</b>
              </div>
              <div className="sg7-risk-tags">
                <span
                  className={`sg7-risk-tag${w.risk.fatigue ? ' active' : ''}`}
                  style={{ ['--risk' as string]: '#ef4444' }}
                >
                  <i />
                  Fatigue
                </span>
                <span
                  className={`sg7-risk-tag${w.risk.soreness ? ' active' : ''}`}
                  style={{ ['--risk' as string]: '#f97316' }}
                >
                  <i />
                  Soreness
                </span>
                <span
                  className={`sg7-risk-tag${w.risk.sleep ? ' active' : ''}`}
                  style={{ ['--risk' as string]: '#38bdf8' }}
                >
                  <i />
                  Sleep
                </span>
                <span
                  className={`sg7-risk-tag${w.risk.pain ? ' active' : ''}`}
                  style={{ ['--risk' as string]: w.pain.flagColor }}
                >
                  <i />
                  Pain
                </span>
              </div>
            </div>
            <div className="sg7-compare">
              <span>FATIGUE vs PREV DAY</span>
              <b style={{ color: w.fatigueDeltaColor }}>{w.fatigueDeltaText}</b>
              <small>Prev: {fmt(w.prevFatigue)}</small>
            </div>
          </div>
        </div>

        {w.pain.hasData ? (
          <OpsBodyMapFace kind="pain" athleteName={name} summary={w.pain} />
        ) : null}
        {w.sorenessMap.hasData ? (
          <OpsBodyMapFace kind="soreness" athleteName={name} summary={w.sorenessMap} />
        ) : null}
      </div>
    </div>
  )
}
