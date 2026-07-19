'use client'

import type { OpsInterventionDTO } from '@/lib/opsRules'

type Props = {
  interventions: OpsInterventionDTO[]
  onStatusChange: (
    id: string,
    status: 'ACKNOWLEDGED' | 'RESOLVED' | 'OPEN',
  ) => void
  busyId?: string | null
}

const SEV_CLASS: Record<string, string> = {
  CRITICAL: 'is-critical',
  ALERT: 'is-alert',
  WATCH: 'is-watch',
}

export default function OpsInterventionsPanel({
  interventions,
  onStatusChange,
  busyId,
}: Props) {
  const open = interventions.filter((i) => i.status !== 'RESOLVED')

  return (
    <section className="ops-intervene">
      <header className="ops-intervene-head">
        <div>
          <h3>Interventions</h3>
          <p>Rules that fired for this day — acknowledge or resolve as you handle them.</p>
        </div>
        <span className="ops-intervene-count">{open.length} active</span>
      </header>

      {open.length === 0 ? (
        <p className="ops-intervene-empty">No active interventions for this day.</p>
      ) : (
        <ul className="ops-intervene-list">
          {open.map((item) => (
            <li
              key={item.id}
              className={`ops-intervene-item ${SEV_CLASS[item.severity] ?? ''}`}
            >
              <div className="ops-intervene-main">
                <div className="ops-intervene-tags">
                  <em>{item.severity}</em>
                  {item.status === 'ACKNOWLEDGED' ? <em className="is-ack">ACK</em> : null}
                </div>
                <strong>{item.playerName}</strong>
                <span>{item.message}</span>
              </div>
              <div className="ops-intervene-actions">
                {item.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onStatusChange(item.id, 'ACKNOWLEDGED')}
                  >
                    Ack
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => onStatusChange(item.id, 'RESOLVED')}
                >
                  Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
