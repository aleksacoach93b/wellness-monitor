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
