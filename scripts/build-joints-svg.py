#!/usr/bin/env python3
"""Clean symmetric Joints/Areas SVG from measured original mannequin planes."""

from pathlib import Path

import cv2
import numpy as np

SRC = Path(
    "/Users/aleksaboskovic/.cursor/projects/Users-aleksaboskovic-wellness-app/assets/"
    "Joints_and_Body_Area_visuals_2026-499947e3-4a67-4557-9820-f106148780ab.png"
)
OUT_SVG = Path("/Users/aleksaboskovic/wellness-app/wellness-monitor/src/components/JointsAreasSvg.tsx")
OUT_MAP = Path("/Users/aleksaboskovic/wellness-app/wellness-monitor/src/lib/jointsAreasMap.ts")
PREVIEW = Path("/tmp/joints-clean-preview.png")


def P(mid: float, side: str, off: float, y: float) -> tuple[float, float]:
    x = mid - off if side == "right" else mid + off
    return (round(x, 1), round(y, 1))


def path(pts: list[tuple[float, float]]) -> str:
    return "M" + "L".join(f"{x},{y}" for x, y in pts) + "Z"


def pair_zones(mid: float, view: str, slug: str, offset_pts: list[tuple[float, float]]) -> list[tuple[str, str]]:
    out = []
    for side in ("right", "left"):
        pts = [P(mid, side, o, y) for o, y in offset_pts]
        out.append((f"{view}_{side}_{slug}", path(pts)))
    return out


def head_pts() -> list[tuple[float, float]]:
    # capsule like the original, not a pointy oval
    return [
        (0.8, 8),
        (8, 8.2),
        (16, 10),
        (21, 14),
        (24, 20),
        (25, 28),
        (25, 42),
        (24, 54),
        (21, 64),
        (16, 71),
        (13, 74),
        (0.8, 74),
    ]


def hand_pts(y0: float = 289) -> list[tuple[float, float]]:
    return [
        (82, y0),
        (96, y0),
        (98, y0 + 6),
        (99, y0 + 16),
        (98, y0 + 26),
        (94, y0 + 32),
        (88, y0 + 34),
        (82, y0 + 32),
        (79, y0 + 24),
        (80, y0 + 14),
        (81, y0 + 6),
    ]


def build_front(mid: float = 103.0) -> list[tuple[str, str]]:
    z: list[tuple[str, str]] = []
    # shared planes from the original grid
    N, S, C = 74, 96, 148
    E1, E2, W = 186, 209, 268
    GV, GM, H = 236, 250, 289
    K0, K1, AN, F0, F1 = 382, 414, 497, 510, 521

    z += pair_zones(mid, "front", "head", head_pts())

    # Neck + original clavicle V
    z += pair_zones(
        mid,
        "front",
        "neck",
        [(0.8, N), (13, N), (22, 84), (50, S), (0.8, 108)],
    )

    # Shoulder torso block — same top and bottom planes left/right
    z += pair_zones(
        mid,
        "front",
        "shoulder",
        [
            (0.8, 108),
            (50, S),
            (52, S),
            (50, C),
            (9, C),
            (0.8, 136),
        ],
    )

    # Upper arm hangs from the same shoulder plane
    z += pair_zones(
        mid,
        "front",
        "upper_arm",
        [(52, S), (58, 99), (68, 108), (74, 122), (77, 136), (78, C), (52, C)],
    )

    # Chest — down to groin V
    z += pair_zones(
        mid,
        "front",
        "chest",
        [(0.8, 136), (9, C), (49, C), (47, 186), (42, GV), (0.8, GM)],
    )

    # Groin
    z += pair_zones(
        mid,
        "front",
        "groin",
        [(0.8, GM), (42, GV), (28, 262), (22, H), (0.8, H)],
    )

    # Hip
    z += pair_zones(
        mid,
        "front",
        "hip",
        [(42, GV), (49, 255), (49, H), (22, H), (28, 262)],
    )

    # Elbow bands (same name, two original rows)
    z += pair_zones(mid, "front", "elbow", [(52, C), (79, C), (83, E1), (47, E1)])
    z += pair_zones(mid, "front", "elbow", [(47, E1), (83, E1), (88, E2), (42, E2)])

    # Forearm
    z += pair_zones(mid, "front", "forearm", [(42, E2), (88, E2), (93, W), (77, W)])

    # Wrist
    z += pair_zones(mid, "front", "wrist", [(77, W), (93, W), (97, H), (83, H)])

    # Hand
    z += pair_zones(mid, "front", "hand", hand_pts(H))

    # Adductors
    z += pair_zones(mid, "front", "adductors", [(0.8, H), (18, H), (11, 330), (0.8, 310)])

    # Quads
    z += pair_zones(mid, "front", "quads", [(18, H), (49, H), (50, 340), (47, K0), (15, K0), (11, 330)])

    # Knee
    z += pair_zones(mid, "front", "knee", [(15, K0), (47, K0), (51, K1), (20, K1)])

    # Shin
    z += pair_zones(mid, "front", "shin", [(20, K1), (51, K1), (50, 450), (38, AN), (19, AN)])

    # Ankle
    z += pair_zones(mid, "front", "ankle", [(19, AN), (38, AN), (45, F0), (16, F0)])

    # Foot
    z += pair_zones(mid, "front", "foot", [(16, F0), (45, F0), (52, F1), (12, F1)])
    return z


def build_back(mid: float = 106.0) -> list[tuple[str, str]]:
    z: list[tuple[str, str]] = []
    N, S, C = 67, 102, 154
    E1, E2, W, H = 187, 209, 268, 291
    V0, V1, G = 178, 192, 244
    K0, K1, CAL, AN, HE = 373, 406, 458, 503, 520

    z += pair_zones(mid, "back", "head", [
        (0.8, 8), (6, 8.5), (12, 11), (18, 16), (22, 24),
        (24.5, 36), (24, 48), (20, 60), (15, N), (0.8, N),
    ])
    z += pair_zones(mid, "back", "neck", [(0.8, N), (15, N), (22, 83), (0.8, 83)])
    z += pair_zones(mid, "back", "shoulder", [(0.8, 83), (22, 83), (40, S), (0.8, S)])
    z += pair_zones(mid, "back", "upper_arm", [(40, S), (62, S), (72, 118), (77, C), (51, C)])
    z += pair_zones(mid, "back", "upper_back", [(0.8, S), (40, S), (51, C), (44, V1), (0.8, V0)])
    z += pair_zones(mid, "back", "lower_back", [(0.8, V0), (45, V1), (42, G), (0.8, G + 6)])
    z += pair_zones(mid, "back", "elbow", [(51, C), (78, C), (83, E1), (48, E1)])
    z += pair_zones(mid, "back", "elbow", [(48, E1), (83, E1), (88, E2), (43, E2)])
    z += pair_zones(mid, "back", "forearm", [(43, E2), (88, E2), (93, W), (78, W)])
    z += pair_zones(mid, "back", "wrist", [(78, W), (93, W), (97, H), (83, H)])
    z += pair_zones(mid, "back", "glutes", [(0.8, G + 6), (42, G), (46, 260), (49, 275), (49, H), (0.8, H)])
    z += pair_zones(mid, "back", "hand", hand_pts(H))
    z += pair_zones(mid, "back", "adductors", [(0.8, H), (16, H), (10, 330), (0.8, 312)])
    z += pair_zones(mid, "back", "hamstrings", [(16, H), (49, H), (50, 340), (47, K0), (14, K0), (10, 330)])
    z += pair_zones(mid, "back", "knee", [(14, K0), (47, K0), (46, K1), (17, K1)])
    z += pair_zones(mid, "back", "calves", [(17, K1), (46, K1), (48, 430), (39, CAL), (16, CAL)])
    z += pair_zones(mid, "back", "ankle", [(16, CAL), (39, CAL), (40, AN), (17, AN)])
    z += pair_zones(mid, "back", "heel", [(17, AN), (40, AN), (42, HE), (16, HE)])
    return z


MAP_TS = r'''/** Joints / Areas view — shared mannequin zones (not the detailed muscle SVG). */

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
'''


def write_tsx(front: list[tuple[str, str]], back: list[tuple[str, str]]) -> None:
    def jsx(items: list[tuple[str, str]]) -> str:
        seen: dict[str, int] = {}
        lines = []
        for zid, d in items:
            seen[zid] = seen.get(zid, 0) + 1
            key = zid if seen[zid] == 1 else f"{zid}__{seen[zid]}"
            lines.append(f"          {{z('{zid}', '{d}', '{key}')}}")
        return "\n".join(lines)

    OUT_SVG.write_text(
        f"""'use client'

import type {{ MouseEvent }} from 'react'

type Props = {{
  view: 'front' | 'back'
  getAreaColor: (areaId: string) => string
  onAreaClick: (areaId: string, event: MouseEvent) => void
  className?: string
}}

function Zone({{
  id,
  d,
  fill,
  onAreaClick,
}}: {{
  id: string
  d: string
  fill: string
  onAreaClick: (areaId: string, event: MouseEvent) => void
}}) {{
  const selected = fill !== 'transparent' && fill !== ''
  return (
    <path
      id={{id}}
      className="body-area"
      d={{d}}
      fill={{selected ? fill : '#d1d5db'}}
      stroke="#374151"
      strokeWidth="1.05"
      strokeLinejoin="round"
      strokeLinecap="round"
      paintOrder="fill stroke"
      vectorEffect="non-scaling-stroke"
      onClick={{(e) => onAreaClick(id, e)}}
    />
  )
}}

/** Original joints mannequin, rebuilt as a clean symmetric vector. */
export default function JointsAreasSvg({{
  view,
  getAreaColor,
  onAreaClick,
  className,
}}: Props) {{
  const z = (id: string, d: string, key: string) => (
    <Zone key={{key}} id={{id}} d={{d}} fill={{getAreaColor(id)}} onAreaClick={{onAreaClick}} />
  )

  return (
    <svg
      width="400"
      height="600"
      viewBox={{view === 'front' ? '0 0 206 524' : '0 0 212 524'}}
      xmlns="http://www.w3.org/2000/svg"
      className={{className ?? 'max-w-full h-auto'}}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <style>{{`
          .body-area {{ cursor: pointer; touch-action: manipulation; }}
          .body-area:hover {{ filter: brightness(0.92); }}
        `}}</style>
      </defs>
      {{view === 'front' ? (
        <g>
{jsx(front)}
        </g>
      ) : (
        <g>
{jsx(back)}
        </g>
      )}}
    </svg>
  )
}}
"""
    )
    OUT_MAP.write_text(MAP_TS)


def preview(front: list, back: list, src: np.ndarray) -> None:
    canvas = np.full((524, 470, 3), 255, np.uint8)

    def draw(items, xoff):
        for _id, d in items:
            nums = [tuple(map(float, p.split(","))) for p in d.replace("M", "").replace("Z", "").split("L") if p]
            if len(nums) < 3:
                continue
            pts = np.array([[int(round(x + xoff)), int(round(y))] for x, y in nums], np.int32)
            cv2.fillPoly(canvas, [pts], (209, 213, 219))
            cv2.polylines(canvas, [pts], True, (55, 65, 81), 1, cv2.LINE_AA)

    draw(front, 0)
    draw(back, 258)
    orig = cv2.cvtColor(src[8:532, 0:470], cv2.COLOR_GRAY2BGR)
    cv2.imwrite(str(PREVIEW), np.hstack([orig, canvas]))
    print("preview", PREVIEW)


def main() -> None:
    src = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
    front = build_front(103.0)
    back = build_back(106.0)
    print("FRONT", len(front), "BACK", len(back))
    write_tsx(front, back)
    preview(front, back, src)


if __name__ == "__main__":
    main()
