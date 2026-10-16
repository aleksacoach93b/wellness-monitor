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
>
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
      'This rear camera does not support the camera light. Choose another rear camera or open this page in Safari.',
    )
  const constraints = [
    { torch: true, advanced: [{ torch: true }] },
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
      'The camera light could not be switched on. Choose another rear camera or try Safari.',
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
      advanced: [
        {
          torch: true,
          exposureCompensation: target,
        } as MediaTrackConstraintSet,
      ],
    })
    return true
  } catch {
    return false
  }
}
