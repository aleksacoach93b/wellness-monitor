'use client'

import { useEffect, useRef } from 'react'
import { Focus, Hand, X } from 'lucide-react'
import { getSurveyUiTokens, getSurveyShellClasses, type SurveyAppearanceTheme } from '@/lib/surveyFormAppearance'
import './pvt-run.css'
import './pvt-focus.css'
import { PvtEngine } from '@/lib/pvt/engine'
import { pvtVisualFrame } from '@/lib/pvt/visual'
import type { PvtResult } from '@/lib/pvt/protocol'

export default function PvtRun({ duration, theme = 'dark', onFinish }: { duration: number; theme?: SurveyAppearanceTheme; onFinish: (result: PvtResult) => void }) {
  const ui = getSurveyUiTokens(theme), shell = getSurveyShellClasses(theme)
  const signal = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLDivElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const state = useRef<HTMLParagraphElement>(null)
  const earlyCount = useRef<HTMLSpanElement>(null)
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
      if (earlyCount.current) earlyCount.current.textContent = `${test.falseStarts}/3 early taps`
      const active = test.phase === 'signal'
      if (signal.current) signal.current.dataset.active = String(active)
      const visual = pvtVisualFrame(active, active ? now - test.onset! : 0, test.feedback, now < test.feedbackUntil)
      if (signal.current) signal.current.dataset.numeric = String(visual.numeric)
      if (counter.current) counter.current.textContent = visual.text
      if (ring.current) ring.current.setAttribute('stroke-dashoffset', String(100 * (1 - visual.fill)))
      if (state.current) state.current.textContent = visual.status
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
  return <section data-pvt-theme={theme} className={`pvt-ui pvt-run ${shell.root}`} aria-label="Focus check in progress">
    <div className="pvt-run-inner">
      <header className="pvt-run-header"><div className="pvt-wordmark"><span className="pvt-brand-mark"><Focus size={23} /></span><div><span>Focus test</span><small>STAY IN THE MOMENT</small></div></div><div className="pvt-run-clock"><span>TIME LEFT</span><strong ref={timer}>{duration === 60 ? '01:00' : '00:30'}</strong></div></header>
      <div className="pvt-time-track"><div ref={progress} /></div>
      <div className="pvt-stimulus-stage">
        <div className="pvt-signal-status"><span /><p ref={state} className="pvt-run-state">WAIT FOR THE SIGNAL</p></div>
        <div ref={signal} data-testid="pvt-signal" data-active="false" data-numeric="false" className="pvt-donut" aria-label="Visual reaction counter">
          <svg className="pvt-donut-svg" viewBox="0 0 280 280" aria-hidden="true">
            <circle className="pvt-donut-track" cx="140" cy="140" r="127" />
            <circle ref={ring} data-testid="pvt-ring" className="pvt-donut-fill" cx="140" cy="140" r="127" pathLength="100" strokeDasharray="100 100" strokeDashoffset="100" transform="rotate(-90 140 140)" />
          </svg>
          <div ref={counter} data-testid="pvt-counter" className="pvt-counter">WAIT</div>
          <span className="pvt-counter-unit" aria-hidden="true">ms</span>
        </div>
        <p className="pvt-run-hint">Reaction counter<br /><span>Tap as soon as the number appears.</span></p>
      </div>
      <div className="pvt-tap-area">
        <button type="button" data-testid="pvt-response" className={`pvt-tap-pad ${ui.primaryCtaButton} ${ui.focusVisibleRing}`}
          onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); if (e.isPrimary && e.button === 0) press() }}
          onKeyDown={e => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); press() } }}>
          <span className="pvt-tap-icon"><Hand size={25} strokeWidth={1.5} /></span><span>TAP</span><span className="pvt-pad-dot" />
        </button>
        <p><span ref={earlyCount}>0/3 early taps</span> · Respond to every signal.</p>
        <button type="button" className="pvt-stop" onClick={() => stop.current('cancelled')}><X size={14} />End attempt</button>
      </div>
    </div>
  </section>
}
