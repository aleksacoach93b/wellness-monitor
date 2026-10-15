/** Handheld adaptation. Timing must be bench-validated before clinical/selection use. */
export const PVT_VERSION = 'handheld-pvt-v1'
export const PVT_DURATIONS = [60, 90, 180] as const
export type PvtDuration = (typeof PVT_DURATIONS)[number]
export const SLOW_RESPONSE_MS = 355
export const RESPONSE_TIMEOUT_MS = 30_000
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
export function summarizePvt(result: PvtResult, duration: number) {
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
  return {
    responses: times.length,
    medianRT: median(times),
    responseSpeed: times.length ? times.reduce((sum, t) => sum + 1000 / t, 0) / times.length : null,
    slowResponses: slow,
    slowPercent: times.length ? slow / times.length * 100 : null,
    falseStarts,
    quality: flags.length ? 'REVIEW' : 'OK',
    flags,
  }
}
export function randomWaitMs(random: number): number {
  if (random < 0 || random >= 1 || !Number.isFinite(random)) throw new Error('Random input must be in [0, 1)')
  return 1000 + Math.floor(random * 3001)
}
/** Validate the raw record on the server; never accept client-calculated scores. */
export function validatePvtRecord(result: PvtResult, duration: number): boolean {
  if (!PVT_DURATIONS.includes(duration as PvtDuration)) return false
  if (!Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > duration * 1000 + 60_000) return false
  if (!Number.isFinite(result.maxFrameGapMs) || result.maxFrameGapMs < 0) return false
  let previous = -1
  let previousStimulusEnd = -1
  for (const t of result.trials) {
    if (!Number.isFinite(t.atMs) || t.atMs < previous || t.atMs > result.elapsedMs + 5) return false
    previous = t.atMs
    if (t.onsetMs === null) {
      if (t.kind !== 'false-start' || t.rtMs !== null || t.waitMs !== null) return false
    } else {
      if (t.rtMs === null || t.waitMs === null || !Number.isFinite(t.rtMs) || !Number.isFinite(t.onsetMs)) return false
      if (t.onsetMs < 0 || t.onsetMs < previousStimulusEnd || t.rtMs < 0 || Math.abs(t.atMs - t.onsetMs - t.rtMs) > 2) return false
      if (!Number.isFinite(t.waitMs) || t.waitMs < 1000 || t.waitMs > 4000) return false
      if (t.kind === 'response' && (t.rtMs < 100 || t.rtMs > RESPONSE_TIMEOUT_MS + 1000)) return false
      if (t.kind === 'false-start' && t.rtMs >= 100) return false
      if (t.kind === 'timeout' && t.rtMs < RESPONSE_TIMEOUT_MS) return false
      previousStimulusEnd = t.atMs
    }
  }
  return true
}
