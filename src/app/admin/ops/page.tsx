'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RefreshCw,
  Table2,
  Users,
} from 'lucide-react'
import WellnessFlipCard, {
  type OpsPlayerCard,
} from '@/components/admin/ops/WellnessFlipCard'
import OpsAlertTicker from '@/components/admin/ops/OpsAlertTicker'
import OpsWellnessTable from '@/components/admin/ops/OpsWellnessTable'
import OpsCalendar from '@/components/admin/ops/OpsCalendar'
import OpsBodyMapsSection from '@/components/admin/ops/OpsBodyMapsSection'
import type { PlayerWellness, TeamWellnessSummary } from '@/lib/opsWellness'
import './ops-wellness.css'

type OpsPayload = {
  team: { id: string; name: string }
  survey: { id: string; title: string; isActive: boolean } | null
  surveys: Array<{ id: string; title: string; isActive: boolean }>
  generatedAt: string
  selectedDate: string
  stats: { total: number; done: number; pending: number }
  wellnessSummary: TeamWellnessSummary
  players: Array<{
    id: string
    firstName: string
    lastName: string
    image: string | null
    status: 'done' | 'pending'
    submittedAt: string | null
    rank: number | null
    wellness: PlayerWellness | null
  }>
}

type StatusFilter = 'pending' | 'done' | 'all'
type ViewMode = 'cards' | 'table'

function localToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(iso: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDateLabel(isoDate: string) {
  try {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export default function LiveOpsPage() {
  const [data, setData] = useState<OpsPayload | null>(null)
  const [surveyId, setSurveyId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(localToday)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (opts?: {
      silent?: boolean
      surveyIdOverride?: string
      dateOverride?: string
    }) => {
      if (!opts?.silent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const sid = opts?.surveyIdOverride ?? surveyId
        const date = opts?.dateOverride ?? selectedDate
        const params = new URLSearchParams()
        if (sid) params.set('surveyId', sid)
        if (date) params.set('date', date)
        const qs = params.toString() ? `?${params.toString()}` : ''
        const res = await fetch(`/api/ops/today${qs}`, { cache: 'no-store' })
        if (res.status === 401) {
          setError('Unauthorized — please sign in again.')
          return
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Failed to load live ops')
          return
        }
        const payload = (await res.json()) as OpsPayload
        setData(payload)
        if (payload.selectedDate) setSelectedDate(payload.selectedDate)
        if (payload.survey?.id && (!surveyId || opts?.surveyIdOverride)) {
          setSurveyId(payload.survey.id)
        } else if (!payload.survey) {
          setSurveyId('')
        }
      } catch {
        setError('Network error loading live ops')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [surveyId, selectedDate],
  )

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load({ silent: true })
    }
    const id = window.setInterval(tick, 15_000)
    const onVis = () => {
      if (!document.hidden) void load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  const filtered = useMemo(() => {
    const list = data?.players ?? []
    if (filter === 'all') return list
    return list.filter((p) => p.status === filter)
  }, [data?.players, filter])

  const sortedCards = useMemo(() => {
    const list = [...filtered] as OpsPlayerCard[]
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      const ar = a.wellness?.readiness ?? -1
      const br = b.wellness?.readiness ?? -1
      if (ar !== br) return br - ar
      return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
    })
  }, [filtered])

  const onSurveyChange = (next: string) => {
    setSurveyId(next)
    void load({ surveyIdOverride: next })
  }

  const onDateChange = (next: string) => {
    setSelectedDate(next)
    void load({ dateOverride: next })
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
          <p className="mt-3 text-sm text-[var(--ad-muted)]">Loading Live Ops…</p>
        </div>
      </div>
    )
  }

  const ws = data?.wellnessSummary

  const cockpit = (
    <div className="sg7-page">
      {fullscreen ? (
        <div className="ops-fullscreen-bar">
          <div>
            <h2>Live Ops — {data?.team.name}</h2>
            <p className="mt-1 text-xs text-slate-400">{formatDateLabel(selectedDate)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              max={localToday()}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={() => void load({ silent: true })}
              className="admin-btn admin-btn-ghost"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="admin-btn admin-btn-primary"
            >
              <Minimize2 className="h-4 w-4" />
              Exit full screen
            </button>
          </div>
        </div>
      ) : null}

      <OpsCalendar
        selectedDate={selectedDate}
        surveyId={surveyId}
        onSelect={onDateChange}
      />

      {data?.players?.length ? (
        <OpsAlertTicker players={data.players as OpsPlayerCard[]} />
      ) : null}

      {ws ? (
        <div className="sg7-summary">
          <div className="sg7-readiness">
            <small>Squad readiness</small>
            <div className="sg7-readiness-row">
              <strong style={{ color: ws.teamReadinessColor }}>
                {ws.teamReadinessPct == null ? '—' : `${ws.teamReadinessPct}%`}
              </strong>
            </div>
          </div>
          <div>
            <small>Alert</small>
            <strong style={{ color: '#ef4444' }}>{ws.alertCount}</strong>
            <span>require attention</span>
          </div>
          <div>
            <small>Watch</small>
            <strong style={{ color: '#facc15' }}>{ws.watchCount}</strong>
            <span>to monitor</span>
          </div>
          <div>
            <small>Ready</small>
            <strong style={{ color: '#22c55e' }}>{ws.readyCount}</strong>
            <span>good to go</span>
          </div>
          <div>
            <small>Fatigue ↓</small>
            <strong style={{ color: ws.teamFatigueDeltaColor }}>{ws.fatigueUpCount}</strong>
            <span>team Δ {ws.teamFatigueDeltaText}</span>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity className="h-4 w-4 text-cyan-300" />
          <h2 className="text-base font-bold tracking-wide">
            {viewMode === 'table' ? 'Daily monitoring' : 'Daily Wellness cards'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ops-view-switch" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'table' ? 'is-on' : ''}
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              className={viewMode === 'cards' ? 'is-on' : ''}
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
          {(
            [
              ['all', `All (${data?.stats.total ?? 0})`],
              ['pending', `Pending (${data?.stats.pending ?? 0})`],
              ['done', `Done (${data?.stats.done ?? 0})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!data || data.stats.total === 0 ? (
        <div className="admin-panel px-5 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-semibold text-[var(--ad-ink)]">No active players</p>
          <Link href="/admin/players/new" className="admin-btn admin-btn-primary mt-4">
            Add player
          </Link>
        </div>
      ) : sortedCards.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 px-5 py-12 text-center text-sm text-slate-400">
          {filter === 'pending'
            ? 'Everyone is done for this survey on this date.'
            : filter === 'done'
              ? 'No submissions for this date.'
              : 'No players found.'}
        </div>
      ) : viewMode === 'table' ? (
        <div className="ops-table-stack">
          <OpsWellnessTable players={sortedCards} />
          <OpsBodyMapsSection players={sortedCards} />
        </div>
      ) : (
        <div className="sg7-grid">
          {sortedCards.map((p) => (
            <WellnessFlipCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-kicker">Match day</p>
          <h1 className="admin-title mt-1">Live Ops</h1>
          <p className="admin-sub">
            {data?.team.name ? (
              <>
                Daily wellness cockpit for <strong>{data.team.name}</strong> — check-ins, readiness,
                pain &amp; soreness maps.
              </>
            ) : (
              'Daily wellness cockpit for your team.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.generatedAt ? (
            <span className="text-xs text-[var(--ad-muted)]">
              Updated {formatTime(data.generatedAt)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="admin-btn admin-btn-ghost"
          >
            <Maximize2 className="h-4 w-4" />
            Full screen
          </button>
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            disabled={refreshing}
            className="admin-btn admin-btn-ghost"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!data?.surveys.length ? (
        <div className="admin-panel p-6">
          <p className="font-semibold text-[var(--ad-ink)]">No surveys yet</p>
          <p className="mt-1 text-sm text-[var(--ad-muted)]">
            Create a survey for this team, then open Live Ops again.
          </p>
          <Link href="/admin/surveys/new" className="admin-btn admin-btn-primary mt-4">
            New survey
          </Link>
        </div>
      ) : (
        <>
          <section className="admin-panel flex flex-wrap items-end gap-4 p-4 sm:p-5">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="ops-survey">Survey</label>
              <select
                id="ops-survey"
                value={surveyId}
                onChange={(e) => onSurveyChange(e.target.value)}
                className="mt-1"
              >
                {data.surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-[var(--ad-muted)]">
              Selected day: <strong className="text-[var(--ad-ink)]">{formatDateLabel(selectedDate)}</strong>
            </div>
            {data.survey ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/kiosk/${data.survey.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn-primary"
                >
                  Open kiosk
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/admin/surveys/${data.survey.id}/results`}
                  className="admin-btn admin-btn-ghost"
                >
                  Results
                </Link>
              </div>
            ) : null}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Pending</p>
              <p className="admin-stat-value text-amber-700">{data.stats.pending}</p>
              <Clock3 className="absolute bottom-3 right-4 h-8 w-8 text-amber-600/20" aria-hidden />
            </div>
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Done</p>
              <p className="admin-stat-value text-teal-700">{data.stats.done}</p>
              <CheckCircle2
                className="absolute bottom-3 right-4 h-8 w-8 text-teal-600/20"
                aria-hidden
              />
            </div>
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Total active</p>
              <p className="admin-stat-value">{data.stats.total}</p>
              <Users className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
            </div>
          </section>

          {fullscreen ? <div className="ops-fullscreen">{cockpit}</div> : cockpit}
        </>
      )}
    </div>
  )
}
