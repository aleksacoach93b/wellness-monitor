import { fingerPresent } from './original'
import type { PpgSample, RhrAnalysis, RhrRecord } from './protocol'

export function frameSummary(samples: PpgSample[]) {
  const span = samples.length > 1 ? samples.at(-1)!.t - samples[0].t : 0
  const maxGapMs = samples.reduce(
    (m, s, i) => (i ? Math.max(m, s.t - samples[i - 1].t) : m),
    0,
  )
  const average = (key: 'r' | 'g' | 'b' | 'clipped') =>
    samples.reduce((n, s) => n + s[key], 0) / Math.max(1, samples.length)
  const range = (key: 'r' | 'g' | 'b') =>
    samples.length
      ? Math.max(...samples.map((s) => s[key])) -
        Math.min(...samples.map((s) => s[key]))
      : 0
  return {
    frames: samples.length,
    seconds: span / 1000,
    fps: span > 0 ? ((samples.length - 1) * 1000) / span : 0,
    maxGapMs,
    contactFraction:
      samples.filter(fingerPresent).length / Math.max(1, samples.length),
    red: average('r'),
    green: average('g'),
    blue: average('b'),
    clipped: average('clipped'),
    redRange: range('r'),
    greenRange: range('g'),
    blueRange: range('b'),
    redCeilingFraction:
      samples.filter((s) => s.r >= 250 && s.g <= 2 && s.b <= 2).length /
      Math.max(1, samples.length),
  }
}
/** Narrow acquisition warning, not a physiological threshold or proof of sensor clipping.
 * Legacy red+green clipping misses a near-ceiling red-only image (observed on Honor).
 * Leave streams with a usable-looking green/blue channel or varying red untouched.
 */
export function redCeilingPattern(stats: ReturnType<typeof frameSummary>) {
  return stats.redCeilingFraction >= 0.95 && stats.redRange < 2
}
export type CameraCheck = {
  status: 'checking' | 'ready' | 'problem'
  code: string
  message: string
  stats: ReturnType<typeof frameSummary>
}
export function checkCamera(
  samples: PpgSample[],
  elapsedMs: number,
): CameraCheck {
  const recent = samples.filter((s) => s.t >= Math.max(0, elapsedMs - 2500))
  const stats = frameSummary(recent)
  const result = (
    status: CameraCheck['status'],
    code: string,
    message: string,
  ) => ({ status, code, message, stats })
  if (elapsedMs < 3000)
    return result(
      'checking',
      'checking',
      'Checking camera frames and fingertip coverage…',
    )
  if (stats.frames < 2 || elapsedMs - (recent.at(-1)?.t ?? 0) > 400)
    return result(
      'problem',
      'no-frames',
      'The camera is not delivering fresh frames. Reopen the camera or select another rear camera.',
    )
  if (stats.fps < 20)
    return result(
      'problem',
      'slow-frames',
      `The camera is delivering ${stats.fps.toFixed(2)} fps. This measurement needs at least 20 fps. Try Improve camera stream.`,
    )
  if (stats.maxGapMs > 200)
    return result(
      'problem',
      'frame-gaps',
      'Camera frames are arriving with interruptions. Close other camera apps or reopen the camera.',
    )
  if (stats.seconds < 1.5)
    return result('checking', 'settling', 'Checking fresh camera frames…')
  if (stats.red < 35)
    return result(
      'problem',
      'too-dark',
      'Too little light reaches this lens. Check the rear light and cover the active lens near it.',
    )
  if (stats.clipped > 0.65)
    return result(
      'problem',
      'too-bright',
      'The image is too bright. Use lighter finger pressure or try another rear camera.',
    )
  if (stats.contactFraction < 0.8)
    return result(
      'problem',
      'contact',
      'Cover the active lens gently. Cover one lens at a time and watch which one changes the preview.',
    )
  if (redCeilingPattern(stats))
    return result(
      'problem',
      'red-ceiling',
      'The red image is near its upper limit and the other colors are almost empty. Camera lighting needs adjustment before measuring.',
    )
  return result(
    'ready',
    'ready',
    `Camera check passed · ${stats.fps.toFixed(1)} fps. This checks capture conditions, not pulse accuracy.`,
  )
}
export function captureFailure(analysis: RhrAnalysis, record: RhrRecord) {
  const reasons = analysis.reasons
  if (reasons.includes('interrupted'))
    return 'Measurement interrupted. Keep this screen open for all 15 seconds.'
  if (reasons.includes('camera-light'))
    return 'The rear light was not available. Reopen the camera and check that the light is on.'
  const stats = frameSummary(record.samples.filter((s) => s.t >= 2000))
  if (stats.frames < 2)
    return 'No usable camera frames were received. Reopen the camera before trying again.'
  if (stats.fps < 20)
    return `The camera delivered ${stats.fps.toFixed(2)} fps; the current measurement needs at least 20 fps. Try Improve camera stream or another rear camera.`
  if (
    reasons.includes('incomplete-signal') ||
    reasons.includes('too-few-frames')
  )
    return `Only ${stats.seconds.toFixed(1)} seconds of post-settling camera frames were received. Reopen the camera and keep the measurement screen open for all 15 seconds.`
  if (reasons.includes('frame-gaps'))
    return 'The camera stream had gaps. Close other camera apps and check the stream before repeating.'
  if (reasons.includes('movement-or-exposure'))
    return 'The camera brightness changed abruptly during capture. Keep your finger still; check the light and camera setup before repeating.'
  if (reasons.includes('finger-contact'))
    return 'The optical contact was inconsistent. Confirm the active lens using the preview, then cover it gently.'
  if (redCeilingPattern(stats))
    return 'The camera captured an almost flat red image near its upper limit, with almost no green or blue signal. No heart rate was saved. Reopen the camera to adjust its exposure before repeating.'
  if (
    reasons.includes('channel-disagreement') ||
    reasons.includes('unstable-pulse')
  )
    return 'The pulse estimates were inconsistent. No heart rate was saved. Keep your hand still and repeat with the checked camera.'
  return 'Camera frames were received, but a reliable pulse could not be identified. No heart rate was saved. Check the camera setup or download signal diagnostics.'
}
export function nextRearCamera(
  devices: { deviceId: string }[],
  current: string,
) {
  const unique = [...new Set(devices.map((d) => d.deviceId).filter(Boolean))]
  if (unique.length < 2) return null
  const i = unique.indexOf(current)
  return unique[(i + 1) % unique.length]
}
export function verifySelectedCamera(
  requested: string,
  settings: MediaTrackSettings,
) {
  if (settings.facingMode && settings.facingMode !== 'environment')
    throw new Error('The browser opened a front camera. Select a rear camera.')
  if (requested && settings.deviceId && settings.deviceId !== requested)
    throw new Error(
      'The browser reopened a different camera than the one selected. This lens switch could not be verified.',
    )
}
/** Small allowlist for an explicit local diagnostic download; never sent with a wellness answer. */
export function cameraDetails(
  track: MediaStreamTrack,
  requestedId: string,
  light: string,
) {
  const settings = track.getSettings()
  let caps: Record<string, unknown> = {}
  try {
    caps = (track.getCapabilities?.() as Record<string, unknown>) ?? {}
  } catch {}
  const keys = [
    'width',
    'height',
    'frameRate',
    'facingMode',
    'torch',
    'focusMode',
    'focusDistance',
    'exposureMode',
    'exposureCompensation',
    'whiteBalanceMode',
    'iso',
  ]
  const pick = (source: Record<string, unknown>) =>
    Object.fromEntries(
      keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
    )
  return {
    requestedId,
    actualId: settings.deviceId ?? null,
    label: track.label,
    light,
    settings: pick(settings as Record<string, unknown>),
    capabilities: pick(caps),
  }
}
export async function improveFrameStream(track: MediaStreamTrack) {
  let caps: MediaTrackCapabilities = {}
  try {
    caps = track.getCapabilities?.() ?? {}
  } catch {}
  if (caps.frameRate?.max !== undefined && caps.frameRate.max < 20)
    throw new Error(
      'This camera reports a frame-rate limit below 20 fps. Try another rear camera.',
    )
  // Explicit user action only. Never modify a working iPhone stream automatically.
  await track.applyConstraints({
    width: { ideal: 160 },
    height: { ideal: 120 },
    frameRate: { min: 20, ideal: 30 },
    advanced: [{ torch: true } as MediaTrackConstraintSet],
  })
}
