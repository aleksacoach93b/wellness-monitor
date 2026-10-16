import { analyzeFixedRhr } from './fixed'
import {
  analyzeRhr,
  analyzeOpticalWindow,
  fingerPresent,
  validateRhrRecord,
  RHR_VERSION,
  RHR_FIXED_VERSION,
  RHR_DETECT_MS,
  RHR_CAPTURE_MS,
  RHR_MAX_MS,
  type PpgSample,
  type RhrAnalysis,
  type RhrRecord,
} from './protocol'

export type RhrSessionView = {
  stage: 'detecting' | 'measuring' | 'recovering' | 'complete' | 'timeout'
  remainingMs: number
  provisionalBpm: number | null
  lastPeakAt: number | null
  restarts: number
  reason: string | null
  analysis: RhrAnalysis | null
}

/** Deterministic 250ms quality clock, shared by real-time UI and server replay. */
export class RhrSession {
  private samples: PpgSample[] = []
  private nextTick = 250
  private searchSince = 0
  private windowStart: number | null = null
  private anchorBpm: number | null = null
  private badSince: number | null = null
  private view: RhrSessionView = {
    stage: 'detecting',
    remainingMs: RHR_DETECT_MS,
    provisionalBpm: null,
    lastPeakAt: null,
    restarts: 0,
    reason: null,
    analysis: null,
  }

  push(sample: PpgSample) {
    // Never use a future frame in a past clock tick (same rule in browser/server).
    this.advanceTo(sample.t, false)
    this.samples.push(sample)
    this.advanceTo(sample.t)
    return this.snapshot()
  }
  snapshot(): RhrSessionView {
    return { ...this.view }
  }
  private reset(reason: string, lostContact: boolean, t: number) {
    if (this.windowStart !== null) this.view.restarts++
    this.windowStart = null
    this.anchorBpm = null
    this.view.provisionalBpm = null
    this.view.lastPeakAt = null
    this.view.stage = this.view.restarts ? 'recovering' : 'detecting'
    this.view.reason = reason
    if (lostContact) this.searchSince = t
    this.view.remainingMs =
      this.view.stage === 'detecting' ? RHR_DETECT_MS : RHR_CAPTURE_MS
  }
  advanceTo(t: number, inclusive = true) {
    while (this.nextTick < t || (inclusive && this.nextTick <= t)) {
      if (
        this.nextTick > RHR_MAX_MS ||
        this.view.stage === 'complete' ||
        this.view.stage === 'timeout'
      )
        break
      this.evaluate(this.nextTick)
      this.nextTick += 250
    }
    return this.snapshot()
  }
  private evaluate(t: number) {
    const last = this.samples.at(-1)
    const covered = !!last && t - last.t <= 200 && fingerPresent(last)
    if (!covered) {
      this.badSince ??= t
      this.view.provisionalBpm = null
      this.view.lastPeakAt = null
      if (t - this.badSince >= 250) this.reset('finger-contact', true, t)
    } else this.badSince = null
    if (covered && t - this.searchSince >= RHR_DETECT_MS) {
      const recent = this.samples.filter(
        (s) => s.t >= Math.max(this.searchSince, t - RHR_DETECT_MS) && s.t <= t,
      )
      const pulse = analyzeOpticalWindow(recent, RHR_DETECT_MS, t)
      if (pulse.quality !== 'ACCEPTED') {
        if (this.windowStart !== null)
          this.reset(pulse.reasons[0] || 'unstable-pulse', false, t)
        this.view.provisionalBpm = null
        this.view.lastPeakAt = null
        this.view.reason = pulse.reasons[0] || 'weak-or-irregular-pulse'
      } else {
        this.view.provisionalBpm = pulse.bpm
        this.view.lastPeakAt = pulse.lastPeakAt
        if (
          this.windowStart !== null &&
          this.anchorBpm !== null &&
          Math.abs(pulse.bpm! - this.anchorBpm) >
            Math.max(8, this.anchorBpm * 0.12)
        )
          this.reset('pulse-changed', false, t)
        if (this.windowStart === null) {
          this.windowStart = t
          this.anchorBpm = pulse.bpm
          this.view.stage = 'measuring'
          this.view.provisionalBpm = pulse.bpm
          this.view.lastPeakAt = pulse.lastPeakAt
        }
        this.view.remainingMs = Math.max(
          0,
          RHR_CAPTURE_MS - (t - this.windowStart),
        )
        if (t - this.windowStart >= RHR_CAPTURE_MS) {
          const window = this.samples.filter(
            (s) => s.t >= this.windowStart! && s.t <= t,
          )
          const final = analyzeOpticalWindow(window, RHR_CAPTURE_MS, t, true)
          if (
            final.quality === 'ACCEPTED' &&
            Math.abs(final.bpm! - pulse.bpm!) <= 5
          ) {
            this.view.stage = 'complete'
            this.view.remainingMs = 0
            this.view.provisionalBpm = final.bpm
            this.view.analysis = {
              ...final,
              windowStartMs: this.windowStart,
              completeAtMs: t,
              restarts: this.view.restarts,
            }
            return
          }
          this.reset(final.reasons[0] || 'unstable-pulse', false, t)
        }
      }
    } else if (this.view.stage === 'detecting')
      this.view.remainingMs = Math.max(
        0,
        RHR_DETECT_MS - (t - this.searchSince),
      )
    if (t >= RHR_MAX_MS) {
      this.view.stage = 'timeout'
      this.view.remainingMs = 0
      this.view.provisionalBpm = null
      this.view.lastPeakAt = null
      this.view.reason = 'signal-timeout'
    }
  }
}

export function analyzeRhrRecord(record: RhrRecord): RhrAnalysis {
  if (record.protocolVersion === RHR_FIXED_VERSION)
    return analyzeFixedRhr(record)
  if (record.protocolVersion !== RHR_VERSION) return analyzeRhr(record)
  const empty: RhrAnalysis = {
    bpm: null,
    quality: 'REPEAT',
    reasons: [],
    samples: record.samples?.length ?? 0,
    fps: 0,
    usableSeconds: 0,
    beats: 0,
    agreementBpm: null,
    correlation: null,
    channel: null,
  }
  if (!validateRhrRecord(record))
    return { ...empty, reasons: ['invalid-record'] }
  const span =
    record.samples.length > 1
      ? record.samples.at(-1)!.t - record.samples[0].t
      : 0
  empty.fps = span > 0 ? ((record.samples.length - 1) * 1000) / span : 0
  if (record.interruption) return { ...empty, reasons: ['interrupted'] }
  if (!record.torch) return { ...empty, reasons: ['camera-light'] }
  const session = new RhrSession()
  for (const sample of record.samples) session.push(sample)
  const view = session.advanceTo(record.elapsedMs)
  if (view.stage !== 'complete' || !view.analysis)
    return {
      ...empty,
      reasons: [view.reason || 'incomplete-scan'],
      restarts: view.restarts,
    }
  // Completion must be contemporaneous with the final validated window, not an old good segment.
  if (
    record.elapsedMs < view.analysis.completeAtMs! ||
    record.elapsedMs - view.analysis.completeAtMs! > 750
  )
    return { ...empty, reasons: ['stale-window'] }
  return view.analysis
}
