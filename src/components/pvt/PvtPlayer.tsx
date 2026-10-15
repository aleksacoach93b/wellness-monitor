'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Activity, ArrowRight, ArrowUpRight, Check, CheckCircle2, Clock3, Coffee, RotateCcw, Smartphone } from 'lucide-react'
import PvtRun from './PvtRun'
import { PVT_DURATIONS, PVT_VERSION, isPvtDuration, summarizePvt, type PvtResult } from '@/lib/pvt/protocol'

type Attempt = { id: string; token: string; duration: number; version: string }
type Pending = { attempt: Attempt; result: PvtResult }

function Brand({ demo }: { demo: boolean }) {
  return <header className="pvt-header">
    <div className="pvt-brand"><span className="pvt-brand-symbol"><Activity size={20} strokeWidth={1.7} /></span><span>wellness<span className="pvt-brand-divider">/</span><strong>focus</strong></span></div>
    <span className="pvt-session-badge"><span />{demo ? 'DEMO SESSION' : 'DAILY CHECK-IN'}</span>
  </header>
}

export default function PvtPlayer({ surveyId }: { surveyId: string }) {
  const query = useSearchParams()
  const playerId = query.get('playerId') || ''
  const demo = surveyId === 'demo'
  const key = `pvt-pending:${surveyId}:${playerId}`
  const [duration, setDuration] = useState(30)
  const [available, setAvailable] = useState<boolean | null>(demo ? true : null)
  const [password, setPassword] = useState('')
  const [practice, setPractice] = useState(false)
  const [posture, setPosture] = useState('seated')
  const [caffeine, setCaffeine] = useState(false)
  const [minutesAwake, setMinutesAwake] = useState(demo ? '30' : '')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PvtResult | null>(null)
  const [resultDuration, setResultDuration] = useState(30)
  const [storageOK, setStorageOK] = useState(true)
  useEffect(() => {
    if (demo) return
    let disposed = false
    fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, { cache: 'no-store' })
      .then(r => r.json()).then(data => {
        if (!disposed) {
          setAvailable(data.enabled === true && isPvtDuration(data.duration))
          if (isPvtDuration(data.duration)) setDuration(data.duration)
        }
      }).catch(() => { if (!disposed) setAvailable(false) })
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        const record = JSON.parse(raw) as Pending
        if (record.attempt?.token && record.result?.trials) {
          setPending(record); setResult(record.result); setResultDuration(record.attempt.duration)
        }
      }
      sessionStorage.setItem('pvt-storage-check', '1'); sessionStorage.removeItem('pvt-storage-check')
    } catch { setStorageOK(false) }
    return () => { disposed = true }
  }, [demo, surveyId, key])
  const send = async (record: Pending) => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', id: record.attempt.id, token: record.attempt.token, result: record.result }),
        keepalive: true, signal: AbortSignal.timeout(15_000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Save failed')
      sessionStorage.removeItem(key); setPending(null); setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setBusy(false) }
  }
  const begin = async () => {
    setBusy(true); setError('')
    try {
      if (demo) { setAttempt({ id: 'demo', token: '', duration, version: PVT_VERSION }); return }
      if (!storageOK) throw new Error('Enable browser storage before testing.')
      let deviceId = localStorage.getItem('pvt-device-id')
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('pvt-device-id', deviceId) }
      const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', protocolVersion: PVT_VERSION, playerId, password, practice, context: { posture, caffeine, minutesAwake: Number(minutesAwake), deviceId } }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Start failed')
      setPassword(''); setAttempt(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Start failed') }
    finally { setBusy(false) }
  }
  const finish = (raw: PvtResult) => {
    if (!attempt) return
    setResult(raw); setResultDuration(attempt.duration)
    const record = { attempt, result: raw }
    setAttempt(null)
    if (demo) { setDone(true); return }
    setPending(record)
    try { sessionStorage.setItem(key, JSON.stringify(record)) } catch { setError('Keep this page open until your result is saved.') }
    void send(record)
  }
  if (attempt) return <PvtRun duration={attempt.duration} onFinish={finish} />
  const summary = result ? summarizePvt(result, resultDuration) : null
  if (result || pending) return <div className="pvt-app">
    <Brand demo={demo} />
    <section className="pvt-complete">
      <span className={`pvt-complete-icon ${result?.interruption ? 'is-interrupted' : ''}`}>{result?.interruption ? <RotateCcw size={30} /> : <CheckCircle2 size={32} />}</span>
      <p className="pvt-eyebrow">{demo ? 'DEMO COMPLETE' : 'CHECK-IN COMPLETE'}</p>
      <h1>{!done ? 'Saving your check.' : result?.interruption ? 'Session stopped.' : "You’re all set."}</h1>
      <p className="pvt-complete-copy">{demo ? 'Your demo results stay on this screen.' : done ? 'Your attempt is saved for your coaching staff.' : 'Keep this page open while your attempt is saved.'}</p>
      {demo && <div className="pvt-demo-metrics">
        <div><span>Median reaction</span><strong>{summary?.medianRT === null || !summary ? '—' : Math.round(summary.medianRT)}<small> ms</small></strong></div>
        <div><span>Responses</span><strong>{summary?.responses ?? 0}</strong></div>
        <div><span>Early taps</span><strong>{summary?.falseStarts ?? 0}</strong></div>
      </div>}
      {summary?.flags.length ? <p className="pvt-result-note">{result?.interruption ? 'Stopped attempts are excluded from your usual reference.' : 'This attempt needs a quality review before interpretation.'}</p> : null}
      {error && <p role="alert" className="pvt-error">{error}</p>}
      {pending && <><p className="pvt-result-note">Do not repeat the test. Retry sending this attempt.</p><button disabled={busy} className="pvt-primary" onClick={() => void send(pending)}>Retry save <ArrowRight size={20} /></button></>}
      {done && (demo ? <button className="pvt-primary" onClick={() => { setResult(null); setDone(false) }}>Back to setup <ArrowRight size={20} /></button> : <a className="pvt-primary" href={`/kiosk/${encodeURIComponent(surveyId)}`}>Finish check-in <Check size={20} /></a>)}
      <p className="pvt-complete-footnote">A check of attention. Not an overall training-readiness score.</p>
    </section>
    <footer className="pvt-footer"><span>WELLNESS / PERFORMANCE LAB</span><span>Vigilance & attention</span></footer>
  </div>
  if (available === null || !available || (!demo && !playerId)) return <div className="pvt-app"><Brand demo={demo} /><section className="pvt-complete"><p className="pvt-eyebrow">FOCUS CHECK</p><h1>{available === null ? 'Getting ready.' : 'Check back soon.'}</h1><p className="pvt-complete-copy">{available === null ? 'Loading your session.' : 'Open the test through your wellness profile. Any submitted wellness answers remain saved.'}</p>{available !== null && <a className="pvt-primary" href={`/kiosk/${encodeURIComponent(surveyId)}`}>Back to check-in <ArrowRight size={20} /></a>}</section></div>
  const validContext = minutesAwake !== '' && Number.isInteger(Number(minutesAwake)) && Number(minutesAwake) >= 0 && Number(minutesAwake) <= 1440
  return <div className="pvt-app">
    <Brand demo={demo} />
    <div className="pvt-setup-grid">
      <section className="pvt-intro">
        <p className="pvt-eyebrow"><span className="pvt-tiny-line" /> YOUR DAILY MOMENT OF FOCUS</p>
        <h1>Find your<br /><em>focus.</em></h1>
        <p className="pvt-intro-copy">A short check of your attention.<br />Just you, your phone, and one simple signal.</p>
        <div className="pvt-how">
          <div><span>01</span><p>Get comfortable<small>Same phone. Same posture. One thumb.</small></p></div>
          <div><span>02</span><p>Watch the signal<small>The counter starts at random intervals.</small></p></div>
          <div><span>03</span><p>Tap the pad<small>React as quickly as you can. Don’t guess.</small></p></div>
        </div>
        <div className="pvt-intro-bottom"><Smartphone size={16} /><span>No camera. No extra equipment.</span></div>
      </section>
      <section className="pvt-setup-card" aria-label="Session setup">
        <div className="pvt-card-heading"><span className="pvt-eyebrow">SESSION SETUP</span><ArrowUpRight size={20} /></div>
        <h2>A little time.<br /> Your full attention.</h2>
        <fieldset className="pvt-duration-field"><legend>Session length</legend>
          {demo ? <div className="pvt-duration-options">{PVT_DURATIONS.map(d => <button type="button" key={d} aria-pressed={duration === d} onClick={() => setDuration(d)} className={duration === d ? 'is-selected' : ''}><span><strong>{d}</strong> sec</span><small>{d === 30 ? 'Quick check' : 'Extended check'}</small><span className="pvt-choice-mark">{duration === d ? <Check size={13} strokeWidth={3} /> : null}</span></button>)}</div> : <div className="pvt-assigned-duration"><Clock3 size={20} /><strong>{practice ? 30 : duration} seconds</strong><span>Assigned by your coach</span></div>}
        </fieldset>
        {!demo && <label className="pvt-field">Player access code<input type="password" autoComplete="off" maxLength={100} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your code" /></label>}
        <details className="pvt-context" open={!demo}>
          <summary>Session context <span>Keep it consistent</span></summary>
          <div className="pvt-context-grid">
            <label className="pvt-field">Posture<select value={posture} onChange={e => setPosture(e.target.value)}><option value="seated">Seated</option><option value="reclined">Reclined / supported</option><option value="lying">Lying down</option></select></label>
            <label className="pvt-field">Minutes since waking<input type="number" min="0" max="1440" required value={minutesAwake} onChange={e => setMinutesAwake(e.target.value)} placeholder="e.g. 30" inputMode="numeric" /></label>
          </div>
          <label className="pvt-check-row"><span><Coffee size={16} />Already had caffeine</span><input type="checkbox" checked={caffeine} onChange={e => setCaffeine(e.target.checked)} /></label>
          {!demo && <label className="pvt-check-row"><span><RotateCcw size={16} />Practice run <small>30 sec · excluded from reference</small></span><input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} /></label>}
        </details>
        <div className="pvt-prepare-note"><span className="pvt-note-icon"><Smartphone size={18} /></span><p>Phone upright. Do Not Disturb on.<small>Leaving the screen stops your attempt.</small></p></div>
        {error && <p role="alert" className="pvt-error">{error}</p>}
        <button className="pvt-primary" disabled={busy || (!demo && !password) || !validContext} onClick={() => void begin()}><span>{busy ? 'Getting ready…' : 'Start test'}</span><ArrowRight size={22} /></button>
        <p className="pvt-card-footnote"><span className="pvt-status-dot" />{demo ? 'Demo only. No player data is saved.' : 'Your result is shared with your coaching staff.'}</p>
      </section>
    </div>
    <footer className="pvt-footer"><span>WELLNESS / PERFORMANCE LAB</span><details><summary>About this check</summary><p>Experimental 30/60 second handheld PVT adaptation. Tracks responses to a simple visual signal. Device timing and use for athlete monitoring require validation; this is not a diagnosis or an overall readiness score.</p></details></footer>
  </div>
}
