'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Activity,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  User,
  Users,
} from 'lucide-react'

type OpsPlayer = {
  id: string
  firstName: string
  lastName: string
  image: string | null
  status: 'done' | 'pending'
  submittedAt: string | null
}

type OpsPayload = {
  team: { id: string; name: string }
  survey: { id: string; title: string; isActive: boolean } | null
  surveys: Array<{ id: string; title: string; isActive: boolean }>
  generatedAt: string
  stats: { total: number; done: number; pending: number }
  players: OpsPlayer[]
}

type StatusFilter = 'pending' | 'done' | 'all'

function formatTime(iso: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function LiveOpsPage() {
  const [data, setData] = useState<OpsPayload | null>(null)
  const [surveyId, setSurveyId] = useState<string>('')
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (opts?: { silent?: boolean; surveyIdOverride?: string }) => {
      if (!opts?.silent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const sid = opts?.surveyIdOverride ?? surveyId
        const qs = sid ? `?surveyId=${encodeURIComponent(sid)}` : ''
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
    [surveyId],
  )

  useEffect(() => {
    void load()
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh every 15s while tab visible
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

  const filtered = useMemo(() => {
    const list = data?.players ?? []
    if (filter === 'all') return list
    return list.filter((p) => p.status === filter)
  }, [data?.players, filter])

  const onSurveyChange = (next: string) => {
    setSurveyId(next)
    void load({ surveyIdOverride: next })
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-kicker">Match day</p>
          <h1 className="admin-title mt-1">Live Ops</h1>
          <p className="admin-sub">
            {data?.team.name ? (
              <>
                Today&apos;s check-in for <strong>{data.team.name}</strong> — who still needs to
                submit.
              </>
            ) : (
              'Today’s check-in status for your team.'
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
            <div className="min-w-[200px] flex-1">
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

          <section className="admin-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ad-line)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-700" />
                <h2 className="admin-display text-lg font-bold">Players today</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['pending', `Pending (${data.stats.pending})`],
                    ['done', `Done (${data.stats.done})`],
                    ['all', `All (${data.stats.total})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filter === key
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {data.stats.total === 0 ? (
              <div className="px-5 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-semibold text-[var(--ad-ink)]">No active players</p>
                <p className="mt-1 text-sm text-[var(--ad-muted)]">
                  Add players for this team to track check-ins.
                </p>
                <Link href="/admin/players/new" className="admin-btn admin-btn-primary mt-4">
                  Add player
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-[var(--ad-muted)]">
                {filter === 'pending'
                  ? 'Everyone is done for this survey today.'
                  : filter === 'done'
                    ? 'No submissions yet today.'
                    : 'No players found.'}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--ad-line)]">
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="shrink-0">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--ad-line)]"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ad-accent-soft)]">
                          <User className="h-5 w-5 text-teal-700" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--ad-ink)]">
                        {p.firstName}{' '}
                        <span className="font-bold">{p.lastName}</span>
                      </p>
                      <p className="text-xs text-[var(--ad-muted)]">
                        {p.status === 'done'
                          ? `Submitted ${formatTime(p.submittedAt)}`
                          : 'Not submitted today'}
                      </p>
                    </div>
                    <span
                      className={`admin-badge ${
                        p.status === 'done' ? 'admin-badge-ok' : 'admin-badge-warn'
                      }`}
                    >
                      {p.status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
