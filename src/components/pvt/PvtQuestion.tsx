'use client'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Armchair, ArrowRight, BedDouble, Check, CheckCircle2, Clock3, Coffee, Focus, Hand, Loader2, PersonStanding, Play, RotateCcw, ShieldCheck, Smartphone, Sofa, X } from 'lucide-react'
import { getSurveyBodyMapTokens, getSurveyShellClasses, getSurveyUiTokens, type SurveyAppearanceTheme } from '@/lib/surveyFormAppearance'
import { pvtDuration, parsePvtAnswer } from '@/lib/pvt/options'
import { PVT_VERSION, minimumResponses, pvtRepeatMessage, summarizePvt, type PvtResult } from '@/lib/pvt/protocol'
import PvtRun from './PvtRun'
import './pvt-focus.css'

const AWAKE_PRESETS = [30, 60, 90, 120, 180, 240] as const
const POSITIONS = [{ value: 'seated', label: 'Seated', icon: Armchair }, { value: 'standing', label: 'Standing', icon: PersonStanding }, { value: 'reclined', label: 'Reclined', icon: Sofa }, { value: 'lying', label: 'Lying down', icon: BedDouble }] as const

type Attempt = { id: string; token: string; duration: number; version: string }
type Pending = { attempt: Attempt; result: PvtResult; practice: boolean; summary?: ReturnType<typeof summarizePvt> }
export default function PvtQuestion({ surveyId, question, playerId, theme = 'dark', value, onChange, demo = false, password: suppliedPassword }: {
  surveyId: string; question: { id: string; options?: string | null }; playerId: string; theme?: SurveyAppearanceTheme; value: string; onChange: (value: string) => void; demo?: boolean; password?: string
}) {
  const awakeId = useId()
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
  const stage = attempt ? 'run' : pending || saved ? 'result' : 'setup'
  const savedSummary = saved ? saved.summary ?? summarizePvt(saved.result, saved.attempt.duration, saved.attempt.version) : null
  const repeatRequired = !!saved && (!savedSummary || savedSummary.repeatRequired || !!saved.result.interruption)
  const repeatReasons = savedSummary?.repeatReasons ?? []
  const repeatReason = repeatReasons.find(reason => ['early-limit', 'missed-signal'].includes(reason)) ?? repeatReasons[0] ?? 'incomplete-window'
  useLayoutEffect(() => {
    // The setup can scroll on a phone; every new stage must start at its top.
    dialog.current?.scrollTo({ top: 0 })
  }, [open, stage])
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
      let summary = summarizePvt(record.result, record.attempt.duration, record.attempt.version)
      if (!demo) {
        const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'finish', id: record.attempt.id, token: record.attempt.token, result: record.result }), signal: AbortSignal.timeout(15000) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to save. Retry this result.')
        summary = { ...summary, ...data.summary, repeatRequired: summary.repeatRequired || data.summary?.repeatRequired || data.status !== 'COMPLETED' }
      }
      setSaved({ ...record, summary }); setPending(null)

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
    if (!saved.practice && !repeatRequired) onChange(JSON.stringify({ kind: 'PVT', attemptId: saved.attempt.id, token: saved.attempt.token, durationSeconds: saved.attempt.duration, ...summarizePvt(saved.result, saved.attempt.duration, saved.attempt.version) }))
    try { sessionStorage.removeItem(storageKey) } catch { /* optional browser storage */ }
    close()
  }
  const button = `inline-flex min-h-12 items-center justify-center gap-2 px-5 py-3 font-semibold text-white disabled:opacity-50 ${ui.primaryCtaButton} ${ui.focusVisibleRing}`
  return <>
    <div data-pvt-theme={theme} className={`pvt-ui pvt-question-card mt-3 rounded-2xl border p-4 sm:p-5 ${ui.sliderCardBorder}`}>
      <div className="flex items-center gap-3"><div className={`rounded-xl p-3 ${ui.selectedValuePill} ${ui.selectedValueText}`}>{completed ? <CheckCircle2 size={24} /> : <Focus size={24} />}</div><div className="flex-1"><p className="text-base font-semibold text-white">{completed ? 'Completed' : 'Focus test'}</p><p className="text-sm text-slate-300">{completed ? `${completed.durationSeconds} seconds · Ready to submit with your wellness` : `${duration} seconds · One signal. One tap.`}</p></div></div>
      {!completed && <><p className="mt-3 text-sm leading-relaxed text-slate-300">Hold your phone comfortably. Wait for the counter, then tap as quickly as you can.</p><button ref={launch} type="button" className={`${button} mt-4 w-full sm:w-auto`} onClick={() => setOpen(true)}><Play size={17} />Start Focus test</button></>}
      {completed && <p className={`mt-3 flex items-center gap-2 text-sm ${ui.selectedValueText}`}><Check size={16} />Test complete. Continue your questionnaire.</p>}
    </div>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="Focus test" ref={dialog} tabIndex={-1} data-pvt-theme={theme} className={`pvt-ui pvt-dialog fixed inset-0 z-[10000] overflow-y-auto text-white outline-none ${shell.root}`} onKeyDown={e => {
      if (e.key === 'Escape' && !attempt && !pending && !saved) close()
      if (e.key === 'Tab') { const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'); if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }
    }}>
      {attempt ? <PvtRun duration={attempt.duration} theme={theme} onFinish={finish} /> : <div className="pvt-dialog-inner">
        <div className="pvt-dialog-content">
        <div className="pvt-glass-panel">
          <header className="pvt-dialog-header"><div className="pvt-wordmark"><span className="pvt-brand-mark"><Focus size={23} /></span><div><span>Focus test</span><small>DAILY CHECK-IN</small></div></div><div className="pvt-header-controls">{!pending && !saved && <><span className="pvt-protocol-pill"><Clock3 size={14} />{practice ? 30 : duration}s · {practice ? 'Practice' : 'Standard'}</span><button type="button" aria-label="Close Focus test" className={`pvt-close ${ui.closeButton}`} onClick={close}><X size={18} /></button></>}</div></header>
          {pending || saved ? <div className="pvt-result-panel">
            <span className="pvt-kicker">{pending ? 'SAVING YOUR SESSION' : repeatRequired ? 'REPEAT REQUIRED' : 'SESSION COMPLETE'}</span>
            <div className="pvt-success-halo"><div className="pvt-success-icon">{busy ? <Loader2 size={38} className="animate-spin" /> : repeatRequired ? <RotateCcw size={38} /> : <CheckCircle2 size={38} />}</div></div>
            {saved && !repeatRequired && savedSummary && <div className="pvt-completion-median" data-testid="pvt-completion-median">
              <span>Median reaction time</span>
              <strong><span data-testid="pvt-completion-median-value">{savedSummary.medianRT == null ? '—' : Math.round(savedSummary.medianRT)}</span>{savedSummary.medianRT != null && <small>ms</small>}</strong>
              <p>{savedSummary.medianRT == null ? 'No valid responses recorded' : `${savedSummary.responses} recorded ${savedSummary.responses === 1 ? 'response' : 'responses'}`}</p>
            </div>}
            <h2>{pending ? 'Saving your test…' : repeatRequired ? 'Repeat test' : saved?.practice ? 'Practice complete' : 'You’re all set.'}</h2>
            <p className="pvt-result-copy">{pending ? 'Keep this screen open. Your result will be saved for your coach.' : repeatRequired ? pvtRepeatMessage(repeatReason) : saved?.practice ? 'Practice is saved separately. Complete the assigned test to finish this question.' : 'Your test is complete and your result is saved. Continue with your wellness questionnaire.'}</p>
            {saved && <div className="pvt-saved-receipt"><ShieldCheck size={18} /><span>{saved.attempt.duration} seconds · {repeatRequired ? 'Attempt not accepted' : demo ? 'Demo session' : 'Saved for your coach'}</span><Check size={16} /></div>}
            {error && <p role="alert" className="pvt-alert">{error}</p>}
            {pending && !busy && <button type="button" className={`pvt-action ${button}`} onClick={() => void send(pending)}>Retry save<RotateCcw size={18} /></button>}
            {saved && repeatRequired && <button type="button" data-testid="pvt-repeat" className={`pvt-action ${button}`} onClick={() => { setSaved(null); setError(''); try { sessionStorage.removeItem(storageKey) } catch { /* optional browser storage */ } }}><span>Repeat test</span><RotateCcw size={20} /></button>}
            {saved && repeatRequired && <button type="button" className="pvt-stop" onClick={done}>Back to questionnaire</button>}
            {saved && !repeatRequired && <button type="button" data-testid="pvt-done" className={`pvt-action ${button}`} onClick={done}>Done<ArrowRight size={20} /></button>}
          </div> : <div className="pvt-setup-panel">
            <h2>Find your <span>focus.</span></h2>
            <ol className="pvt-instruction-grid">
              <li><span className="pvt-instruction-icon"><Smartphone size={23} /></span><span>Hold your<br />phone upright</span></li>
              <li><span className="pvt-instruction-icon"><Focus size={23} /></span><span>Wait for<br />the counter</span></li>
              <li><span className="pvt-instruction-icon"><Hand size={23} /></span><span>Tap once<br />when it appears</span></li>
            </ol>
            <p className="pvt-consistency-note" data-testid="pvt-completion-rules"><ShieldCheck size={16} /><span>Complete all {practice ? 30 : duration} seconds with at least {minimumResponses(practice ? 30 : duration)} responses. Three early taps or one unanswered signal (3 seconds) means repeat. Each early tap restarts the wait.</span></p>
            <div className="pvt-session-context">
            <div className="pvt-context-divider"><span>Session context</span><span>Keep it consistent</span></div>
            <fieldset className="pvt-position-field"><legend>Position</legend><div className="pvt-position-options">{POSITIONS.map(({ value: position, label, icon: Icon }) => <button type="button" key={position} aria-label={`Position: ${label}`} aria-pressed={posture === position} className={`pvt-position-choice ${ui.focusVisibleRing}`} onClick={() => setPosture(position)}><Icon size={20} /><span>{label}</span><span className="pvt-selection-check">{posture === position && <Check size={10} strokeWidth={3} />}</span></button>)}</div></fieldset>
            <div className="pvt-awake-field"><div className="pvt-field-heading"><label htmlFor={awakeId}>Minutes since waking</label><span>Choose or enter</span></div><div className="pvt-awake-presets" role="group" aria-label="Minutes since waking presets">{AWAKE_PRESETS.map(minutes => <button type="button" key={minutes} aria-label={`${minutes} minutes since waking`} aria-pressed={minutesAwake !== '' && Number(minutesAwake) === minutes} className={ui.focusVisibleRing} onClick={() => setMinutesAwake(String(minutes))}><span className="pvt-preset-number">{minutes}</span></button>)}</div><div className="pvt-manual-input"><Clock3 size={17} /><span className="pvt-manual-label">Or enter manually</span><input id={awakeId} type="number" inputMode="numeric" min={0} max={1440} step={1} placeholder="Minutes" value={minutesAwake} onChange={e => setMinutesAwake(e.target.value)} /><span>min</span></div></div>
            </div>
            <div className="pvt-toggle-grid">
              <label className={`pvt-toggle-card ${caffeine ? 'is-checked' : ''}`}><Coffee size={19} /><span><strong>Already had caffeine</strong><small>Before this check-in</small></span><input type="checkbox" checked={caffeine} onChange={e => setCaffeine(e.target.checked)} /><span className="pvt-switch" aria-hidden="true" /></label>
              <label className={`pvt-toggle-card ${practice ? 'is-checked' : ''}`}><RotateCcw size={19} /><span><strong>Practice only</strong><small>30 seconds · separate result</small></span><input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} /><span className="pvt-switch" aria-hidden="true" /></label>
            </div>
            {needsCode && <label className="pvt-code-field">Player access code<input autoComplete="off" type="password" className={`mt-2 w-full p-3 text-white ${ui.inputFieldBase}`} value={password} onChange={e => setPassword(e.target.value)} /></label>}
            <p className="pvt-consistency-note"><ShieldCheck size={16} /><span>Same phone, thumb and position each day. Do Not Disturb on. Leaving this screen stops the attempt.</span></p>
            {error && <p role="alert" className="pvt-alert">{error}</p>}
            <button type="button" className={`pvt-action ${button}`} disabled={busy || minutesAwake === '' || !Number.isInteger(Number(minutesAwake)) || Number(minutesAwake) < 0 || Number(minutesAwake) > 1440} onClick={() => void begin()}><span>{busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={17} />}{busy ? 'Getting ready…' : 'Begin test'}</span><ArrowRight size={19} /></button>
          </div>}
        </div></div><p className={`pvt-dialog-footer ${modal.emptyHint}`}><ShieldCheck size={13} />{demo ? 'Demo · No player data saved' : 'Your results are shared with your coaching staff'}</p>
      </div>}
    </div>, document.body)}
  </>
}
