import { analyzeFocus } from './analysis'
/** Handheld adaptation. Timing must be bench-validated before clinical/selection use. */
export const PVT_VERSION = 'handheld-pvt-v5'
export const PVT_START_VERSIONS = [PVT_VERSION] as const
// Keep saved survey settings and already-issued attempts readable.
export const PVT_SUPPORTED_VERSIONS = [PVT_VERSION, 'handheld-pvt-v4', 'handheld-pvt-v3'] as const
export const PVT_DURATIONS = [30, 60] as const
export type PvtDuration = (typeof PVT_DURATIONS)[number]
export function isPvtDuration(value: number): value is PvtDuration {
  return PVT_DURATIONS.some(duration => duration === value)
}
export const SLOW_RESPONSE_MS = 355
export const RESPONSE_TIMEOUT_MS = 3_000
export const MAX_FALSE_STARTS = 3
export const minimumResponses = (duration: number) => Math.ceil(duration / 6)
export type PvtTrial = {
  kind: 'response' | 'false-start' | 'timeout' | 'censored'
  onsetMs: number | null
  atMs: number
  rtMs: number | null
  waitMs: number | null
}
export type PvtResult = {
  trials: PvtTrial[]
  elapsedMs: number
  maxFrameGapMs: number
  interruption: string | null
}
export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
/** Operational completion rules, not diagnostic or population performance cutoffs. */
export function pvtRepeatReasons(result: PvtResult, duration: number, version = PVT_VERSION): string[] {
  const reasons = new Set<string>()
  if (result.interruption) reasons.add(result.interruption)
  if (result.elapsedMs < duration * 1000 - 50 || result.elapsedMs > duration * 1000 + 1000) reasons.add('incomplete-window')
  if (result.trials.filter(t => t.kind === 'false-start').length >= MAX_FALSE_STARTS) reasons.add('early-limit')
  if (result.trials.filter(t => t.kind === 'response' && t.rtMs !== null && t.rtMs >= 100 && t.rtMs < RESPONSE_TIMEOUT_MS).length < minimumResponses(duration)) reasons.add('few-responses')
  if (result.trials.some(t => t.kind === 'timeout' || (t.rtMs ?? 0) >= RESPONSE_TIMEOUT_MS)) reasons.add('missed-signal')
  // Verify coverage, including the unrecorded waiting period at the end. Otherwise
  // a short prefix of good responses could be submitted as an entire session.
  let anchor = 0
  const tolerance = 250
  for (let i = 0; i < result.trials.length; i++) {
    const t = result.trials[i]
    if (t.onsetMs !== null) {
      if (t.onsetMs - anchor < 1000 - tolerance || t.onsetMs - anchor > 4000 + tolerance) reasons.add('incomplete-record')
      if (version === PVT_VERSION && Math.abs(t.onsetMs - anchor - (t.waitMs ?? 0)) > tolerance) reasons.add('incomplete-record')
    } else if (t.atMs - anchor > 4000 + tolerance) reasons.add('incomplete-record')
    if (t.kind === 'censored' && (i !== result.trials.length - 1 || Math.abs(t.atMs - result.elapsedMs) > 5)) reasons.add('incomplete-record')
    // Legacy waiting-phase early taps did not reset the stimulus schedule.
    if (t.onsetMs !== null || version === PVT_VERSION) anchor = t.atMs
  }
  if (result.elapsedMs - anchor > 4000 + tolerance) reasons.add('incomplete-record')
  return [...reasons]
}
export function pvtRepeatMessage(reason: string): string {
  if (reason === 'early-limit') return 'Three early taps were recorded. Wait until the number appears before tapping.'
  if (reason === 'missed-signal') return 'A signal was left unanswered for 3 seconds. Respond to every signal until the test ends.'
  if (reason === 'few-responses') return 'Too few responses were recorded. Keep responding for the full test.'
  if (reason === 'incomplete-record') return 'The response record does not cover the full test. Please complete a new attempt.'
  return 'The test was interrupted or did not run for its full duration. Please complete a new attempt.'
}
export function summarizePvt(result: PvtResult, duration: number, version = PVT_VERSION) {
  const responses = result.trials.filter(t => t.kind === 'response' || t.kind === 'timeout')
  const times = responses.map(t => t.rtMs!).filter(t => t >= 100)
  const slow = times.filter(t => t >= SLOW_RESPONSE_MS).length
  const flags: string[] = []
  if (result.interruption) flags.push(result.interruption)
  if (result.elapsedMs < duration * 1000 - 50) flags.push('too-short')
  if (result.elapsedMs > duration * 1000 + 1000) flags.push('late-finish')
  if (result.maxFrameGapMs > 100) flags.push('frame-delay')
  if (times.length < 5) flags.push('few-responses')
  if (result.trials.some(t => t.kind === 'censored' && (t.rtMs ?? 0) >= SLOW_RESPONSE_MS)) flags.push('unfinished-response')
  const falseStarts = result.trials.filter(t => t.kind === 'false-start').length
  if (falseStarts > Math.max(3, times.length * .2)) flags.push('many-false-starts')
  const repeatReasons = pvtRepeatReasons(result, duration, version)
  return {
    responses: times.length,
    medianRT: median(times),
    responseSpeed: times.length ? times.reduce((sum, t) => sum + 1000 / t, 0) / times.length : null,
    slowResponses: slow,
    slowPercent: times.length ? slow / times.length * 100 : null,
    falseStarts,
    analysis: analyzeFocus(result, duration, SLOW_RESPONSE_MS),
    repeatRequired: repeatReasons.length > 0,
    repeatReasons,
    quality: repeatReasons.length ? 'INVALID' : flags.length ? 'REVIEW' : 'OK',
    flags: [...new Set([...flags, ...repeatReasons])],
  }
}
export function randomWaitMs(random: number): number {
  if (random < 0 || random >= 1 || !Number.isFinite(random)) throw new Error('Random input must be in [0, 1)')
  return 1000 + Math.floor(random * 3001)
}
/** Validate the raw record on the server; never accept client-calculated scores. */
export function validatePvtRecord(result: PvtResult, duration: number, version = PVT_VERSION): boolean {
  // Let already-issued v1 attempts finish without offering legacy durations for new starts.
  const allowed = version === 'handheld-pvt-v1' ? [60, 90, 180].includes(duration) : PVT_SUPPORTED_VERSIONS.some(supported => supported === version) && isPvtDuration(duration)
  if (!allowed) return false
  if (!Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > duration * 1000 + 60_000) return false
  if (!Number.isFinite(result.maxFrameGapMs) || result.maxFrameGapMs < 0) return false
  const timeout = version === PVT_VERSION ? RESPONSE_TIMEOUT_MS : 30_000
  let previous = 0
  let previousStimulusEnd = 0
  for (const t of result.trials) {
    if (!Number.isFinite(t.atMs) || t.atMs < previous || t.atMs > result.elapsedMs + 5) return false
    previous = t.atMs
    if (t.onsetMs === null) {
      if (t.kind !== 'false-start' || t.rtMs !== null || t.waitMs !== null) return false
    } else {
      if (t.rtMs === null || t.waitMs === null || !Number.isFinite(t.rtMs) || !Number.isFinite(t.onsetMs)) return false
      if (t.onsetMs < 0 || t.onsetMs < previousStimulusEnd || t.rtMs < 0 || Math.abs(t.atMs - t.onsetMs - t.rtMs) > 2) return false
      if (!Number.isFinite(t.waitMs) || t.waitMs < 1000 || t.waitMs > 4000) return false
      if (t.kind === 'response' && (t.rtMs < 100 || t.rtMs > timeout + 1000)) return false
      if (t.kind === 'false-start' && t.rtMs >= 100) return false
      if (t.kind === 'timeout' && t.rtMs < timeout) return false
      previousStimulusEnd = t.atMs
    }
  }
  return true
}
