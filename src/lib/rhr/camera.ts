/** Runtime shapes differ: WebKit may expose a boolean, newer implementations an array. */
export function torchCapability(
  value: unknown,
): 'supported' | 'unsupported' | 'unknown' {
  if (value === true) return 'supported'
  if (value === false) return 'unsupported'
  if (Array.isArray(value)) {
    if (value.some((v) => v === true)) return 'supported'
    if (value.length && value.every((v) => v === false)) return 'unsupported'
  }
  return 'unknown'
}
export type TorchState = 'on' | 'unconfirmed'
type TorchTrack = Pick<
  MediaStreamTrack,
  'getCapabilities' | 'getSettings' | 'applyConstraints' | 'readyState'
> & { getConstraints?: () => MediaTrackConstraints }
/** Keep an explicitly repaired stream/exposure when verifying its light again. */
function preservingConstraints(
  track: TorchTrack,
  values: MediaTrackConstraintSet,
): MediaTrackConstraints {
  let previous: MediaTrackConstraints = {}
  try {
    previous = track.getConstraints?.() ?? {}
  } catch {}
  return {
    ...previous,
    ...values,
    advanced: [
      ...(previous.advanced ?? []).map((a) => ({ ...a, ...values })),
      values,
    ],
  }
}
export async function enableCameraLight(
  track: TorchTrack,
): Promise<TorchState> {
  if (track.readyState !== 'live')
    throw new Error('The rear camera has stopped. Enable it again.')
  let capability: unknown
  try {
    capability = (track.getCapabilities?.() as { torch?: unknown })?.torch
  } catch {
    /* Try the constraint when capability reporting is unavailable. */
  }
  if (torchCapability(capability) === 'unsupported')
    throw new Error(
      'This rear camera does not support the camera light. Choose another rear camera or a browser that supports its camera light.',
    )
  const constraints = [
    preservingConstraints(track, { torch: true } as MediaTrackConstraintSet),
    { advanced: [{ torch: true }] },
    { torch: true },
  ]
  let applied = false
  for (const request of constraints) {
    try {
      await track.applyConstraints(request as MediaTrackConstraints)
      applied = true
      try {
        if (
          track.readyState === 'live' &&
          (track.getSettings() as MediaTrackSettings & { torch?: unknown })
            .torch === true
        )
          return 'on'
      } catch {
        /* Try the other constraint form. */
      }
    } catch {
      /* Some engines accept only the direct or advanced form. */
    }
  }
  if (!applied)
    throw new Error(
      'The camera light could not be switched on. Choose another rear camera or a browser that supports its camera light.',
    )
  if (track.readyState !== 'live')
    throw new Error('The rear camera has stopped. Enable it again.')
  // WebKit has shipped stale false values here. A resolved constraint is not
  // proof of illumination: ask for visual confirmation unless it reports true.
  try {
    if (
      (track.getSettings() as MediaTrackSettings & { torch?: unknown })
        .torch === true
    )
      return 'on'
  } catch {
    /* Require visual confirmation. */
  }
  return 'unconfirmed'
}

export type ExposureAdjustment = {
  status: 'requested' | 'unsupported' | 'limit' | 'ignored'
  before: number | null
  requested: number | null
  reported: number | null
}

export const RHR_ACQUISITION_VERSION = 'android-adaptive-gain-v2'
export const needsAndroidCameraHold = (userAgent: string) =>
  /Android/i.test(userAgent)
type HoldMode = 'whiteBalanceMode' | 'focusMode' | 'exposureMode'
type HoldSettings = MediaTrackSettings & {
  whiteBalanceMode?: string
  focusMode?: string
  exposureMode?: string
  focusDistance?: number
  exposureTime?: number
}
export type CameraHold = {
  controls: {
    mode: HoldMode
    status: 'requested' | 'confirmed' | 'unsupported' | 'failed'
    before: string | null
    reported: string | null
  }[]
  exposureReleased: boolean
}
/** Android Chromium maps manual white balance to AWB lock and holds its last
 * exposure time in manual exposure mode. Request only advertised controls after
 * real covered frames. Recheck the resulting image; settings alone are not proof.
 * No arbitrary shutter/ISO/color-temperature/focus-distance values are invented.
 */
export async function holdAndroidPulseCamera(
  track: TorchTrack,
  userAgent: string,
): Promise<CameraHold> {
  const report: CameraHold = { controls: [], exposureReleased: false }
  if (!needsAndroidCameraHold(userAgent)) return report
  const caps = track.getCapabilities?.() as Record<string, unknown> | undefined
  for (const mode of [
    'whiteBalanceMode',
    'focusMode',
    'exposureMode',
  ] as const) {
    if (track.readyState !== 'live') throw new Error('The rear camera stopped.')
    const before = track.getSettings() as HoldSettings
    const entry: CameraHold['controls'][number] = {
      mode,
      status: 'unsupported',
      before: before[mode] ?? null,
      reported: before[mode] ?? null,
    }
    report.controls.push(entry)
    if (
      !Array.isArray(caps?.[mode]) ||
      !(caps[mode] as unknown[]).includes('manual')
    )
      continue
    const values: Record<string, unknown> = { torch: true, [mode]: 'manual' }
    if (mode === 'focusMode') {
      // Freeze the reported focus, rather than guessing lens-specific units/distance.
      const distance = before.focusDistance
      if (typeof distance !== 'number' || !Number.isFinite(distance)) continue
      values.focusDistance = distance
    }
    // On Android Chromium, a mode-only request uses its last known exposure time.
    // Missing camera metadata can trigger a driver fallback: always recheck frames.
    // Prefer a reported value; do not invent a shutter time, midpoint or ISO here.
    if (
      mode === 'exposureMode' &&
      typeof before.exposureTime === 'number' &&
      Number.isFinite(before.exposureTime) &&
      before.exposureTime > 0
    )
      values.exposureTime = before.exposureTime
    try {
      await track.applyConstraints(
        preservingConstraints(track, values as MediaTrackConstraintSet),
      )
      if (track.readyState !== 'live')
        throw new Error('The rear camera stopped.')
      entry.reported = (track.getSettings() as HoldSettings)[mode] ?? null
      // Chromium can report continuous AWB even after its AWB_LOCK request.
      entry.status = entry.reported === 'manual' ? 'confirmed' : 'requested'
    } catch {
      entry.status = 'failed'
    }
  }
  return report
}

/** One bounded recovery if a mode-only exposure hold makes the real image unusable. */
export async function releasePulseExposureHold(track: TorchTrack) {
  await track.applyConstraints(
    preservingConstraints(track, {
      torch: true,
      exposureMode: 'continuous',
    } as MediaTrackConstraintSet),
  )
}

export type GainAdjustment = {
  status: 'requested' | 'unsupported' | 'ignored' | 'limit'
  before: number | null
  requested: number | null
  reported: number | null
}
/** Closed-loop setup only. Control brightness, never use or target a pulse rate.
 * Manual AE can fall back to minimum sensor gain on Android. Use measured RGB
 * to choose one bounded ISO step, then inspect fresh frames before another step.
 */
export async function adjustAndroidPulseGain(
  track: TorchTrack,
  red: number,
): Promise<GainAdjustment> {
  if (track.readyState !== 'live') throw new Error('The rear camera stopped.')
  const settings = track.getSettings() as MediaTrackSettings & {
    iso?: number
    exposureMode?: string
  }
  const before = settings.iso
  const base = {
    before: before ?? null,
    requested: null,
    reported: before ?? null,
  }
  const caps = track.getCapabilities?.() as
    { iso?: { min: number; max: number; step?: number } } | undefined
  const range = caps?.iso
  if (
    !range ||
    !['manual', 'none'].includes(settings.exposureMode ?? '') ||
    !Number.isFinite(red) ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min <= 0 ||
    range.max < range.min ||
    typeof before !== 'number' ||
    !Number.isFinite(before) ||
    before < range.min ||
    before > range.max
  )
    return { ...base, status: 'unsupported' }
  // Engineering ceiling: do not chase poor illumination with extreme sensor gain.
  const ceiling = Math.min(range.max, 1600)
  const step =
    range.step && Number.isFinite(range.step) && range.step > 0 ? range.step : 1
  const raw = red < 140 ? before * 2 : red > 230 ? before / 2 : before
  const requested =
    range.min +
    Math.floor(
      (Math.max(range.min, Math.min(ceiling, raw)) - range.min) / step + 1e-6,
    ) *
      step
  if (
    ceiling < range.min ||
    (red < 140 && requested <= before) ||
    (red > 230 && requested >= before) ||
    Math.abs(requested - before) < Math.max(1e-6, step / 2)
  )
    return { ...base, status: 'limit' }
  await track.applyConstraints(
    preservingConstraints(track, {
      torch: true,
      exposureMode: 'manual',
      iso: requested,
    } as MediaTrackConstraintSet),
  )
  const reported = (
    track.getSettings() as MediaTrackSettings & { iso?: number }
  ).iso
  return {
    before,
    requested,
    reported: reported ?? null,
    status:
      typeof reported === 'number' &&
      Number.isFinite(reported) &&
      Math.abs(reported - requested) <= Math.max(1e-4, step * 0.1)
        ? 'requested'
        : 'ignored',
  }
}
/** Called only by the narrow red-ceiling setup screen, never during the 15s capture.
 * A resolved constraint is not proof of a repaired optical signal; recheck real frames.
 */
export async function reducePulseExposure(
  track: TorchTrack,
): Promise<ExposureAdjustment> {
  if (track.readyState !== 'live')
    throw new Error('The rear camera has stopped. Enable it again.')
  type EvSettings = MediaTrackSettings & { exposureCompensation?: number }
  let range: { min: number; max: number; step?: number } | undefined
  let before: number | undefined
  try {
    range = (
      track.getCapabilities?.() as {
        exposureCompensation?: typeof range
      }
    )?.exposureCompensation
    before = (track.getSettings() as EvSettings).exposureCompensation
  } catch {}
  const base = {
    before: before ?? null,
    requested: null,
    reported: before ?? null,
  }
  if (
    !range ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min >= range.max ||
    typeof before !== 'number' ||
    !Number.isFinite(before) ||
    before < range.min ||
    before > range.max
  )
    return { ...base, status: 'unsupported' }
  const step =
    range.step && Number.isFinite(range.step) && range.step > 0
      ? range.step
      : 0.5
  const requested = Math.max(
    range.min,
    Math.min(
      range.max,
      range.min +
        Math.round((before - Math.max(step, 1) - range.min) / step) * step,
    ),
  )
  if (requested >= before - 1e-6) return { ...base, status: 'limit' }
  await track.applyConstraints(
    preservingConstraints(track, {
      torch: true,
      exposureCompensation: requested,
    } as MediaTrackConstraintSet),
  )
  const reported = (track.getSettings() as EvSettings).exposureCompensation
  return {
    status:
      typeof reported === 'number' &&
      Number.isFinite(reported) &&
      Math.abs(reported - requested) <= Math.max(1e-4, step * 0.1)
        ? 'requested'
        : 'ignored',
    before,
    requested,
    reported:
      typeof reported === 'number' && Number.isFinite(reported)
        ? reported
        : null,
  }
}

/** Prefer the main rear lens over virtual/ultrawide/telephoto choices on multi-camera phones. */
export function primaryRearCamera(
  devices: { deviceId: string; label: string }[],
) {
  return (
    devices.find(
      (d) =>
        /back|rear|environment/i.test(d.label) &&
        !/ultra|tele|dual|triple|desk|continuity|front/i.test(d.label),
    )?.deviceId ?? null
  )
}

/** Best effort: request a useful video rate; never claim the delivered rate from constraints alone. */
export async function configurePulseCamera(track: TorchTrack) {
  let caps: MediaTrackCapabilities
  try {
    caps = track.getCapabilities?.() ?? {}
  } catch {
    return
  }
  if (
    !caps.frameRate ||
    typeof caps.frameRate.max !== 'number' ||
    !Number.isFinite(caps.frameRate.max) ||
    caps.frameRate.max < 15
  )
    return
  const target = Math.min(30, caps.frameRate.max)
  if ((caps.frameRate.min ?? 0) > target) return
  try {
    await track.applyConstraints({
      frameRate: { ideal: target, min: Math.max(15, caps.frameRate.min ?? 0) },
      advanced: [{ torch: true } as MediaTrackConstraintSet],
    })
  } catch {
    /* Keep the working stream; actual delivered frames are checked independently. */
  }
}

/** Adjust only before the timed capture, within the camera's advertised EV range. */
export async function adjustPulseExposure(
  track: TorchTrack,
  sample: { r: number; g: number; clipped: number },
) {
  type Exposure = {
    exposureCompensation?: { min: number; max: number; step?: number }
  }
  let caps: Exposure,
    settings: MediaTrackSettings & { exposureCompensation?: number }
  try {
    caps = track.getCapabilities?.() as Exposure
    settings = track.getSettings()
  } catch {
    return false
  }
  const range = caps?.exposureCompensation
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max))
    return false
  const direction =
    sample.clipped > 0.1 || (sample.r > 245 && sample.g > 245)
      ? -1
      : sample.r < 35
        ? 1
        : 0
  if (!direction) return false
  const current = settings.exposureCompensation
  // Without an actual reported EV we cannot safely increment a previous request.
  if (typeof current !== 'number' || !Number.isFinite(current)) return false
  const step = range.step && range.step > 0 ? range.step : 0.5
  const requested = current + direction * Math.max(step, 0.5)
  const target = Math.max(
    range.min,
    Math.min(
      range.max,
      range.min + Math.round((requested - range.min) / step) * step,
    ),
  )
  if (Math.abs(target - current) < step * 0.5) return false
  try {
    await track.applyConstraints({
      torch: true,
      advanced: [
        {
          torch: true,
          exposureCompensation: target,
        } as MediaTrackConstraintSet,
      ],
    } as MediaTrackConstraints)
    return true
  } catch {
    return false
  }
}
