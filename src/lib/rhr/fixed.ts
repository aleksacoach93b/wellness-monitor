import {
  analyzeChannel,
  validateRhrRecord,
  RHR_FIXED_VERSION,
  RHR_DURATION_MS,
  type PpgSample,
  type RhrAnalysis,
  type RhrRecord,
} from './protocol'
import type { RhrSessionView } from './session'

/** Fixed deadline. A bad preview never resets the clock or determines final acceptance. */
export class FixedRhrSession {
  private samples: PpgSample[] = []
  private nextEstimate = 5000
  private view: RhrSessionView = {
    stage: 'detecting',
    remainingMs: RHR_DURATION_MS,
    provisionalBpm: null,
    lastPeakAt: null,
    restarts: 0,
    reason: null,
    analysis: null,
  }
  snapshot() {
    return { ...this.view }
  }
  push(sample: PpgSample) {
    if (sample.t <= RHR_DURATION_MS) this.samples.push(sample)
    return this.advanceTo(sample.t)
  }
  advanceTo(t: number) {
    if (this.view.stage === 'complete' || this.view.stage === 'timeout')
      return this.snapshot()
    this.view.remainingMs = Math.max(0, RHR_DURATION_MS - t)
    this.view.stage = t < 2000 ? 'detecting' : 'measuring'
    if (t >= RHR_DURATION_MS) {
      const analysis = analyzeFixedRhr({
        protocolVersion: RHR_FIXED_VERSION,
        samples: this.samples,
        elapsedMs: RHR_DURATION_MS,
        interruption: null,
        torch: true,
      })
      this.view.analysis = analysis
      this.view.stage = analysis.quality === 'ACCEPTED' ? 'complete' : 'timeout'
      this.view.provisionalBpm = analysis.bpm
      this.view.reason = analysis.reasons[0] ?? null
    } else if (t >= this.nextEstimate) {
      let estimate = empty([])
      if (this.samples.length && t - this.samples.at(-1)!.t <= 300) {
        for (const width of [8000, 5000]) {
          estimate = estimateWindow(
            this.samples.filter((s) => s.t >= Math.max(2000, t - width)),
            false,
          )
          if (estimate.quality === 'ACCEPTED') break
        }
      }
      this.nextEstimate = t + 500
      this.view.provisionalBpm = estimate.bpm
      this.view.lastPeakAt = estimate.lastPeakAt
    }
    return this.snapshot()
  }
}

function empty(
  samples: PpgSample[],
): RhrAnalysis & { lastPeakAt: number | null } {
  const span = samples.length > 1 ? samples.at(-1)!.t - samples[0].t : 0
  return {
    bpm: null,
    quality: 'REPEAT',
    reasons: [],
    samples: samples.length,
    fps: span > 0 ? ((samples.length - 1) * 1000) / span : 0,
    usableSeconds: span / 1000,
    beats: 0,
    agreementBpm: null,
    correlation: null,
    channel: null,
    lastPeakAt: null,
  }
}

/** Rank intact RGB channels, instead of letting a weak channel veto a strong one. */
function estimateWindow(samples: PpgSample[], final: boolean) {
  const result = empty(samples)
  if (
    result.usableSeconds < (final ? 7.7 : 2.7) ||
    result.fps < 12 ||
    samples.some((s, i) => i > 0 && s.t - samples[i - 1].t > 300)
  )
    return { ...result, reasons: ['incomplete-signal'] }
  // A broad optical contact screen: different phone exposure/white-balance need not have identical red ratios.
  if (
    samples.filter(
      (s) => s.r > 25 && s.r >= s.g * 0.8 && s.r >= s.b && s.clipped < 0.65,
    ).length /
      samples.length <
    0.85
  )
    return { ...result, reasons: ['finger-contact'] }
  const candidates = (['r', 'g', 'b'] as const)
    .map((key) => {
      const c = analyzeChannel(samples, key, 15, true)
      if (!c) return null
      // Low-rate previews need not contain enough interior peak intervals; never finalise on that exception.
      const lowPreview =
        !final && c.acBpm <= 50 && c.correlation >= 0.85 && c.beats >= 1
      if (
        c.correlation < 0.6 ||
        (!lowPreview &&
          (c.agreement > Math.max(8, c.acBpm * 0.1) ||
            c.deviation > 0.25 ||
            c.beats < (final ? 4 : 2)))
      )
        return null
      const bpm = lowPreview ? c.acBpm : c.bpm
      if (Math.round(bpm) < 30 || Math.round(bpm) > 180) return null
      // Verify the tail, without requiring every overlapping short preview to pass.
      if (final) {
        const tail = analyzeChannel(
          samples.filter((s) => s.t >= samples.at(-1)!.t - 5000),
          key,
          15,
          true,
        )
        if (
          !tail ||
          tail.correlation < 0.45 ||
          Math.abs(tail.acBpm - bpm) > Math.max(10, bpm * 0.15)
        )
          return null
      }
      return {
        ...c,
        bpm,
        score: c.correlation - Math.min(c.agreement, 20) / 100,
      }
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]
  if (!best) return { ...result, reasons: ['weak-or-irregular-pulse'] }
  if (
    candidates.some(
      (c) =>
        c.score >= best.score - 0.1 &&
        Math.abs(c.bpm - best.bpm) > Math.max(8, best.bpm * 0.12),
    )
  )
    return { ...result, reasons: ['channel-disagreement'] }
  return {
    ...result,
    quality: 'ACCEPTED' as const,
    bpm: Math.round(best.bpm),
    beats: best.beats,
    agreementBpm: best.agreement,
    correlation: best.correlation,
    channel: best.channel,
    lastPeakAt: best.lastPeakAt,
  }
}

export function analyzeFixedRhr(record: RhrRecord): RhrAnalysis {
  const result = empty(record.samples ?? [])
  if (
    !validateRhrRecord(record) ||
    record.protocolVersion !== RHR_FIXED_VERSION
  )
    return { ...result, reasons: ['invalid-record'] }
  if (record.interruption) return { ...result, reasons: ['interrupted'] }
  if (!record.torch) return { ...result, reasons: ['camera-light'] }
  if (record.elapsedMs < RHR_DURATION_MS)
    return { ...result, reasons: ['incomplete-scan'] }
  // Ignore initial exposure settling. Prefer the longest readable recent segment;
  // allow an early artefact to fall outside the segment, never extend acquisition.
  let last = result
  for (const start of [2000, 4000, 6000, 7000]) {
    const samples = record.samples.filter(
      (s) => s.t >= start && s.t <= RHR_DURATION_MS,
    )
    if (!samples.length || samples.at(-1)!.t < RHR_DURATION_MS - 300) continue
    last = estimateWindow(samples, true)
    if (last.quality === 'ACCEPTED')
      return {
        ...last,
        windowStartMs: samples[0].t,
        completeAtMs: RHR_DURATION_MS,
        restarts: 0,
      }
  }
  return {
    ...last,
    reasons: last.reasons.length ? last.reasons : ['incomplete-signal'],
    restarts: 0,
  }
}
