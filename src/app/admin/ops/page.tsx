'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import OpsColumnBuilder from '@/components/admin/ops/OpsColumnBuilder'
import OpsCalendar from '@/components/admin/ops/OpsCalendar'
import OpsBodyMapsSection from '@/components/admin/ops/OpsBodyMapsSection'
import OpsRulesPanel from '@/components/admin/ops/OpsRulesPanel'
import OpsInterventionsPanel from '@/components/admin/ops/OpsInterventionsPanel'
import OpsMetricsPanel from '@/components/admin/ops/OpsMetricsPanel'
import type { PlayerWellness, TeamWellnessSummary } from '@/lib/opsWellness'
import type { OpsInterventionDTO, OpsRuleDTO, OpsRuleMetric } from '@/lib/opsRules'
import {
  customRuleMetricId,
  type OpsMetricDTO,
} from '@/lib/opsMetrics'
import {
  DEFAULT_OPS_COLUMNS,
  normalizeOpsColumns,
  type OpsColumnConfig,
  type OpsSurveyQuestion,
} from '@/lib/opsTableColumns'
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
    derived?: OpsPlayerCard['derived']
  }>
  rules?: OpsRuleDTO[]
  interventions?: OpsInterventionDTO[]
  metrics?: OpsMetricDTO[]
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

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7)
}

function cacheKey(surveyId: string, date: string) {
  return `${surveyId || '_'}|${date}`
}

function shiftDateKey(isoDate: string, deltaDays: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

type MonthDataPayload = {
  team: OpsPayload['team']
  survey: OpsPayload['survey']
  surveys: OpsPayload['surveys']
  month: string
  generatedAt: string
  days: Record<
    string,
    {
      selectedDate: string
      stats: OpsPayload['stats']
      wellnessSummary: OpsPayload['wellnessSummary']
      players: OpsPayload['players']
    }
  >
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
  const [tableColumns, setTableColumns] = useState<OpsColumnConfig[]>(DEFAULT_OPS_COLUMNS)
  const [surveyQuestions, setSurveyQuestions] = useState<OpsSurveyQuestion[]>([])
  const [savingColumns, setSavingColumns] = useState(false)
  const [rules, setRules] = useState<OpsRuleDTO[]>([])
  const [interventions, setInterventions] = useState<OpsInterventionDTO[]>([])
  const [metrics, setMetrics] = useState<OpsMetricDTO[]>([])
  const [rulesBusy, setRulesBusy] = useState(false)
  const [metricsBusy, setMetricsBusy] = useState(false)
  const [interveneBusyId, setInterveneBusyId] = useState<string | null>(null)
  const [seedRuleMetric, setSeedRuleMetric] = useState<OpsRuleMetric | null>(null)

  const surveyIdRef = useRef(surveyId)
  const selectedDateRef = useRef(selectedDate)
  const cacheRef = useRef(new Map<string, OpsPayload>())
  const hydratedMonthsRef = useRef(new Set<string>())
  const navAbortRef = useRef<AbortController | null>(null)
  const navSeqRef = useRef(0)
  const prefetchingRef = useRef(new Set<string>())
  const saveColumnsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    surveyIdRef.current = surveyId
  }, [surveyId])
  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  const applyDayFromCache = useCallback((sid: string, date: string) => {
    const cached = cacheRef.current.get(cacheKey(sid, date))
    if (!cached) return false
    setData(cached)
    if (Array.isArray(cached.rules)) setRules(cached.rules)
    if (Array.isArray(cached.interventions)) setInterventions(cached.interventions)
    if (Array.isArray(cached.metrics)) setMetrics(cached.metrics)
    return true
  }, [])

  /** Single-day fetch via proven /api/ops/today — used for first paint + date clicks. */
  const loadDay = useCallback(
    async (opts: {
      date: string
      surveyIdOverride?: string
      silent?: boolean
      /** When true, do not abort/overwrite an in-flight navigation for another day. */
      prefetch?: boolean
    }) => {
      const sid = opts.surveyIdOverride ?? surveyIdRef.current
      const date = opts.date
      const key = cacheKey(sid, date)

      if (opts.prefetch) {
        if (!sid || cacheRef.current.has(key) || prefetchingRef.current.has(key)) return
        prefetchingRef.current.add(key)
        try {
          const params = new URLSearchParams({ date })
          if (sid) params.set('surveyId', sid)
          const res = await fetch(`/api/ops/today?${params}`, { cache: 'no-store' })
          if (!res.ok) return
          const payload = (await res.json()) as OpsPayload
          const storeSid = payload.survey?.id || sid
          if (!storeSid) return
          cacheRef.current.set(cacheKey(storeSid, payload.selectedDate || date), payload)
        } catch {
          /* ignore prefetch errors */
        } finally {
          prefetchingRef.current.delete(key)
        }
        return
      }

      const cached = cacheRef.current.get(key)
      if (cached) {
        setData(cached)
        if (cached.survey?.id) {
          setSurveyId(cached.survey.id)
          surveyIdRef.current = cached.survey.id
        }
      }

      navAbortRef.current?.abort()
      const ac = new AbortController()
      navAbortRef.current = ac
      const seq = ++navSeqRef.current

      if (!opts.silent && !cached) setLoading(true)
      else setRefreshing(true)
      setError(null)

      try {
        const params = new URLSearchParams({ date })
        if (sid) params.set('surveyId', sid)
        const res = await fetch(`/api/ops/today?${params}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (seq !== navSeqRef.current) return
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
        if (seq !== navSeqRef.current) return

        // Drop stale responses if user already clicked another day.
        if (selectedDateRef.current !== date) return

        const nextSid = payload.survey?.id || sid
        if (nextSid) {
          setSurveyId(nextSid)
          surveyIdRef.current = nextSid
          cacheRef.current.set(cacheKey(nextSid, payload.selectedDate || date), payload)
        }
        setData(payload)
        if (Array.isArray(payload.rules)) setRules(payload.rules)
        if (Array.isArray(payload.interventions)) setInterventions(payload.interventions)
        if (Array.isArray(payload.metrics)) setMetrics(payload.metrics)
        if (payload.selectedDate) {
          selectedDateRef.current = payload.selectedDate
          setSelectedDate(payload.selectedDate)
        }

        // Warm neighbors for instant next clicks.
        if (nextSid) {
          const d = payload.selectedDate || date
          void loadDay({ date: shiftDateKey(d, -1), surveyIdOverride: nextSid, prefetch: true })
          void loadDay({ date: shiftDateKey(d, 1), surveyIdOverride: nextSid, prefetch: true })
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (seq !== navSeqRef.current) return
        setError('Network error loading live ops')
      } finally {
        if (seq === navSeqRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [],
  )

  /** Optional background month cache — never blocks the initial spinner. */
  const hydrateMonthBackground = useCallback(
    async (sid: string, month: string) => {
      if (!sid || !month) return
      const hydrateKey = `${sid}|${month}`
      if (hydratedMonthsRef.current.has(hydrateKey)) return
      const ac = new AbortController()
      const timer = window.setTimeout(() => ac.abort(), 20_000)
      try {
        const params = new URLSearchParams({ month, surveyId: sid })
        const res = await fetch(`/api/ops/month-data?${params}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (!res.ok) return
        const payload = (await res.json()) as MonthDataPayload
        const nextSid = payload.survey?.id || sid
        for (const [date, day] of Object.entries(payload.days || {})) {
          const existing = cacheRef.current.get(cacheKey(nextSid, date))
          // Prefer already-enriched /api/ops/today payloads over month stubs.
          if (existing) continue
          cacheRef.current.set(cacheKey(nextSid, date), {
            team: payload.team,
            survey: payload.survey,
            surveys: payload.surveys,
            generatedAt: payload.generatedAt,
            selectedDate: date,
            stats: day.stats,
            wellnessSummary: day.wellnessSummary,
            players: day.players,
          })
        }
        hydratedMonthsRef.current.add(hydrateKey)
      } catch {
        /* background only */
      } finally {
        window.clearTimeout(timer)
      }
    },
    [],
  )

  const refreshRulesList = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/rules', { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      if (Array.isArray(body?.rules)) setRules(body.rules)
    } catch {
      // ignore — Live Ops day payload remains source of truth
    }
  }, [])

  useEffect(() => {
    const today = localToday()
    selectedDateRef.current = today
    void loadDay({ date: today }).then(() => {
      const sid = surveyIdRef.current
      if (sid) void hydrateMonthBackground(sid, monthKey(today))
      // Backup: rules list from dedicated endpoint if day payload omitted them.
      void refreshRulesList()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadColumnPrefs = useCallback(async (sid: string) => {
    if (!sid) {
      setTableColumns(DEFAULT_OPS_COLUMNS)
      setSurveyQuestions([])
      return
    }
    try {
      const res = await fetch(
        `/api/ops/table-preferences?surveyId=${encodeURIComponent(sid)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const payload = await res.json()
      if (payload?.columns) setTableColumns(normalizeOpsColumns(payload.columns))
      if (Array.isArray(payload?.questions)) setSurveyQuestions(payload.questions)
    } catch {
      /* keep current */
    }
  }, [])

  useEffect(() => {
    if (!surveyId) return
    void loadColumnPrefs(surveyId)
  }, [surveyId, loadColumnPrefs])

  const persistColumns = useCallback(
    (next: OpsColumnConfig[]) => {
      const sid = surveyIdRef.current
      const normalized = normalizeOpsColumns(next)
      setTableColumns(normalized)
      if (!sid) return
      if (saveColumnsTimerRef.current) clearTimeout(saveColumnsTimerRef.current)
      saveColumnsTimerRef.current = setTimeout(() => {
        setSavingColumns(true)
        void fetch('/api/ops/table-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ surveyId: sid, columns: normalized }),
        })
          .then((res) => {
            if (!res.ok) return
            // Mappings affect parsed values — drop cache and reload visible day.
            cacheRef.current.clear()
            hydratedMonthsRef.current.clear()
            void loadDay({
              date: selectedDateRef.current,
              surveyIdOverride: sid,
              silent: true,
            })
          })
          .catch(() => {
            /* keep local layout even if save fails */
          })
          .finally(() => setSavingColumns(false))
      }, 400)
    },
    [loadDay],
  )

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      const sid = surveyIdRef.current
      const date = selectedDateRef.current
      if (!sid || !date) return
      void loadDay({ date, surveyIdOverride: sid, silent: true })
    }
    const id = window.setInterval(tick, 30_000)
    const onVis = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadDay])

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
    surveyIdRef.current = next
    setSurveyId(next)
    const date = selectedDateRef.current
    const painted = applyDayFromCache(next, date)
    void loadDay({ date, surveyIdOverride: next, silent: !!painted })
    void hydrateMonthBackground(next, monthKey(date))
  }

  const onDateChange = (next: string) => {
    selectedDateRef.current = next
    setSelectedDate(next)
    const sid = surveyIdRef.current
    const painted = sid ? applyDayFromCache(sid, next) : false
    // Always fetch the day (cache paints instantly; network refreshes + body maps).
    void loadDay({ date: next, surveyIdOverride: sid || undefined, silent: true })
    if (!painted && sid) {
      // Ensure month cache is warming for nearby clicks.
      void hydrateMonthBackground(sid, monthKey(next))
    }
  }

  const onMonthChange = useCallback(
    (month: string) => {
      const sid = surveyIdRef.current
      if (!sid) return
      void hydrateMonthBackground(sid, month)
    },
    [hydrateMonthBackground],
  )

  const refreshVisible = useCallback(() => {
    const sid = surveyIdRef.current
    const date = selectedDateRef.current
    void loadDay({ date, surveyIdOverride: sid || undefined, silent: true })
  }, [loadDay])

  const reloadAfterRulesChange = useCallback(async () => {
    cacheRef.current.clear()
    hydratedMonthsRef.current.clear()
    await Promise.all([
      refreshRulesList(),
      loadDay({
        date: selectedDateRef.current,
        surveyIdOverride: surveyIdRef.current || undefined,
        silent: true,
      }),
    ])
  }, [loadDay, refreshRulesList])

  const createRule = useCallback(
    async (input: {
      name: string
      metric: OpsRuleDTO['metric']
      operator: OpsRuleDTO['operator']
      threshold: number
      severity: OpsRuleDTO['severity']
      enabled: boolean
      surveyId: string | null
    }): Promise<{ ok: boolean; error?: string; rule?: OpsRuleDTO }> => {
      setRulesBusy(true)
      try {
        const res = await fetch('/api/ops/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          return {
            ok: false,
            error: typeof body?.error === 'string' ? body.error : 'Failed to create rule',
          }
        }
        const rule = body?.rule as OpsRuleDTO | undefined
        if (rule?.id) {
          setRules((prev) => (prev.some((r) => r.id === rule.id) ? prev : [...prev, rule]))
        }
        await reloadAfterRulesChange()
        return { ok: true, rule }
      } catch {
        return { ok: false, error: 'Network error creating rule' }
      } finally {
        setRulesBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const patchRule = useCallback(
    async (id: string, patch: Partial<OpsRuleDTO>) => {
      setRulesBusy(true)
      try {
        const res = await fetch(`/api/ops/rules/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) return
        const body = await res.json()
        if (body?.rule) {
          setRules((prev) => prev.map((r) => (r.id === id ? body.rule : r)))
        }
        await reloadAfterRulesChange()
      } finally {
        setRulesBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const deleteRule = useCallback(
    async (id: string) => {
      setRulesBusy(true)
      try {
        const res = await fetch(`/api/ops/rules/${id}`, { method: 'DELETE' })
        if (!res.ok) return
        setRules((prev) => prev.filter((r) => r.id !== id))
        await reloadAfterRulesChange()
      } finally {
        setRulesBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const changeInterventionStatus = useCallback(
    async (id: string, status: 'ACKNOWLEDGED' | 'RESOLVED' | 'OPEN') => {
      setInterveneBusyId(id)
      try {
        const res = await fetch(`/api/ops/interventions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) return
        const body = await res.json()
        if (body?.intervention) {
          setInterventions((prev) => {
            if (status === 'RESOLVED') return prev.filter((i) => i.id !== id)
            return prev.map((i) => (i.id === id ? body.intervention : i))
          })
        }
      } finally {
        setInterveneBusyId(null)
      }
    },
    [],
  )

  const createMetric = useCallback(
    async (input: {
      name: string
      kind: OpsMetricDTO['kind']
      config: OpsMetricDTO['config']
      formatting: OpsMetricDTO['formatting']
      showInTable: boolean
      enabled: boolean
      surveyId: string | null
    }): Promise<{ ok: boolean; error?: string; metric?: OpsMetricDTO }> => {
      setMetricsBusy(true)
      try {
        const res = await fetch('/api/ops/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          return {
            ok: false,
            error: typeof body?.error === 'string' ? body.error : 'Failed to create metric',
          }
        }
        const metric = body?.metric as OpsMetricDTO | undefined
        if (metric?.id) {
          setMetrics((prev) =>
            prev.some((m) => m.id === metric.id) ? prev : [...prev, metric],
          )
        }
        await reloadAfterRulesChange()
        return { ok: true, metric }
      } catch {
        return { ok: false, error: 'Network error creating metric' }
      } finally {
        setMetricsBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const patchMetric = useCallback(
    async (id: string, patch: Partial<OpsMetricDTO>) => {
      setMetricsBusy(true)
      try {
        const res = await fetch(`/api/ops/metrics/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) return
        const body = await res.json()
        if (body?.metric) {
          setMetrics((prev) => prev.map((m) => (m.id === id ? body.metric : m)))
        }
        await reloadAfterRulesChange()
      } finally {
        setMetricsBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const deleteMetric = useCallback(
    async (id: string) => {
      setMetricsBusy(true)
      try {
        const res = await fetch(`/api/ops/metrics/${id}`, { method: 'DELETE' })
        if (!res.ok) return
        setMetrics((prev) => prev.filter((m) => m.id !== id))
        await reloadAfterRulesChange()
      } finally {
        setMetricsBusy(false)
      }
    },
    [reloadAfterRulesChange],
  )

  const customRuleMetricOptions = useMemo(
    () =>
      metrics
        .filter((m) => m.enabled)
        .map((m) => ({
          id: customRuleMetricId(m.key) as OpsRuleMetric,
          label: `⚡ ${m.name}`,
        })),
    [metrics],
  )

  const tableMetricColumns = useMemo(
    () =>
      metrics
        .filter((m) => m.enabled && m.showInTable)
        .map((m) => ({ key: m.key, name: m.name })),
    [metrics],
  )

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
              onClick={() => void refreshVisible()}
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
        onMonthChange={onMonthChange}
      />

      {data?.players?.length ? (
        <OpsAlertTicker players={data.players as OpsPlayerCard[]} />
      ) : null}

      <OpsMetricsPanel
        metrics={metrics}
        surveys={data?.surveys ?? []}
        onCreate={createMetric}
        onPatch={patchMetric}
        onDelete={deleteMetric}
        onCreateRuleFromMetric={(metric) => {
          setSeedRuleMetric(customRuleMetricId(metric.key) as OpsRuleMetric)
        }}
        busy={metricsBusy}
      />

      <OpsRulesPanel
        rules={rules}
        surveys={data?.surveys ?? []}
        customMetrics={customRuleMetricOptions}
        seedMetric={seedRuleMetric}
        onCreate={createRule}
        onPatch={patchRule}
        onDelete={deleteRule}
        busy={rulesBusy}
      />

      <OpsInterventionsPanel
        interventions={interventions}
        onStatusChange={changeInterventionStatus}
        busyId={interveneBusyId}
      />

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
          {viewMode === 'table' ? (
            <OpsColumnBuilder
              columns={tableColumns}
              questions={surveyQuestions}
              onChange={persistColumns}
              saving={savingColumns}
              surveyTitle={data?.survey?.title}
            />
          ) : null}
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
          <OpsWellnessTable
            players={sortedCards}
            columns={tableColumns}
            metricColumns={tableMetricColumns}
          />
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
            onClick={() => void refreshVisible()}
            disabled={refreshing}
            className="admin-btn admin-btn-ghost"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            className="admin-btn admin-btn-ghost mt-3"
            onClick={() => void refreshVisible()}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : null}

      {error && !data ? null : !data?.surveys.length ? (
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
