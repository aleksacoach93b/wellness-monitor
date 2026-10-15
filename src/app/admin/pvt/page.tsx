'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PVT_DURATIONS, isPvtDuration } from '@/lib/pvt/protocol'
import { baselineFor, type PvtSessionRow } from '@/lib/pvt/baseline'

type Survey = { id: string; title: string; timezone: string }
type Config = { surveyId: string; enabled: boolean; durationSeconds: number }
type Data = { enabled: boolean; ready: boolean; surveys: Survey[]; configs: Config[]; sessions: PvtSessionRow[]; error?: string }
const control = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900'
export default function PvtAdmin() {
  const lastSurvey = useRef('')
  const [data, setData] = useState<Data | null>(null)
  const [surveyId, setSurveyId] = useState('')
  const [duration, setDuration] = useState(30)
  const [enabled, setEnabled] = useState(false)
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const response = await fetch('/api/pvt/admin', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load PVT')
    setData(payload)
    return payload as Data
  }
  useEffect(() => { void load().then(d => setSurveyId(d.surveys[0]?.id || '')).catch(e => setError(e.message)) }, [])
  useEffect(() => {
    const config = data?.configs.find(c => c.surveyId === surveyId)
    setEnabled(config?.enabled || false); setDuration(config && isPvtDuration(config.durationSeconds) ? config.durationSeconds : 30)
    const timezone = data?.surveys.find(s => s.id === surveyId)?.timezone || 'Europe/Belgrade'
    if (lastSurvey.current !== surveyId) {
      setDate(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
      lastSurvey.current = surveyId
    }
  }, [surveyId, data])
  const rows = useMemo(() => data?.sessions.filter(s => s.surveyId === surveyId && s.localDate === date) || [], [data, surveyId, date])
  const save = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/pvt/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surveyId, enabled, durationSeconds: duration }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Save failed')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setBusy(false) }
  }
  const exportCsv = () => {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`
    const table = [['Player', 'Date', 'Started', 'Duration', 'Protocol', 'Practice', 'Status', 'Quality', 'Responses', 'Median RT ms', 'Response speed 1/s', 'Slow >=355ms percent (exploratory)', 'False starts', 'Posture', 'Caffeine', 'Minutes awake', 'Flags'],
      ...rows.map(s => [s.player.firstName + ' ' + s.player.lastName, s.localDate, s.startedAt, s.durationSeconds, s.protocolVersion, s.practice, s.status, s.summary?.quality, s.summary?.responses, s.summary?.medianRT, s.summary?.responseSpeed, s.summary?.slowPercent, s.summary?.falseStarts, s.context.posture, s.context.caffeine, s.context.minutesAwake, s.summary?.flags.join('; ')])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + table.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `pvt-${date}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="space-y-6">
    <header><p className="admin-kicker">PLAYER MONITORING</p><h1 className="admin-title">Handheld PVT</h1><p className="admin-sub">Vigilance & attention</p></header>
    <div className="admin-panel space-y-3 p-5 text-sm text-slate-700">
      <p><strong>Same task, unpredictable timing.</strong> Hold the phone upright, use the same thumb, posture and device. Respond to the fixed visual counter after a random 1–4 s wait. No camera or microphone.</p>
      <p>30/60 s are experimental short checks. This implementation requires timing validation. Results are not a diagnosis, injury predictor or overall readiness score. A ≥355 ms response is an exploratory brief-PVT reference, not a fatigue cutoff.</p>
      <p>Practice is separate. All attempts remain in history. Prior reference uses the first eligible attempt per day, at least 7 prior days in the loaded 28-day history, matching player, survey, duration, version, device/browser, posture and caffeine. It is descriptive and does not establish meaningful-change thresholds.</p>
      <a className="font-bold text-teal-700 underline" href="/pvt/demo" target="_blank" rel="noreferrer">Open isolated player demo (no data saved)</a>
    </div>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
    {data?.configs.some(c => c.surveyId === surveyId && !isPvtDuration(c.durationSeconds)) && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This survey uses a retired duration. Choose 30 or 60 seconds and save before new attempts can start. Historical results are retained.</p>}
    {data && !data.ready && <div className="admin-panel p-5"><strong>Module is inactive.</strong><p>{data.enabled ? data.error : 'PVT_ENABLED is off. Existing wellness flows are unchanged. Enable only on an isolated preview database after reviewing the additive migration.'}</p></div>}
    <section className="admin-panel flex flex-wrap items-end gap-4 p-5">
      <label className="flex flex-col gap-1 text-sm">Survey<select className={control} value={surveyId} onChange={e => setSurveyId(e.target.value)}>{data?.surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Official duration<select className={control} value={duration} onChange={e => setDuration(Number(e.target.value))}>{PVT_DURATIONS.map(d => <option key={d} value={d}>{d} seconds · experimental</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Add PVT after this survey</label>
      <button className="admin-btn admin-btn-primary" disabled={!data?.ready || busy || !surveyId} onClick={() => void save()}>{busy ? 'Saving…' : 'Save settings'}</button>
    </section>
    <section className="admin-panel space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1 text-sm">Team calendar date<input type="date" className={control} value={date} onChange={e => setDate(e.target.value)} /></label><button className="admin-btn admin-btn-ghost" onClick={() => void load().catch(e => setError(e.message))}>Refresh</button><button disabled={!rows.length} className="admin-btn admin-btn-ghost" onClick={exportCsv}>Export attempts CSV</button></div>
      <p className="text-sm text-slate-600">{new Set(rows.filter(s => !s.practice && s.status === 'COMPLETED').map(s => s.playerId)).size} players completed · {rows.length} attempts. Review quality before interpretation. Positive Δ means slower than personal reference; it is not a fatigue percentage.</p>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b text-slate-500"><tr>{['Player', 'Attempt', 'Protocol', 'Quality', 'Median RT', 'Slow responses', 'Early taps', 'Personal reference', 'Context'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(s => {
        const base = baselineFor(s, data?.sessions || [])
        const sameDay = rows.filter(x => x.playerId === s.playerId && !x.practice && x.status === 'COMPLETED' && x.summary?.quality === 'OK')
        const repeat = !s.practice && sameDay[0]?.id !== s.id && sameDay.some(x => x.id === s.id)
        return <tr key={s.id} className="border-b align-top"><td className="p-3 font-bold">{s.player.firstName} {s.player.lastName}<div className="font-normal text-slate-500">{new Date(s.startedAt).toLocaleTimeString('en-GB', { timeZone: data?.surveys.find(x => x.id === s.surveyId)?.timezone || 'Europe/Belgrade' })}</div></td><td className="p-3">{s.practice ? 'PRACTICE' : repeat ? 'REPEAT' : 'OFFICIAL'}<div>{s.status}</div></td><td className="p-3">{s.durationSeconds} s<div className="text-xs text-slate-500">{s.protocolVersion}</div></td><td className="p-3">{s.summary?.quality || 'PENDING'}<div className="max-w-40 whitespace-normal text-xs text-amber-700">{s.summary?.flags.join(', ')}</div></td><td className="p-3">{s.summary?.medianRT?.toFixed(0) ?? '—'} ms<div className="text-xs text-slate-500">n={s.summary?.responses ?? 0}</div></td><td className="p-3">{s.summary?.slowPercent?.toFixed(1) ?? '—'}%<div className="text-xs text-slate-500">exploratory ≥355 ms</div></td><td className="p-3">{s.summary?.falseStarts ?? '—'}</td><td className="p-3">{base.deltaPercent === null ? `${base.days}/7 prior eligible days` : `${base.deltaPercent > 0 ? '+' : ''}${base.deltaPercent.toFixed(1)}% median RT`}<div className="text-xs text-slate-500">{base.reference?.toFixed(0) ?? '—'} ms reference</div></td><td className="p-3">{s.context.posture}<div>Caffeine: {s.context.caffeine ? 'yes' : 'no'}</div><div>Awake: {s.context.minutesAwake} min</div></td></tr>
      })}</tbody></table></div>
      {!rows.length && <p className="py-6 text-center text-slate-500">No PVT attempts for this survey and date.</p>}
    </section>
  </div>
}
