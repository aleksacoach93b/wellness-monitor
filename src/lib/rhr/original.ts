/** Contact camera PPG estimate. Requires device/reference validation before operational use. */
export const RHR_VERSION = 'camera-rhr-v1'
export const RHR_DURATION_MS = 15_000
export const RHR_SETTLE_MS = 2_000
export const RHR_POSITIONS = [
  'seated',
  'standing',
  'reclined',
  'lying',
] as const
export type RhrPosition = (typeof RHR_POSITIONS)[number]
export type PpgSample = {
  t: number
  r: number
  g: number
  b: number
  clipped: number
  spread: number
}
export type RhrRecord = {
  samples: PpgSample[]
  elapsedMs: number
  interruption: string | null
  torch: boolean
}
export type RhrAnalysis = {
  bpm: number | null
  quality: 'ACCEPTED' | 'REPEAT'
  reasons: string[]
  samples: number
  fps: number
  usableSeconds: number
  beats: number
  agreementBpm: number | null
  correlation: number | null
  channel: 'red' | 'green' | null
}
const mean = (a: number[]) =>
  a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
const median = (a: number[]) => {
  const x = [...a].sort((a, b) => a - b)
  return x.length
    ? (x[Math.floor((x.length - 1) / 2)] + x[Math.floor(x.length / 2)]) / 2
    : 0
}
export function fingerPresent(s: PpgSample) {
  // Whole ROI must look like covered, perfused skin, rather than a single red object.
  // This is a signal screen, not proof of contact or skin-tone classification.
  return (
    s.r > 35 &&
    s.r > s.g * 1.12 &&
    s.r > s.b * 1.12 &&
    s.clipped < 0.65 &&
    s.spread < 0.65
  )
}
export function validateRhrRecord(record: RhrRecord): boolean {
  if (
    !Array.isArray(record.samples) ||
    record.samples.length > 1500 ||
    !Number.isFinite(record.elapsedMs) ||
    record.elapsedMs < 0 ||
    record.elapsedMs > 15_000
  )
    return false
  let previous = -1
  return record.samples.every((s) => {
    const valid =
      Number.isFinite(s.t) &&
      s.t > previous &&
      s.t >= 0 &&
      s.t <= record.elapsedMs + 2 &&
      [s.r, s.g, s.b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255) &&
      [s.clipped, s.spread].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    previous = s.t
    return valid
  })
}
function correlation(a: number[], lag: number) {
  const x = a.slice(lag),
    y = a.slice(0, a.length - lag),
    mx = mean(x),
    my = mean(y)
  let xy = 0,
    xx = 0,
    yy = 0
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx,
      dy = y[i] - my
    xy += dx * dy
    xx += dx * dx
    yy += dy * dy
  }
  return xx && yy ? xy / Math.sqrt(xx * yy) : 0
}
function analyzeChannel(samples: PpgSample[], key: 'r' | 'g') {
  const hz = 30,
    start = samples[0].t,
    end = samples.at(-1)!.t,
    raw: number[] = []
  let cursor = 0
  for (let t = start; t <= end; t += 1000 / hz) {
    while (cursor + 1 < samples.length - 1 && samples[cursor + 1].t < t)
      cursor++
    const a = samples[cursor],
      b = samples[cursor + 1]
    raw.push(a[key] + ((b[key] - a[key]) * (t - a.t)) / Math.max(1, b.t - a.t))
  }
  // Remove illumination/exposure drift, then smooth high-frequency camera noise.
  const detrended = raw.map(
    (x, i) =>
      x - mean(raw.slice(Math.max(0, i - 45), Math.min(raw.length, i + 46))),
  )
  const signal = detrended
    .map((_, i) => mean(detrended.slice(Math.max(0, i - 1), i + 2)))
    .slice(30, -30)
  const rms = Math.sqrt(mean(signal.map((x) => x * x)))
  const candidates: { lag: number; value: number }[] = []
  for (let lag = 9; lag <= 62; lag++) {
    const value = correlation(signal, lag)
    if (
      value > correlation(signal, lag - 1) &&
      value >= correlation(signal, lag + 1)
    )
      candidates.push({ lag, value })
  }
  const best = candidates.sort((a, b) => b.value - a.value)[0]
  if (!best || rms < 0.12) return null
  // Prefer the shortest similarly strong period to avoid selecting an integer multiple.
  const period =
    candidates
      .filter((c) => c.value >= best.value - 0.05 && c.value >= 0.65)
      .sort((a, b) => a.lag - b.lag)[0] ?? best
  const left = correlation(signal, period.lag - 1),
    right = correlation(signal, period.lag + 1)
  const delta = (0.5 * (left - right)) / (left - 2 * period.value + right || 1)
  const lag = period.lag + Math.max(-0.5, Math.min(0.5, delta)),
    acBpm = (60 * hz) / lag
  // Independent peak-interval estimate; neither estimator is trusted alone.
  const peaks: number[] = []
  const half = Math.max(2, Math.floor(lag * 0.32))
  for (let i = half; i < signal.length - half; i++) {
    if (signal[i] < rms * 0.25) continue
    let local = true
    for (let j = i - half; j <= i + half; j++)
      if (j !== i && signal[j] >= signal[i]) {
        local = false
        break
      }
    if (local) {
      const prev = peaks.at(-1)
      if (prev !== undefined && i - prev < lag * 0.6) {
        if (signal[i] > signal[prev]) peaks[peaks.length - 1] = i
      } else peaks.push(i)
    }
  }
  const refined = peaks.map(
    (i) =>
      i +
      Math.max(
        -0.5,
        Math.min(
          0.5,
          (0.5 * (signal[i - 1] - signal[i + 1])) /
            (signal[i - 1] - 2 * signal[i] + signal[i + 1] || 1),
        ),
      ),
  )
  const intervals = refined.slice(1).map((p, i) => (p - refined[i]) / hz)
  const interval = median(intervals),
    peakBpm = interval ? 60 / interval : 0
  const deviation = interval
    ? median(intervals.map((x) => Math.abs(x - interval))) / interval
    : 1
  const agreement = Math.abs(acBpm - peakBpm)
  return {
    bpm: (acBpm + peakBpm) / 2,
    correlation: period.value,
    agreement,
    beats: peaks.length,
    deviation,
    rms,
    channel: key === 'r' ? ('red' as const) : ('green' as const),
  }
}
export function analyzeRhr(record: RhrRecord): RhrAnalysis {
  const reasons: string[] = []
  const empty: RhrAnalysis = {
    bpm: null,
    quality: 'REPEAT',
    reasons,
    samples: record.samples?.length ?? 0,
    fps: 0,
    usableSeconds: 0,
    beats: 0,
    agreementBpm: null,
    correlation: null,
    channel: null,
  }
  if (!validateRhrRecord(record)) {
    reasons.push('invalid-record')
    return empty
  }
  if (record.interruption) reasons.push('interrupted')
  if (!record.torch) reasons.push('camera-light')
  if (record.elapsedMs < 14_900) reasons.push('incomplete-scan')
  const samples = record.samples.filter(
    (s) => s.t >= RHR_SETTLE_MS && s.t <= RHR_DURATION_MS,
  )
  if (samples.length < 200) {
    reasons.push('too-few-frames')
    return empty
  }
  const span = samples.at(-1)!.t - samples[0].t,
    fps = ((samples.length - 1) * 1000) / span
  empty.fps = fps
  empty.usableSeconds = span / 1000
  if (samples[0].t > 2200 || samples.at(-1)!.t < 14_800 || span < 12_500)
    reasons.push('incomplete-signal')
  if (fps < 20) reasons.push('low-frame-rate')
  if (samples.some((s, i) => i > 0 && s.t - samples[i - 1].t > 200))
    reasons.push('frame-gaps')
  if (samples.filter(fingerPresent).length / samples.length < 0.96)
    reasons.push('finger-contact')
  if (samples.some((s, i) => i > 0 && Math.abs(s.r - samples[i - 1].r) > 18))
    reasons.push('movement-or-exposure')
  if (reasons.length) return empty
  const channels = [
    analyzeChannel(samples, 'r'),
    analyzeChannel(samples, 'g'),
  ].filter((x): x is NonNullable<typeof x> => !!x)
  const candidates = channels.filter(
    (c) =>
      c.correlation >= 0.7 &&
      c.agreement <= 5 &&
      c.deviation <= 0.16 &&
      c.beats >= 5 &&
      Math.round(c.bpm) >= 30 &&
      Math.round(c.bpm) <= 180,
  )
  const best = candidates.sort((a, b) => b.correlation - a.correlation)[0]
  if (!best) {
    reasons.push('weak-or-irregular-pulse')
    return empty
  }
  if (candidates.some((c) => Math.abs(c.bpm - best.bpm) > 5)) {
    reasons.push('channel-disagreement')
    return empty
  }
  // A first/second segment check rejects drifting, aliased or unstable estimates.
  const key = best.channel === 'red' ? 'r' : 'g'
  const middle = (samples[0].t + samples.at(-1)!.t) / 2
  const halves = [
    samples.filter((s) => s.t <= middle),
    samples.filter((s) => s.t >= middle),
  ].map((s) => analyzeChannel(s, key))
  if (
    halves.some(
      (h) => !h || h.correlation < 0.6 || Math.abs(h.bpm - best.bpm) > 7,
    )
  ) {
    reasons.push('unstable-pulse')
    return empty
  }
  return {
    ...empty,
    bpm: Math.round(best.bpm),
    quality: 'ACCEPTED',
    beats: best.beats,
    correlation: best.correlation,
    agreementBpm: best.agreement,
    channel: best.channel,
  }
}
export function rhrReason(reasons: string[]) {
  if (reasons.includes('camera-light'))
    return 'The camera light was unavailable. Choose a supported rear camera and try again.'
  if (reasons.includes('interrupted'))
    return 'The scan was interrupted. Keep this screen open for all 15 seconds.'
  if (reasons.includes('finger-contact'))
    return 'Cover the camera lens completely with your fingertip. Use light, steady pressure.'
  if (reasons.includes('low-frame-rate') || reasons.includes('frame-gaps'))
    return 'The camera did not deliver a steady signal. Close other apps and try again.'
  return 'The pulse signal was not clear or steady enough. Rest your hand, adjust your fingertip and repeat.'
}
