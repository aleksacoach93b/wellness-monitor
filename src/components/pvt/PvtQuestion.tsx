'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, Clock3, Focus, Loader2, Play, X } from 'lucide-react'
import { getSurveyBodyMapTokens, getSurveyShellClasses, getSurveyUiTokens, type SurveyAppearanceTheme } from '@/lib/surveyFormAppearance'
import { pvtDuration, parsePvtAnswer } from '@/lib/pvt/options'
import { PVT_VERSION, summarizePvt, type PvtResult } from '@/lib/pvt/protocol'
import PvtRun from './PvtRun'

type Attempt = { id: string; token: string; duration: number; version: string }
type Pending = { attempt: Attempt; result: PvtResult; practice: boolean }
export default function PvtQuestion({ surveyId, question, playerId, theme = 'dark', value, onChange, demo = false, password: suppliedPassword }: {
  surveyId: string; question: { id: string; options?: string | null }; playerId: string; theme?: SurveyAppearanceTheme; value: string; onChange: (value: string) => void; demo?: boolean; password?: string
}) {
  const ui = getSurveyUiTokens(theme), modal = getSurveyBodyMapTokens(theme), shell = getSurveyShellClasses(theme)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [saved, setSaved] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [posture, setPosture] = useState('seated')
  const [caffeine, setCaffeine] = useState(false)
  const [minutesAwake, setMinutesAwake] = useState(demo ? '30' : '')
  const [practice, setPractice] = useState(false)
  const launch = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const storageKey = `wm-pvt-pending:${surveyId}:${question.id}:${playerId}`
  const completed = parsePvtAnswer(value)
  const duration = pvtDuration(question.options)
  useEffect(() => {
    try { const raw = sessionStorage.getItem(storageKey); if (raw) { const record = JSON.parse(raw) as Pending; if (record.attempt?.token && record.result?.trials) { setPending(record); setOpen(true) } } } catch { /* Storage unavailable: keep live result on screen. */ }
  }, [storageKey])
  useEffect(() => {
    if (!open) return
    const returnFocus = launch.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; returnFocus?.focus() }
  }, [open])
  const send = async (record: Pending) => {
    setBusy(true); setError('')
    try {
      if (!demo) {
        const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'finish', id: record.attempt.id, token: record.attempt.token, result: record.result }), signal: AbortSignal.timeout(15000) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to save. Retry this result.')
      }
      setSaved(record); setPending(null)

    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Retry this result.') }
    finally { setBusy(false) }
  }
  const begin = async () => {
    setBusy(true); setError('')
    try {
      if (demo) { setAttempt({ id: 'demo', token: 'demo', duration: practice ? 30 : duration, version: PVT_VERSION }); return }
      if (!playerId) throw new Error('Choose your player profile in the kiosk before starting.')
      let deviceId = localStorage.getItem('pvt-device-id')
      if (!deviceId) { deviceId = crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)); localStorage.setItem('pvt-device-id', deviceId) }
      const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', questionId: question.id, protocolVersion: PVT_VERSION, playerId, password: suppliedPassword ?? (password || undefined), practice, context: { posture, caffeine, minutesAwake: Number(minutesAwake), deviceId } }), signal: AbortSignal.timeout(15000) })
      const data = await response.json()
      if (response.status === 401) setNeedsCode(true)
      if (!response.ok) throw new Error(data.error || 'Unable to start test.')
      setAttempt(data); setPassword('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start test.') }
    finally { setBusy(false) }
  }
  const finish = (result: PvtResult) => {
    if (!attempt) return
    const record = { attempt, result, practice }
    setAttempt(null); setPending(record)
    try { if (!demo) sessionStorage.setItem(storageKey, JSON.stringify(record)) } catch { setError('Keep this screen open until your result is saved.') }
    void send(record)
  }
  const close = () => { setOpen(false); setSaved(null); setError('') }
  const done = () => {
    if (!saved) return
    if (!saved.practice && !saved.result.interruption) onChange(JSON.stringify({ kind: 'PVT', attemptId: saved.attempt.id, token: saved.attempt.token, durationSeconds: saved.attempt.duration, ...summarizePvt(saved.result, saved.attempt.duration) }))
    try { sessionStorage.removeItem(storageKey) } catch { /* optional browser storage */ }
    close()
  }
  const button = `inline-flex min-h-12 items-center justify-center gap-2 px-5 py-3 font-semibold text-white disabled:opacity-50 ${ui.primaryCtaButton} ${ui.focusVisibleRing}`
  return <>
    <div className={`mt-3 rounded-2xl border p-4 sm:p-5 ${ui.sliderCardBorder}`}>
      <div className="flex items-center gap-3"><div className={`rounded-xl p-3 ${ui.selectedValuePill} ${ui.selectedValueText}`}>{completed ? <CheckCircle2 size={24} /> : <Focus size={24} />}</div><div className="flex-1"><p className="text-base font-semibold text-white">{completed ? 'Completed' : 'Focus test'}</p><p className="text-sm text-slate-300">{completed ? `${completed.durationSeconds} seconds · Ready to submit with your wellness` : `${duration} seconds · One signal. One tap.`}</p></div></div>
      {!completed && <><p className="mt-3 text-sm leading-relaxed text-slate-300">Hold your phone comfortably. Wait for the counter, then tap as quickly as you can.</p><button ref={launch} type="button" className={`${button} mt-4 w-full sm:w-auto`} onClick={() => setOpen(true)}><Play size={17} />Start Focus test</button></>}
      {completed && <p className={`mt-3 flex items-center gap-2 text-sm ${ui.selectedValueText}`}><Check size={16} />Test complete. Continue your questionnaire.</p>}
    </div>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="Focus test" ref={dialog} tabIndex={-1} className={`fixed inset-0 z-[10000] overflow-y-auto text-white outline-none ${shell.root}`} onKeyDown={e => {
      if (e.key === 'Escape' && !attempt && !pending && !saved) close()
      if (e.key === 'Tab') { const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'); if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }
    }}>
      {attempt ? <PvtRun duration={attempt.duration} theme={theme} onFinish={finish} /> : <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6 sm:py-10">
        <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Focus className={ui.selectedValueText} size={24} /><span className="text-lg font-semibold">Focus test</span></div>{!pending && !saved && <button type="button" aria-label="Close Focus test" className={`rounded-xl p-3 ${ui.closeButton}`} onClick={close}><X size={22} /></button>}</header>
        <div className={`my-auto rounded-3xl border p-6 sm:p-8 ${shell.card}`}>
          {pending || saved ? <div className="space-y-5 text-center">
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${ui.selectedValuePill} ${ui.selectedValueText}`}>{busy ? <Loader2 size={36} className="animate-spin" /> : <CheckCircle2 size={36} />}</div>
            <h2 className="text-2xl font-semibold">{pending ? 'Saving your test…' : saved?.result.interruption ? 'Attempt stopped' : saved?.practice ? 'Practice complete' : 'Test complete'}</h2>
            <p className="text-sm leading-6 text-slate-300">{pending ? 'Keep this screen open. Your result will be saved for your coach.' : saved?.result.interruption ? 'Your coach can see this attempt. Return to the question to complete a full test.' : saved?.practice ? 'Practice is saved separately. Complete the assigned test to finish this question.' : 'Your result is saved. Tap Done to return to your wellness questionnaire.'}</p>
            {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
            {pending && !busy && <button type="button" className={`${button} w-full`} onClick={() => void send(pending)}>Retry save</button>}
            {saved && <button type="button" data-testid="pvt-done" className={`${button} w-full`} onClick={done}><Check size={20} />Done</button>}
          </div> : <div className="space-y-5">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${ui.selectedValuePill} ${ui.selectedValueText}`}><Clock3 size={16} />{practice ? 30 : duration} seconds {practice ? '· Practice' : '· Standard protocol'}</div>
            <h2 className="text-2xl font-semibold tracking-tight">Ready when you are.</h2>
            <ol className="space-y-3 text-sm leading-6 text-slate-300"><li><strong className="text-white">1.</strong> Hold the phone upright, with your thumb close to TAP.</li><li><strong className="text-white">2.</strong> Wait until the counter appears. Timing changes each time.</li><li><strong className="text-white">3.</strong> Tap once, as fast as you can. Do not guess.</li></ol>
            <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-xs text-slate-300">Position<select className={`w-full p-2.5 text-sm text-white ${ui.inputFieldBase}`} value={posture} onChange={e => setPosture(e.target.value)}><option value="seated">Seated</option><option value="reclined">Reclined</option><option value="lying">Lying down</option></select></label><label className="space-y-1 text-xs text-slate-300">Minutes since waking<input className={`w-full p-2.5 text-sm text-white ${ui.inputFieldBase}`} type="number" inputMode="numeric" min={0} max={1440} value={minutesAwake} onChange={e => setMinutesAwake(e.target.value)} /></label></div>
            <label className="flex items-center justify-between text-sm text-slate-300">Already had caffeine<input type="checkbox" checked={caffeine} onChange={e => setCaffeine(e.target.checked)} /></label>
            <label className="flex items-center justify-between text-sm text-slate-300">Practice only · 30 seconds<input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} /></label>
            {needsCode && <label className="block text-sm">Player access code<input autoComplete="off" type="password" className={`mt-2 w-full p-3 text-white ${ui.inputFieldBase}`} value={password} onChange={e => setPassword(e.target.value)} /></label>}
            <p className="text-xs leading-5 text-slate-400">Use the same phone, thumb and position each day. Turn on Do Not Disturb. Leaving this screen stops the attempt.</p>
            {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
            <button type="button" className={`${button} w-full`} disabled={busy || minutesAwake === '' || !Number.isInteger(Number(minutesAwake)) || Number(minutesAwake) < 0 || Number(minutesAwake) > 1440} onClick={() => void begin()}>{busy ? <Loader2 size={19} className="animate-spin" /> : <Play size={18} />}{busy ? 'Getting ready…' : 'Begin test'}</button>
          </div>}
        </div><p className={`text-center text-xs ${modal.emptyHint}`}>{demo ? 'Demo · No player data saved' : 'Your results are shared with your coaching staff'}</p>
      </div>}
    </div>, document.body)}
  </>
}
