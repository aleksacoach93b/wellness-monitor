/** Exact spot within a selected body-map area (muscle / tendon). */

export const PAIN_LOCATION_IDS = [
  'proximal_attachment',
  'proximal_belly',
  'muscle_belly',
  'belly_distal',
  'distal_attachment',
  'whole_muscle',
] as const

export type PainLocationId = (typeof PAIN_LOCATION_IDS)[number]

export const PAIN_LOCATION_LABELS: Record<PainLocationId, string> = {
  proximal_attachment: 'Proximal attachment',
  proximal_belly: 'Proximal–belly',
  muscle_belly: 'Muscle belly',
  belly_distal: 'Belly–distal',
  distal_attachment: 'Distal attachment',
  whole_muscle: 'Whole muscle',
}

/** Anatomical options top → bottom, then Whole muscle. */
export const PAIN_LOCATION_OPTIONS: { id: PainLocationId; label: string }[] =
  PAIN_LOCATION_IDS.map((id) => ({ id, label: PAIN_LOCATION_LABELS[id] }))

export type BodyMapAreaValue = {
  rating: number
  location: PainLocationId
}

export type BodyMapAreaStored = number | BodyMapAreaValue

export function isPainLocationId(value: unknown): value is PainLocationId {
  return typeof value === 'string' && (PAIN_LOCATION_IDS as readonly string[]).includes(value)
}

export function getBodyMapRating(value: BodyMapAreaStored | undefined | null): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  return typeof value.rating === 'number' ? value.rating : 0
}

export function getBodyMapLocationId(
  value: BodyMapAreaStored | undefined | null
): PainLocationId | null {
  if (value == null || typeof value === 'number') return null
  return isPainLocationId(value.location) ? value.location : null
}

export function getBodyMapLocationLabel(
  value: BodyMapAreaStored | undefined | null
): string | null {
  const id = getBodyMapLocationId(value)
  return id ? PAIN_LOCATION_LABELS[id] : null
}

/** Normalize legacy number-only values and new { rating, location } objects. */
export function normalizeBodyMapAreaValue(
  value: unknown
): BodyMapAreaValue | null {
  if (typeof value === 'number' && value >= 1 && value <= 10) {
    return null // incomplete — intensity only (legacy / draft)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as { rating?: unknown; location?: unknown }
    const rating = typeof obj.rating === 'number' ? obj.rating : NaN
    if (rating >= 1 && rating <= 10 && isPainLocationId(obj.location)) {
      return { rating, location: obj.location }
    }
  }
  return null
}

export function parseBodyMapAnswerValue(
  raw: unknown
): Record<string, BodyMapAreaStored> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, BodyMapAreaStored> = {}
  for (const [areaId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && value >= 1 && value <= 10) {
      out[areaId] = value
      continue
    }
    const normalized = normalizeBodyMapAreaValue(value)
    if (normalized) out[areaId] = normalized
  }
  return out
}
