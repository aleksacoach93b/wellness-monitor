'use client'

import CSVLinkModal from '@/app/admin/surveys/[id]/results/CSVLinkModal'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isPvtDuration } from '@/lib/pvt/protocol'
import { baselineFor, type PvtSessionRow } from '@/lib/pvt/baseline'

type Survey = { id: string; title: string; timezone: string; questions: { id: string; text: string; options: string | null }[] }
type Config = { surveyId: string; enabled: boolean; durationSeconds: number }
type Data = { enabled: boolean; ready: boolean; surveys: Survey[]; configs: Config[]; sessions: PvtSessionRow[]; baselines?: Record<string, ReturnType<typeof baselineFor>>; truncated?: boolean; error?: string }
const control = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900'
export default function PvtAdmin() {
  const lastSurvey = useRef('')
  const [data, setData] = useState<Data | null>(null)
  const [surveyId, setSurveyId] = useState('')
  const [questionId, setQuestionId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [history, setHistory] = useState(false)
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    const response = await fetch('/api/pvt/admin', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load PVT')
    setData(payload)
    return payload as Data
  }
  useEffect(() => { void load().then(d => {
    const params = new URLSearchParams(window.location.search)
    const requestedPlayer = params.get('playerId') || ''
    const requestedSurvey = params.get('surveyId') || d.sessions.find(s => s.playerId === requestedPlayer)?.surveyId
    setSurveyId(d.surveys.find(s => s.id === requestedSurvey)?.id || d.surveys.find(s => s.questions.length > 0)?.id || d.surveys[0]?.id || '')
    setPlayerId(requestedPlayer)
    setQuestionId(params.get('questionId') || '')
    if (requestedPlayer && !params.get('date')) setHistory(true)
  }).catch(e => setError(e.message)) }, [])
  useEffect(() => {
    const timezone = data?.surveys.find(s => s.id === surveyId)?.timezone || 'Europe/Belgrade'
    if (lastSurvey.current !== surveyId) {
      const requested = !lastSurvey.current ? new URLSearchParams(window.location.search).get('date') : null
      setDate(requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
      lastSurvey.current = surveyId
    }
  }, [surveyId, data])
  const rows = useMemo(() => data?.sessions.filter(s => s.surveyId === surveyId && (!questionId || s.questionId === questionId) && (!playerId || s.playerId === playerId) && (history || s.localDate === date)) || [], [data, surveyId, date, questionId, playerId, history])
  const referenceFor = (s: PvtSessionRow) => data?.baselines?.[s.id] || baselineFor(s, data?.sessions || [])
  const official = rows.filter(s => !s.practice && s.status === 'COMPLETED')
  const selectedSurvey = data?.surveys.find(s => s.id === surveyId)
  const exportCsv = () => {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`
    const table = [['Player', 'Question ID', 'Attempt ID', 'Response ID', 'Date', 'Started', 'Duration', 'Protocol', 'Practice', 'Status', 'Quality', 'Responses', 'Median RT ms', 'Response speed 1/s', 'Slow >=355ms percent (exploratory)', 'False starts', 'Posture', 'Caffeine', 'Minutes awake', 'Flags', 'Reference days', 'Reference median RT ms', 'Median RT change percent'],
      ...rows.map(s => [s.player.firstName + ' ' + s.player.lastName, s.questionId, s.id, (s as PvtSessionRow & { responseId?: string }).responseId, s.localDate, s.startedAt, s.durationSeconds, s.protocolVersion, s.practice, s.status, s.summary?.quality, s.summary?.responses, s.summary?.medianRT, s.summary?.responseSpeed, s.summary?.slowPercent, s.summary?.falseStarts, s.context.posture, s.context.caffeine, s.context.minutesAwake, s.summary?.flags.join('; '), referenceFor(s).days, referenceFor(s).reference, referenceFor(s).deltaPercent])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + table.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `pvt-${date}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="admin-kicker">PLAYER MONITORING</p><h1 className="admin-title">Focus · Attention</h1><p className="admin-sub">Results, test context and personal reference</p></div>{selectedSurvey && <div className="flex flex-wrap gap-3"><CSVLinkModal surveyId={surveyId} surveyTitle={selectedSurvey.title} /><a href={`/admin/ops?surveyId=${surveyId}&date=${date}`} className="admin-btn admin-btn-ghost">Live Ops</a></div>}</header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Focus summary">
      {[
        ['Players completed', new Set(official.map(s => s.playerId)).size],
        ['Completed tests · quality review', official.filter(s => s.summary?.quality !== 'OK').length],
        ['Completed tests · linked to wellness', official.filter(s => s.responseId).length],
        ['Practice / unfinished attempts', rows.filter(s => s.practice || s.status !== 'COMPLETED').length],
      ].map(([label, value]) => <div key={label} className="admin-panel p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-3xl text-slate-900">{value}</strong></div>)}
    </section>
    <div className="admin-panel space-y-3 p-5 text-sm text-slate-700">
      <p><strong>Same task, unpredictable timing.</strong> Hold the phone upright, use the same thumb, posture and device. Respond to the fixed visual counter after a random 1–4 s wait. No camera or microphone.</p>
      <p>30/60 s are experimental short checks. This implementation requires timing validation. Results are not a diagnosis, injury predictor or overall readiness score. A ≥355 ms response is an exploratory brief-PVT reference, not a fatigue cutoff.</p>
      <p>Main wellness CSV includes the exact result submitted with each questionnaire. Completed tests awaiting wellness submission, repeats and practice remain visible here. The demo saves no data.</p>
      <p>The donut fills over 0–500 ms; reaction times continue beyond 500 ms. This is a visual scale, not a fatigue threshold. Earlier square-counter sessions keep their original version and separate personal references.</p>
      <p>Inspect session opens the reaction timeline, distribution, mean RT, sample SD/CV, personal comparisons and first/second-half analysis. Historical analytics are derived from original trials without rewriting saved scores. The main wellness CSV and permanent CSV link include these descriptive metrics.</p>
      <p>Practice is separate. All attempts remain in history. Prior reference uses the first eligible attempt per day, at least 7 prior eligible days within the preceding 28 calendar days (up to 14 days used), matching player, survey, duration, version, device/browser, posture and caffeine. It is descriptive and does not establish meaningful-change thresholds.</p>
      <a className="font-bold text-teal-700 underline" href="/pvt/demo" target="_blank" rel="noreferrer">Open isolated player demo (no data saved)</a>
    </div>
    {data?.truncated && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">The latest results limit was reached. Some attempts or reference days may be missing from this view. The main wellness CSV includes the full submitted history.</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
    {data?.configs.some(c => c.surveyId === surveyId && !isPvtDuration(c.durationSeconds)) && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This survey uses a retired duration. Choose 30 or 60 seconds and save before new attempts can start. Historical results are retained.</p>}
    {data && !data.ready && <div className="admin-panel p-5"><strong>Module is inactive.</strong><p>{data.enabled ? data.error : 'PVT_ENABLED is off. Existing wellness flows are unchanged. Enable only on an isolated preview database after reviewing the additive migration.'}</p></div>}
    <section className="admin-panel flex flex-wrap items-end gap-4 p-5">
      <label className="flex flex-col gap-1 text-sm">Survey<select className={control} value={surveyId} onChange={e => { setSurveyId(e.target.value); setQuestionId(''); setPlayerId('') }}>{data?.surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Focus question<select className={control} value={questionId} onChange={e => setQuestionId(e.target.value)}><option value="">All questions</option>{data?.surveys.find(s => s.id === surveyId)?.questions.map(q => <option key={q.id} value={q.id}>{q.text}</option>)}</select></label>
      <a className="admin-btn admin-btn-primary" href={`/admin/surveys/${surveyId}/edit`}>Configure questions</a>
    </section>
    <section className="admin-panel space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-4 text-sm"><label>Player <select className={control} value={playerId} onChange={e => setPlayerId(e.target.value)}><option value="">Whole squad</option>{Array.from(new Map((data?.sessions || []).filter(s => s.surveyId === surveyId).map(s => [s.playerId, s.player])).entries()).map(([id, p]) => <option key={id} value={id}>{p.firstName} {p.lastName}</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Show 28-day history</label></div>
      <div className="flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1 text-sm">Team calendar date<input type="date" className={control} value={date} onChange={e => setDate(e.target.value)} /></label><button className="admin-btn admin-btn-ghost" onClick={() => void load().catch(e => setError(e.message))}>Refresh</button><button disabled={!rows.length} className="admin-btn admin-btn-ghost" onClick={exportCsv}>Export attempts CSV</button></div>
      <p className="text-sm text-slate-600">{new Set(rows.filter(s => !s.practice && s.status === 'COMPLETED').map(s => s.playerId)).size} players completed · {rows.length} attempts. Review quality before interpretation. Positive Δ means slower than personal reference; it is not a fatigue percentage.</p>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b text-slate-500"><tr>{['Player', 'Attempt', 'Protocol', 'Quality', 'Median RT', 'Slow responses', 'Early taps', 'Personal reference', 'Context', 'Wellness CSV', 'Raw data'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(s => {
        const base = referenceFor(s)
        const sameDay = rows.filter(x => x.localDate === s.localDate && x.questionId === s.questionId && x.durationSeconds === s.durationSeconds && x.playerId === s.playerId && !x.practice && x.status === 'COMPLETED')
        const repeat = !s.practice && sameDay[0]?.id !== s.id && sameDay.some(x => x.id === s.id)
        return <tr key={s.id} className="border-b align-top"><td className="p-3 font-bold">{s.player.firstName} {s.player.lastName}<div className="font-normal text-slate-500">{new Date(s.startedAt).toLocaleString('en-GB', { timeZone: data?.surveys.find(x => x.id === s.surveyId)?.timezone || 'Europe/Belgrade' })}</div></td><td className="p-3">{s.practice ? 'PRACTICE' : repeat ? 'REPEAT' : 'OFFICIAL'}<div>{s.status}</div></td><td className="p-3">{s.durationSeconds} s<div className="text-xs text-slate-500">{s.protocolVersion}</div></td><td className="p-3">{s.summary?.quality || 'PENDING'}<div className="max-w-40 whitespace-normal text-xs text-amber-700">{s.summary?.flags.join(', ')}</div></td><td className="p-3">{s.summary?.medianRT?.toFixed(0) ?? '—'} ms<div className="text-xs text-slate-500">n={s.summary?.responses ?? 0}</div></td><td className="p-3">{s.summary?.slowPercent?.toFixed(1) ?? '—'}%<div className="text-xs text-slate-500">exploratory ≥355 ms</div></td><td className="p-3">{s.summary?.falseStarts ?? '—'}</td><td className="p-3">{base.deltaPercent === null ? `${base.days}/7 prior eligible days` : `${base.deltaPercent > 0 ? '+' : ''}${base.deltaPercent.toFixed(1)}% median RT`}<div className="text-xs text-slate-500">{base.reference?.toFixed(0) ?? '—'} ms reference</div></td><td className="p-3">{s.context.posture}<div>Caffeine: {s.context.caffeine ? 'yes' : 'no'}</div><div>Awake: {s.context.minutesAwake} min</div></td><td className="p-3">{s.responseId ? 'Included' : s.practice ? 'Practice only' : s.status === 'COMPLETED' ? 'Awaiting wellness' : s.status === 'INVALID' ? 'Repeat required' : 'Not completed'}</td><td className="p-3"><a className="mb-2 block font-semibold text-teal-700 underline" href={`/admin/pvt/session/${encodeURIComponent(s.id)}`}>Inspect session</a><a className="text-teal-700 underline" href={`/api/pvt/admin/${s.id}`} target="_blank" rel="noreferrer">Trial data JSON</a></td></tr>
      })}</tbody></table></div>
      {!rows.length && <p className="py-6 text-center text-slate-500">No Focus attempts for these filters.</p>}
    </section>
  </div>
}
