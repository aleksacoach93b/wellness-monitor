import { analyzeRhr as analyzeOriginal } from './original'
import {
  RHR_RESTORED_VERSION,
  RHR_DURATION_MS,
  validateRhrRecord,
  type RhrRecord,
  type PpgSample,
  type RhrAnalysis,
} from './protocol'
import type { RhrSessionView } from './session'

/** Route new captures to the unmodified first working estimator, with a distinct audit revision. */
export function analyzeRestoredRhr(record: RhrRecord): RhrAnalysis {
  if (
    record.protocolVersion !== RHR_RESTORED_VERSION ||
    !validateRhrRecord(record)
  )
    return {
      bpm: null,
      quality: 'REPEAT',
      reasons: ['invalid-record'],
      samples: record.samples?.length ?? 0,
      fps: 0,
      usableSeconds: 0,
      beats: 0,
      agreementBpm: null,
      correlation: null,
      channel: null,
    }
  const result = analyzeOriginal(record)
  return {
    ...result,
    restarts: 0,
    ...(result.quality === 'ACCEPTED'
      ? { windowStartMs: 2000, completeAtMs: RHR_DURATION_MS }
      : {}),
  }
}

/** Original behavior: capture/countdown first, derive BPM only after the full attempt. */
export class RestoredRhrSession {
  private samples: PpgSample[] = []
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
      const analysis = analyzeRestoredRhr({
        protocolVersion: RHR_RESTORED_VERSION,
        samples: this.samples,
        elapsedMs: RHR_DURATION_MS,
        torch: true,
        interruption: null,
      })
      this.view.analysis = analysis
      this.view.stage = analysis.quality === 'ACCEPTED' ? 'complete' : 'timeout'
      this.view.reason = analysis.reasons[0] ?? null
    }
    return this.snapshot()
  }
}
