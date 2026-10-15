'use client'

import { useEffect, useRef } from 'react'
import { PvtEngine } from '@/lib/pvt/engine'
import type { PvtResult } from '@/lib/pvt/protocol'

export default function PvtRun({ duration, onFinish }: { duration: number; onFinish: (result: PvtResult) => void }) {
  const signal = useRef<HTMLDivElement>(null)
  const timer = useRef<HTMLSpanElement>(null)
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
      if (signal.current) {
        const active = test.phase === 'signal'
        signal.current.dataset.active = String(active)
        signal.current.style.background = active ? '#14b8a6' : '#172033'
        signal.current.style.color = active ? '#042f2e' : '#cbd5e1'
        signal.current.textContent = active ? String(Math.floor(now - test.onset!)).padStart(3, '0') :
          now < test.feedbackUntil ? (test.feedback === 'TOO EARLY' ? ('TOO EARLY') : test.feedback) : ('WAIT')
      }
      if (timer.current) timer.current.textContent = `${Math.ceil(Math.max(0, duration - now / 1000))} s`
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
  return <section className="flex min-h-[80svh] flex-col gap-5 py-4 select-none">
    <div className="flex items-center justify-between text-sm text-slate-300"><span>PVT · {duration} s</span><span ref={timer}>{duration} s</span></div>
    <p className="text-center text-sm text-slate-300">{'Watch the box. Tap the button as soon as numbers appear.'}</p>
    <div ref={signal} data-testid="pvt-signal" data-active="false" className="my-auto flex h-40 items-center justify-center rounded-3xl bg-slate-800 font-mono text-5xl font-bold tabular-nums" aria-label={'Visual stimulus'}>WAIT</div>
    <button type="button" data-testid="pvt-response" className="h-32 w-full touch-none rounded-3xl border-2 border-slate-500 bg-slate-800 text-2xl font-bold active:bg-slate-700"
      onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.preventDefault(); if (e.isPrimary && e.button === 0) press() }}
      onKeyDown={e => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); press() } }}>
      {'TAP'}
    </button>
    <button className="min-h-11 text-sm text-slate-400 underline" onClick={() => stop.current('cancelled')}>{'End attempt'}</button>
  </section>
}
