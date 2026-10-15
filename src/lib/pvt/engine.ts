import { MAX_FALSE_STARTS, randomWaitMs, RESPONSE_TIMEOUT_MS, type PvtResult, type PvtTrial } from './protocol'

/** Pure timing state machine. Browser supplies monotonic times and paints synchronously. */
export class PvtEngine {
  trials: PvtTrial[] = []
  phase: 'waiting' | 'signal' | 'done' = 'waiting'
  onset: number | null = null
  due: number
  wait: number
  maxFrameGapMs = 0
  lastFrame = 0
  feedbackUntil = 0
  feedback = ''
  interruption: string | null = null
  elapsed = 0
  falseStarts = 0
  constructor(readonly durationMs: number, private random: () => number) {
    this.wait = randomWaitMs(random())
    this.due = this.wait
  }
  tick(now: number) {
    if (this.phase === 'done') return
    this.maxFrameGapMs = Math.max(this.maxFrameGapMs, now - this.lastFrame)
    this.lastFrame = now
    this.elapsed = now
    if (this.onset !== null && now - this.onset >= RESPONSE_TIMEOUT_MS) {
      this.record('timeout', now)
      this.abort(now, 'missed-signal')
      return
    }
    if (now >= this.durationMs) {
      if (this.onset !== null) this.record('censored', now)
      this.phase = 'done'
      return
    }
    if (this.phase === 'waiting' && now >= this.due) {
      this.onset = now
      this.phase = 'signal'
    }
  }
  press(now: number) {
    if (this.phase === 'done') return
    // Only a painted animation frame may reveal a stimulus. A touch must never
    // create a new, unpainted target and then count as its response.
    this.elapsed = now
    if (now >= this.durationMs) { this.tick(now); return }
    if (this.onset === null) {
      this.trials.push({ kind: 'false-start', onsetMs: null, atMs: now, rtMs: null, waitMs: null })
      this.early(now)
      return
    }
    const rt = now - this.onset
    if (rt >= RESPONSE_TIMEOUT_MS) { this.tick(now); return }
    this.record(rt < 100 ? 'false-start' : 'response', now)
    if (rt < 100) this.early(now)
    else this.schedule(now, `${Math.round(rt)} ms`)
  }
  private early(now: number) {
    this.falseStarts++
    if (this.falseStarts >= MAX_FALSE_STARTS) this.abort(now, 'early-limit')
    else this.schedule(now, 'TOO EARLY')
  }
  private record(kind: PvtTrial['kind'], now: number) {
    this.trials.push({ kind, onsetMs: this.onset, atMs: now, rtMs: this.onset === null ? null : now - this.onset, waitMs: this.wait })
    this.onset = null
  }
  private schedule(now: number, feedback: string) {
    this.phase = 'waiting'
    this.wait = randomWaitMs(this.random())
    this.due = now + this.wait
    this.feedback = feedback
    this.feedbackUntil = now + 1000
  }
  abort(now: number, reason: string) {
    if (this.phase === 'done') return
    this.elapsed = now
    if (this.onset !== null) this.record('censored', this.elapsed)
    this.interruption = reason
    this.phase = 'done'
  }
  result(): PvtResult {
    return { trials: this.trials, elapsedMs: this.elapsed, maxFrameGapMs: this.maxFrameGapMs, interruption: this.interruption }
  }
}
