/** Joints / Areas view — shared mannequin zones (not the detailed muscle SVG). */

export const JOINT_LOCATION_IDS = [
  'medial',
  'lateral',
  'anterior',
  'posterior',
  'whole_joint',
] as const

export type JointLocationId = (typeof JOINT_LOCATION_IDS)[number]

export const JOINT_LOCATION_LABELS: Record<JointLocationId, string> = {
  medial: 'Medial',
  lateral: 'Lateral',
  anterior: 'Anterior',
  posterior: 'Posterior',
  whole_joint: 'Whole joint',
}

export const JOINT_LOCATION_OPTIONS: { id: JointLocationId; label: string }[] =
  JOINT_LOCATION_IDS.map((id) => ({ id, label: JOINT_LOCATION_LABELS[id] }))

export const AREA_LOCATION_IDS = ['proximal', 'mid', 'distal', 'whole_area'] as const

export type AreaLocationId = (typeof AREA_LOCATION_IDS)[number]

export const AREA_LOCATION_LABELS: Record<AreaLocationId, string> = {
  proximal: 'Proximal',
  mid: 'Mid',
  distal: 'Distal',
  whole_area: 'Whole area',
}

export const AREA_LOCATION_OPTIONS: { id: AreaLocationId; label: string }[] =
  AREA_LOCATION_IDS.map((id) => ({ id, label: AREA_LOCATION_LABELS[id] }))

export type JointsAreaKind = 'joint' | 'area'

export type JointsAreaZone = {
  id: string
  label: string
  kind: JointsAreaKind
  view: 'front' | 'back'
  suggestMuscleView?: boolean
}

function pair(
  view: 'front' | 'back',
  slug: string,
  label: string,
  kind: JointsAreaKind,
  suggestMuscleView = false
): JointsAreaZone[] {
  return [
    { id: `${view}_left_${slug}`, label: `Left ${label}`, kind, view, suggestMuscleView },
    { id: `${view}_right_${slug}`, label: `Right ${label}`, kind, view, suggestMuscleView },
  ]
}

export const JOINTS_AREAS_ZONES: JointsAreaZone[] = [
  ...pair('front', 'head', 'Head', 'area'),
  ...pair('front', 'neck', 'Neck', 'joint'),
  ...pair('front', 'shoulder', 'Shoulder', 'joint'),
  ...pair('front', 'chest', 'Chest', 'area', true),
  ...pair('front', 'groin', 'Groin', 'joint'),
  ...pair('front', 'hip', 'Hip', 'joint'),
  ...pair('front', 'upper_arm', 'Upper Arm', 'area'),
  ...pair('front', 'elbow', 'Elbow', 'joint'),
  ...pair('front', 'forearm', 'Forearm', 'area'),
  ...pair('front', 'wrist', 'Wrist', 'joint'),
  ...pair('front', 'hand', 'Hand', 'area'),
  ...pair('front', 'quads', 'Quads', 'area', true),
  ...pair('front', 'adductors', 'Adductors', 'area', true),
  ...pair('front', 'knee', 'Knee', 'joint'),
  ...pair('front', 'shin', 'Shin', 'area'),
  ...pair('front', 'ankle', 'Ankle', 'joint'),
  ...pair('front', 'foot', 'Foot', 'joint'),
  ...pair('back', 'head', 'Head', 'area'),
  ...pair('back', 'neck', 'Neck', 'joint'),
  ...pair('back', 'shoulder', 'Shoulder', 'joint'),
  ...pair('back', 'upper_back', 'Upper Back', 'area', true),
  ...pair('back', 'lower_back', 'Lower Back', 'joint'),
  ...pair('back', 'glutes', 'Glutes', 'area', true),
  ...pair('back', 'upper_arm', 'Upper Arm', 'area'),
  ...pair('back', 'elbow', 'Elbow', 'joint'),
  ...pair('back', 'forearm', 'Forearm', 'area'),
  ...pair('back', 'wrist', 'Wrist', 'joint'),
  ...pair('back', 'hand', 'Hand', 'area'),
  ...pair('back', 'hamstrings', 'Hamstrings', 'area', true),
  ...pair('back', 'adductors', 'Adductors', 'area', true),
  ...pair('back', 'knee', 'Knee', 'joint'),
  ...pair('back', 'calves', 'Calves', 'area', true),
  ...pair('back', 'ankle', 'Ankle', 'joint'),
  ...pair('back', 'heel', 'Heel', 'joint'),
]

export const JOINTS_AREAS_ZONE_IDS = JOINTS_AREAS_ZONES.map((z) => z.id)

const ZONE_BY_ID = new Map(JOINTS_AREAS_ZONES.map((z) => [z.id, z]))

export const JOINTS_AREA_LABELS: Record<string, string> = {
  ...Object.fromEntries(JOINTS_AREAS_ZONES.map((z) => [z.id, z.label])),
  front_left_abdomen: 'Left Groin',
  front_right_abdomen: 'Right Groin',
}

export function getJointsAreaZone(areaId: string): JointsAreaZone | undefined {
  return ZONE_BY_ID.get(areaId) ?? ZONE_BY_ID.get(areaId.replace('abdomen', 'groin'))
}

export function isJointsAreaId(areaId: string): boolean {
  return ZONE_BY_ID.has(areaId) || areaId in JOINTS_AREA_LABELS
}

export function getJointsAreaKind(areaId: string): JointsAreaKind | null {
  return getJointsAreaZone(areaId)?.kind ?? null
}

export function shouldSuggestMuscleView(areaId: string): boolean {
  return Boolean(getJointsAreaZone(areaId)?.suggestMuscleView)
}

export function isJointLocationId(value: unknown): value is JointLocationId {
  return typeof value === 'string' && (JOINT_LOCATION_IDS as readonly string[]).includes(value)
}

export function isAreaLocationId(value: unknown): value is AreaLocationId {
  return typeof value === 'string' && (AREA_LOCATION_IDS as readonly string[]).includes(value)
}
