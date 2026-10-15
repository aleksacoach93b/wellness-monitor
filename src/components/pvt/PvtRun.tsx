'use client'

import { useEffect, useRef } from 'react'
import { Activity, Hand, X } from 'lucide-react'
import { PvtEngine } from '@/lib/pvt/engine'
import type { PvtResult } from '@/lib/pvt/protocol'

export default function PvtRun({ duration, onFinish }: { duration: number; onFinish: (result: PvtResult) => void }) {
  const signal = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLDivElement>(null)
  const state = useRef<HTMLParagraphElement>(null)
  const timer = useRef<HTMLSpanElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const engine = useRef<PvtEngine | null>(null)
  const start = useRef(0)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const stop = useRef<(reason: string) => void>(() => {})
  useEffect(() => {
    const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
    const test = new PvtEngine(duration * 1000, random)
    engine.current = test
    start.current = performance.now()
    let frame = 0
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      cancelAnimationFrame(frame)
      finish.current(test.result())
    }
    const tick = () => {
      if (ended) return
      const now = performance.now() - start.current
      test.tick(now)
      if (test.phase === 'done') { end(); return }
      const active = test.phase === 'signal'
      if (signal.current) signal.current.dataset.active = String(active)
      if (counter.current) counter.current.textContent = active ? String(Math.floor(now - test.onset!)).padStart(3, '0') : now < test.feedbackUntil ? test.feedback : 'WAIT'
      if (state.current) state.current.textContent = active ? 'TAP NOW' : 'WAIT FOR THE SIGNAL'
      const remaining = Math.ceil(Math.max(0, duration - now / 1000))
      if (timer.current) timer.current.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
      if (progress.current) progress.current.style.transform = `scaleX(${Math.max(0, 1 - now / (duration * 1000))})`
      frame = requestAnimationFrame(tick)
    }
    stop.current = (reason: string) => { test.abort(performance.now() - start.current, reason); end() }
    const hidden = () => { if (document.hidden) stop.current('hidden') }
    const blur = () => stop.current('blur')
    const orientation = () => stop.current('orientation')
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', blur)
    window.addEventListener('orientationchange', orientation)
    window.addEventListener('pagehide', blur)
    window.addEventListener('popstate', blur)
    let wake: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then(lock => { if (ended) void lock.release(); else wake = lock }).catch(() => {})
    frame = requestAnimationFrame(tick)
    return () => {
      ended = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', blur)
      window.removeEventListener('orientationchange', orientation)
      window.removeEventListener('pagehide', blur)
      window.removeEventListener('popstate', blur)
      void wake?.release().catch(() => {})
    }
  }, [duration])
  const press = () => {
    engine.current?.press(performance.now() - start.current)
    if ((engine.current?.trials.length ?? 0) >= 1900) stop.current('too-many-inputs')
  }
  return <section className="pvt-run" aria-label="Focus check in progress">
    <div className="pvt-run-inner">
      <header className="pvt-run-header"><div className="pvt-brand"><span className="pvt-brand-symbol"><Activity size={19} strokeWidth={1.7} /></span><strong>focus</strong></div><div className="pvt-run-clock"><span>TIME LEFT</span><strong ref={timer}>{duration === 60 ? '01:00' : '00:30'}</strong></div></header>
      <div className="pvt-time-track"><div ref={progress} /></div>
      <div className="pvt-stimulus-stage">
        <p ref={state} className="pvt-run-state">WAIT FOR THE SIGNAL</p>
        <div className="pvt-orbit"><div ref={signal} data-testid="pvt-signal" data-active="false" className="pvt-orb" aria-label="Visual stimulus"><div ref={counter} className="pvt-counter">WAIT</div></div></div>
        <p className="pvt-run-hint">Watch the counter.<br /><span>Tap the pad as soon as the counter starts.</span></p>
      </div>
      <div className="pvt-tap-area">
        <button type="button" data-testid="pvt-response" className="pvt-tap-pad"
          onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); if (e.isPrimary && e.button === 0) press() }}
          onKeyDown={e => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); press() } }}>
          <Hand size={25} strokeWidth={1.5} /><span>TAP</span><span className="pvt-pad-dot" />
        </button>
        <p>One tap per signal. Keep your thumb close.</p>
        <button className="pvt-stop" onClick={() => stop.current('cancelled')}><X size={14} />End attempt</button>
      </div>
    </div>
  </section>
}
