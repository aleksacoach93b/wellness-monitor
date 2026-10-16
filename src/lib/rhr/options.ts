import {
  RHR_VERSION,
  RHR_LEGACY_VERSION,
  RHR_FIXED_VERSION,
  type RhrPosition,
} from './protocol'
export const rhrOptions = () =>
  JSON.stringify({
    widget: 'RHR_CAMERA',
    protocolVersion: RHR_FIXED_VERSION,
    durationSeconds: 15,
  })
export function isRhrQuestion(q: { type: string; options?: string | null }) {
  try {
    return (
      q.type === 'NUMBER' &&
      JSON.parse(q.options || '{}').widget === 'RHR_CAMERA'
    )
  } catch {
    return false
  }
}
export function validRhrOptions(raw: unknown) {
  try {
    const x = JSON.parse(String(raw))
    return (
      x.widget === 'RHR_CAMERA' &&
      [RHR_VERSION, RHR_LEGACY_VERSION, RHR_FIXED_VERSION].includes(
        x.protocolVersion,
      ) &&
      x.durationSeconds === 15
    )
  } catch {
    return false
  }
}
export type RhrAnswer = {
  kind: 'RHR'
  bpm: number
  position: RhrPosition
  rested: true
  durationSeconds: number
  targetDurationSeconds?: 15
  detectionSeconds?: 5
  stableWindowSeconds?: 10
  restarts?: number
  protocolVersion: string
  algorithmVersion?: string
  measuredAt: string
  quality: 'ACCEPTED'
  torch: boolean
  fps: number
  beats: number
  correlation: number
  receipt?: string
}
export function parseRhrAnswer(raw: string): RhrAnswer | null {
  try {
    const x = JSON.parse(raw)
    return x?.kind === 'RHR' &&
      Number.isFinite(x.bpm) &&
      x.bpm >= 30 &&
      x.bpm <= 180 &&
      x.quality === 'ACCEPTED'
      ? x
      : null
  } catch {
    return null
  }
}
export const rhrAnswerText = (raw: string) => {
  const x = parseRhrAnswer(raw)
  return x
    ? `${x.bpm} bpm · ${x.position} · ${x.durationSeconds} seconds · Camera estimate`
    : '—'
}
export const RHR_EXPORT_FIELDS = [
  'HR bpm',
  'Position',
  'Duration s',
  'Signal quality',
  'Measured at UTC',
  'Protocol',
  'Light enabled 0 or 1',
  'Frame rate fps',
  'Rest confirmed 0 or 1',
] as const
export function rhrExportValues(raw: string) {
  const a = parseRhrAnswer(raw)
  return {
    'HR bpm': a?.bpm ?? null,
    Position: a?.position ?? null,
    'Duration s': a?.durationSeconds ?? null,
    'Signal quality': a?.quality ?? null,
    'Measured at UTC': a?.measuredAt ?? null,
    Protocol: a
      ? [a.protocolVersion, a.algorithmVersion].filter(Boolean).join('/')
      : null,
    'Light enabled 0 or 1': a ? Number(a.torch) : null,
    'Frame rate fps': a?.fps ?? null,
    'Rest confirmed 0 or 1': a ? Number(a.rested) : null,
  }
}
