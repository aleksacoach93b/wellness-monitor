'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PvtRun from './PvtRun'
import { PVT_VERSION, summarizePvt, type PvtResult } from '@/lib/pvt/protocol'

type Attempt = { id: string; token: string; duration: number; version: string }
type Pending = { attempt: Attempt; result: PvtResult }
const button = 'min-h-12 w-full rounded-xl bg-teal-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50'
const field = 'min-h-12 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-white'

export default function PvtPlayer({ surveyId }: { surveyId: string }) {
  const query = useSearchParams()
  const sr = query.get('lang') === 'sr'
  const playerId = query.get('playerId') || ''
  const demo = surveyId === 'demo'
  const key = `pvt-pending:${surveyId}:${playerId}`
  const [duration, setDuration] = useState(180)
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
  const [resultDuration, setResultDuration] = useState(180)
  const [storageOK, setStorageOK] = useState(true)
  useEffect(() => {
    if (demo) return
    let disposed = false
    fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, { cache: 'no-store' })
      .then(r => r.json()).then(data => { if (!disposed) { setAvailable(data.enabled === true); if (data.enabled) setDuration(data.duration) } })
      .catch(() => { if (!disposed) setAvailable(false) })
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) { const record = JSON.parse(raw) as Pending; if (record.attempt?.token && record.result?.trials) { setPending(record); setResult(record.result); setResultDuration(record.attempt.duration) } }
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
        keepalive: true,
        signal: AbortSignal.timeout(15_000),
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
      if (demo) { setAttempt({ id: 'demo', token: '', duration: practice ? 60 : duration, version: PVT_VERSION }); return }
      if (!storageOK) throw new Error(sr ? 'Omogući čuvanje podataka u pregledaču.' : 'Enable browser storage before testing.')
      let deviceId = localStorage.getItem('pvt-device-id')
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('pvt-device-id', deviceId) }
      const response = await fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/pvt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', playerId, password, practice, context: { posture, caffeine, minutesAwake: Number(minutesAwake), deviceId } }),
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
    setResult(raw)
    setResultDuration(attempt.duration)
    const record = { attempt, result: raw }
    setAttempt(null)
    if (demo) { setDone(true); return }
    setPending(record)
    try { sessionStorage.setItem(key, JSON.stringify(record)) } catch { setError(sr ? 'Ne zatvaraj stranicu dok se rezultat ne pošalje.' : 'Keep this page open until your result is saved.') }
    void send(record)
  }
  if (attempt) return <PvtRun duration={attempt.duration} sr={sr} onFinish={finish} />
  const summary = result ? summarizePvt(result, resultDuration) : null
  if (result || pending) return <section className="space-y-5 py-8">
    <p className="text-sm font-bold text-teal-300">{demo ? 'DEMO · NOTHING SAVED' : 'PVT'}</p>
    <h1 className="text-3xl font-bold">{done ? (sr ? 'Pokušaj završen' : 'Attempt finished') : (sr ? 'Slanje rezultata…' : 'Saving result…')}</h1>
    <p>{summary?.flags.length ? (sr ? 'Pokušaj zahteva proveru kvaliteta.' : 'This attempt needs a quality review.') : (sr ? 'Hvala. Stručni štab će pregledati rezultat.' : 'Thank you. Your coaching staff will review the result.')}</p>
    <p className="text-sm text-slate-400">{sr ? 'Ovo nije ocena ukupne spremnosti za trening.' : 'This is not an overall training-readiness score.'}</p>
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {pending && <><p className="text-sm">{sr ? 'Ne ponavljaj test. Ostani na ovoj stranici i pokušaj slanje ponovo.' : 'Do not repeat the test. Keep this page open and retry saving.'}</p><button disabled={busy} className={button} onClick={() => void send(pending)}>{sr ? 'Ponovi slanje' : 'Retry save'}</button></>}
    {done && (demo ? <button className={button} onClick={() => { setResult(null); setDone(false) }}>Try another duration</button> : <a className={`${button} block text-center`} href={`/kiosk/${encodeURIComponent(surveyId)}${sr ? '?lang=sr' : ''}`}>{sr ? 'Završi / sledeći igrač' : 'Finish / next player'}</a>)}
  </section>
  if (available === null) return <p>Loading…</p>
  if (!available || (!demo && !playerId)) return <section className="space-y-5 py-8"><h1 className="text-2xl font-bold">{sr ? 'Test trenutno nije dostupan' : 'Testing is not available'}</h1><p>{sr ? 'Otvori test kroz svoj wellness profil. Ako je upitnik već poslat, on ostaje sačuvan.' : 'Open this test through your wellness profile. Any submitted wellness answers remain saved.'}</p><a className="underline" href={`/kiosk/${encodeURIComponent(surveyId)}`}>Kiosk</a></section>
  return <section className="space-y-5 py-4">
    <p className="text-xs font-bold tracking-widest text-teal-300">{demo ? 'ISOLATED DEMO · NO PLAYER DATA' : 'DAILY CHECK-IN · PVT'}</p>
    <h1 className="text-3xl font-bold">{sr ? 'Budnost i pažnja' : 'Vigilance & attention'}</h1>
    <p className="text-slate-300">{sr ? 'Drži telefon uspravno. Gledaj isto polje i dodirni dugme palcem čim se pojave brojevi. Ne pogađaj trenutak signala.' : 'Hold your phone upright. Watch the fixed box and tap the button with your thumb as soon as numbers appear. Do not anticipate the signal.'}</p>
    <p className="text-sm text-slate-400">{sr ? 'Koristi isti telefon, položaj i palac svakog dana. Uključi Ne uznemiravaj. Promena ekrana ili orijentacije prekida pokušaj. Probni pokušaj odradi pri prvom upoznavanju, pre redovnog praćenja.' : 'Use the same phone, posture and thumb each day. Enable Do Not Disturb. Switching away or rotating interrupts the attempt. Complete a practice attempt during familiarisation before regular monitoring.'}</p>
    {demo && <label className="block">Duration<select className={field} value={duration} onChange={e => setDuration(Number(e.target.value))}>{[60, 90, 180].map(d => <option key={d} value={d}>{d} seconds</option>)}</select></label>}
    <div className="rounded-xl border border-slate-700 p-4"><strong>{practice ? 60 : duration} {sr ? 'sekundi' : 'seconds'}</strong><p className="mt-1 text-sm text-slate-400">{duration < 180 || practice ? (sr ? 'Eksperimentalna kratka verzija.' : 'Experimental short version.') : (sr ? 'Adaptacija kratkog PVT protokola. Preciznost ove aplikacije još nije nezavisno validirana.' : 'Adaptation of brief PVT. Timing of this app has not yet been independently validated.')}</p></div>
    {!demo && <label className="block">{sr ? 'Tvoja igračka lozinka' : 'Your player access code'}<input className={field} type="password" autoComplete="off" maxLength={100} value={password} onChange={e => setPassword(e.target.value)} /></label>}
    <label className="block">{sr ? 'Položaj' : 'Posture'}<select className={field} value={posture} onChange={e => setPosture(e.target.value)}><option value="seated">{sr ? 'Sedeći' : 'Seated'}</option><option value="reclined">{sr ? 'Polusedeći / oslonjen' : 'Reclined / supported'}</option><option value="lying">{sr ? 'Ležeći' : 'Lying down'}</option></select></label>
    <label className="block">{sr ? 'Minuta od buđenja' : 'Minutes since waking'}<input className={field} type="number" min="0" max="1440" required value={minutesAwake} onChange={e => setMinutesAwake(e.target.value)} /></label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={caffeine} onChange={e => setCaffeine(e.target.checked)} />{sr ? 'Već sam uneo kofein' : 'I have already had caffeine'}</label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)} />{sr ? 'Probni pokušaj · 60 s · ne ulazi u referencu' : 'Practice · 60 s · excluded from baseline'}</label>
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    <button className={button} disabled={busy || (!demo && !password) || minutesAwake === '' || !Number.isInteger(Number(minutesAwake)) || Number(minutesAwake) < 0 || Number(minutesAwake) > 1440} onClick={() => void begin()}>{busy ? '…' : (sr ? 'Počni test' : 'Start test')}</button>
  </section>
}
