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
