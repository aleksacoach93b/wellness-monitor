/** Exact spot + situational triggers within a selected body-map area. */

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

export const PAIN_WHEN_IDS = [
  'during_acceleration',
  'during_high_speed_running',
  'during_change_of_direction',
  'during_decelerating',
  'during_jumping_landing',
  'during_shooting',
  'during_kicking_passing',
  'during_sprinting',
  'during_walking',
  'at_rest',
  'after_training_match',
  'during_warm_up',
  'during_stretching',
  'morning_on_waking',
  'during_tackling_contact',
] as const

export type PainWhenId = (typeof PAIN_WHEN_IDS)[number]

export const PAIN_WHEN_LABELS: Record<PainWhenId, string> = {
  during_acceleration: 'During acceleration',
  during_high_speed_running: 'During high-speed running',
  during_change_of_direction: 'During change of direction',
  during_decelerating: 'During decelerating / braking',
  during_jumping_landing: 'During jumping / landing',
  during_shooting: 'During shooting',
  during_kicking_passing: 'During kicking / passing',
  during_sprinting: 'During sprinting',
  during_walking: 'During walking',
  at_rest: 'At rest',
  after_training_match: 'After training / match',
  during_warm_up: 'During warm-up',
  during_stretching: 'During stretching',
  morning_on_waking: 'Morning / on waking',
  during_tackling_contact: 'During tackling / contact',
}

export const PAIN_WHEN_OPTIONS: { id: PainWhenId; label: string }[] =
  PAIN_WHEN_IDS.map((id) => ({ id, label: PAIN_WHEN_LABELS[id] }))

export type BodyMapAreaValue = {
  rating: number
  location: PainLocationId
  when: PainWhenId[]
}

export type BodyMapAreaStored = number | BodyMapAreaValue

export function isPainLocationId(value: unknown): value is PainLocationId {
  return typeof value === 'string' && (PAIN_LOCATION_IDS as readonly string[]).includes(value)
}

export function isPainWhenId(value: unknown): value is PainWhenId {
  return typeof value === 'string' && (PAIN_WHEN_IDS as readonly string[]).includes(value)
}

export function parsePainWhenIds(value: unknown): PainWhenId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<PainWhenId>()
  for (const item of value) {
    if (isPainWhenId(item)) seen.add(item)
  }
  return PAIN_WHEN_IDS.filter((id) => seen.has(id))
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

export function getBodyMapWhenIds(
  value: BodyMapAreaStored | undefined | null
): PainWhenId[] {
  if (value == null || typeof value === 'number') return []
  return parsePainWhenIds(value.when)
}

export function getBodyMapWhenLabels(
  value: BodyMapAreaStored | undefined | null
): string[] {
  return getBodyMapWhenIds(value).map((id) => PAIN_WHEN_LABELS[id])
}

export function formatBodyMapWhenSummary(
  value: BodyMapAreaStored | undefined | null,
  maxLabels = 2
): string | null {
  const labels = getBodyMapWhenLabels(value)
  if (labels.length === 0) return null
  if (labels.length <= maxLabels) return labels.join(', ')
  return `${labels.slice(0, maxLabels).join(', ')} +${labels.length - maxLabels}`
}

/** Normalize legacy and current body-map area payloads. */
export function normalizeBodyMapAreaValue(
  value: unknown
): BodyMapAreaValue | null {
  if (typeof value === 'number' && value >= 1 && value <= 10) {
    return null // incomplete — intensity only (legacy / draft)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as { rating?: unknown; location?: unknown; when?: unknown }
    const rating = typeof obj.rating === 'number' ? obj.rating : NaN
    if (rating >= 1 && rating <= 10 && isPainLocationId(obj.location)) {
      return {
        rating,
        location: obj.location,
        when: parsePainWhenIds(obj.when),
      }
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
