#!/usr/bin/env python3
"""Trace exact closed panels from the original joints artwork into clean vector SVG."""

from __future__ import annotations

from collections import OrderedDict, defaultdict
from pathlib import Path

import cv2
import numpy as np

SRC = Path(
    "/Users/aleksaboskovic/.cursor/projects/Users-aleksaboskovic-wellness-app/assets/"
    "Joints_and_Body_Area_visuals_2026-499947e3-4a67-4557-9820-f106148780ab.png"
)
OUT_MAP = Path("/Users/aleksaboskovic/wellness-app/wellness-monitor/src/lib/jointsAreasMap.ts")
OUT_SVG = Path("/Users/aleksaboskovic/wellness-app/wellness-monitor/src/components/JointsAreasSvg.tsx")

SCALE = 8
TITLES = {
    "head": "Head",
    "neck": "Neck",
    "upper_chest": "Upper Chest",
    "shoulder": "Shoulder",
    "chest": "Chest",
    "groin": "Groin",
    "hip": "Hip",
    "upper_arm": "Upper Arm",
    "elbow": "Elbow",
    "lower_arm": "Lower Arm",
    "forearm": "Forearm",
    "wrist": "Wrist",
    "hand": "Hand",
    "quads": "Quads",
    "adductors": "Adductors",
    "knee": "Knee",
    "shin": "Shin",
    "ankle": "Ankle",
    "foot": "Foot",
    "upper_back": "Upper Back",
    "lower_back": "Lower Back",
    "glutes": "Glutes",
    "hamstrings": "Hamstrings",
    "calves": "Calves",
    "heel": "Heel",
}
JOINTS = {
    "neck",
    "shoulder",
    "elbow",
    "wrist",
    "hip",
    "knee",
    "ankle",
    "foot",
    "heel",
    "groin",
    "lower_back",
}
SUGGEST = {
    "chest",
    "quads",
    "adductors",
    "upper_back",
    "glutes",
    "hamstrings",
    "calves",
}
FALLBACKS = {
    "neck": ["upper_chest"],
    "elbow": ["lower_arm"],
    "lower_arm": ["forearm"],
    "forearm": ["lower_arm"],
    "shoulder": ["upper_chest"],
}


def extract(gray: np.ndarray) -> list[dict]:
    h, w = gray.shape
    big = cv2.resize(gray, (w * SCALE, h * SCALE), interpolation=cv2.INTER_NEAREST)
    body = big < 240
    lines = (big > 140) & (big < 252) & body
    walls = cv2.dilate(lines.astype(np.uint8) * 255, np.ones((5, 5), np.uint8), 1)
    mid = (w * SCALE) // 2
    walls[:, mid - 2 : mid + 3] = 255
    ink = np.where(body, 255, 0).astype(np.uint8)
    ink[walls > 0] = 0
    n, labels, stats, cents = cv2.connectedComponentsWithStats(ink, 4)
    regs: list[dict] = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < 28 * SCALE * SCALE:
            continue
        mask = (labels == i).astype(np.uint8)
        cnts, _ = cv2.findContours(mask * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cnts:
            continue
        cnt = max(cnts, key=cv2.contourArea)
        cy = float(cents[i][1]) / SCALE
        kind = "curve" if cy < 70 or cy > 280 and abs(float(cents[i][0]) / SCALE - w / 2) > 70 else "grid"
        d = clean_path(cnt, kind)
        if not d:
            continue
        regs.append(
            {
                "area": area / (SCALE * SCALE),
                "cx": float(cents[i][0]) / SCALE,
                "cy": cy,
                "w": int(stats[i, cv2.CC_STAT_WIDTH]) / SCALE,
                "h": int(stats[i, cv2.CC_STAT_HEIGHT]) / SCALE,
                "d": d,
            }
        )
    return regs


def snap_hv(pts: np.ndarray) -> np.ndarray:
    out = [pts[0].copy()]
    for p in pts[1:]:
        prev = out[-1]
        dx, dy = p[0] - prev[0], p[1] - prev[1]
        if abs(dx) < SCALE * 0.25 and abs(dy) < SCALE * 0.25:
            continue
        if abs(dy) <= abs(dx) * 0.12:
            p = np.array([p[0], prev[1]])
        elif abs(dx) <= abs(dy) * 0.12:
            p = np.array([prev[0], p[1]])
        out.append(p)
    if len(out) >= 3:
        first, last = out[0], out[-1]
        dx, dy = last[0] - first[0], last[1] - first[1]
        if abs(dy) <= abs(dx) * 0.12:
            out[-1][1] = first[1]
        elif abs(dx) <= abs(dy) * 0.12:
            out[-1][0] = first[0]
    cleaned = [out[0]]
    for p in out[1:]:
        if np.linalg.norm(p - cleaned[-1]) >= SCALE * 0.4:
            cleaned.append(p)
    return np.array(cleaned)


def remove_collinear(pts: np.ndarray) -> np.ndarray:
    if len(pts) < 4:
        return pts
    keep = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = keep[-1], pts[i], pts[i + 1]
        ab = b - a
        bc = c - b
        cross = abs(ab[0] * bc[1] - ab[1] * bc[0])
        if cross > (SCALE * 0.35) ** 2:
            keep.append(b)
    keep.append(pts[-1])
    return np.array(keep)


def chaikin(pts: np.ndarray, iterations: int = 1) -> np.ndarray:
    pts = pts.astype(np.float64)
    for _ in range(iterations):
        nxt = []
        n = len(pts)
        for i in range(n):
            p, q = pts[i], pts[(i + 1) % n]
            nxt.append(0.75 * p + 0.25 * q)
            nxt.append(0.25 * p + 0.75 * q)
        pts = np.array(nxt)
    return pts


def clean_path(cnt: np.ndarray, kind: str) -> str:
    peri = cv2.arcLength(cnt, True)
    best = None
    fracs = [0.004, 0.007, 0.01, 0.014, 0.02, 0.028] if kind == "curve" else [0.01, 0.014, 0.02, 0.028, 0.036]
    lo, hi = (6, 22) if kind == "curve" else (4, 10)
    for frac in fracs:
        approx = cv2.approxPolyDP(cnt, max(SCALE * 0.7, peri * frac), True)
        n = len(approx)
        best = approx
        if lo <= n <= hi:
            break
    pts = snap_hv(best.reshape(-1, 2).astype(np.float64))
    pts = remove_collinear(pts)
    if len(pts) < 3:
        return ""
    if kind == "curve":
        pts = chaikin(pts, 1)
    scaled = [(round(float(p[0]) / SCALE, 1), round(float(p[1]) / SCALE, 1)) for p in pts]
    return "M" + "L".join(f"{x},{y}" for x, y in scaled) + "Z"


def classify_front(r: dict, mid: float) -> str:
    cy, cx, area, w = r["cy"], r["cx"], r["area"], r["w"]
    far = abs(cx - mid) > 48
    if cy < 68:
        return "head"
    if cy < 96:
        return "neck"
    if far and 96 < cy < 160:
        return "upper_arm"
    if cy < 155:
        return "shoulder"
    if far and 160 < cy < 186:
        return "elbow"
    if far and 186 < cy < 220:
        return "lower_arm"
    if far and 220 < cy < 268:
        return "forearm"
    if far and 268 < cy < 283 and area < 180:
        return "wrist"
    if far and cy > 283:
        return "hand"
    if 140 < cy < 235 and not far:
        return "chest"
    if 230 < cy < 272 and w >= 28:
        return "groin"
    if 248 < cy < 292:
        return "hip"
    if 288 < cy < 328 and abs(cx - mid) < 28:
        return "adductors"
    if 310 < cy < 380:
        return "quads"
    if 378 < cy < 420:
        return "knee"
    if 418 < cy < 496:
        return "shin"
    if 494 < cy < 510:
        return "ankle"
    return "foot"


def classify_back(r: dict, mid: float) -> str:
    cy, cx, area, w = r["cy"], r["cx"], r["area"], r["w"]
    far = abs(cx - mid) > 50
    if cy < 62:
        return "head"
    if cy < 84:
        return "neck"
    if 84 < cy < 102:
        return "shoulder"
    if far and 100 < cy < 160:
        return "upper_arm"
    if 100 < cy < 175 and not far:
        return "upper_back"
    if far and 160 < cy < 186:
        return "elbow"
    if 175 < cy < 250 and not far:
        return "lower_back"
    if far and 186 < cy < 220:
        return "lower_arm"
    if far and 220 < cy < 268:
        return "forearm"
    if 240 < cy < 290 and not far:
        return "glutes"
    if far and 268 < cy < 283 and area < 180:
        return "wrist"
    if far and cy > 283:
        return "hand"
    if 288 < cy < 330 and abs(cx - mid) < 28:
        return "adductors"
    if 250 < cy < 295 and w > 30:
        return "hip"
    if 310 < cy < 375:
        return "hamstrings"
    if 375 < cy < 415:
        return "knee"
    if 415 < cy < 460:
        return "calves"
    if 460 < cy < 502:
        return "ankle"
    return "heel"


def unique_slug(used: set[str], view: str, side: str, slug: str) -> str:
    base = f"{view}_{side}_{slug}"
    if base not in used:
        used.add(base)
        return slug
    for alt in FALLBACKS.get(slug, []):
        cand = f"{view}_{side}_{alt}"
        if cand not in used and alt in TITLES:
            used.add(cand)
            return alt
    raise RuntimeError(f"duplicate zone without fallback: {base}")


def jsx_for(zones: list[tuple], prefix: str) -> str:
    return "\n".join(
        f"          {{z('{zid}', '{d}')}}"
        for zid, _label, _kind, _view, _sug, d in zones
        if zid.startswith(prefix)
    )


def write_files(zones: list[tuple]) -> None:
    by_view_slug: dict[tuple[str, str], dict] = defaultdict(lambda: {"left": None, "right": None})
    for zid, label, kind, view, sug, _d in zones:
        _, side, slug = zid.split("_", 2)
        by_view_slug[(view, slug)][side] = (label, kind, sug)

    map_lines = []
    for (view, slug), sides in by_view_slug.items():
        kind = (sides["left"] or sides["right"])[1]
        sug = (sides["left"] or sides["right"])[2]
        title = TITLES.get(slug, slug.replace("_", " ").title())
        sug_arg = ", true" if sug else ""
        map_lines.append(f"  ...pair('{view}', '{slug}', '{title}', '{kind}'{sug_arg}),")

    map_ts = f"""/** Joints / Areas view — shared mannequin zones (not the detailed muscle SVG). */

export const JOINT_LOCATION_IDS = [
  'medial',
  'lateral',
  'anterior',
  'posterior',
  'whole_joint',
] as const

export type JointLocationId = (typeof JOINT_LOCATION_IDS)[number]

export const JOINT_LOCATION_LABELS: Record<JointLocationId, string> = {{
  medial: 'Medial',
  lateral: 'Lateral',
  anterior: 'Anterior',
  posterior: 'Posterior',
  whole_joint: 'Whole joint',
}}

export const JOINT_LOCATION_OPTIONS: {{ id: JointLocationId; label: string }}[] =
  JOINT_LOCATION_IDS.map((id) => ({{ id, label: JOINT_LOCATION_LABELS[id] }}))

export const AREA_LOCATION_IDS = ['proximal', 'mid', 'distal', 'whole_area'] as const

export type AreaLocationId = (typeof AREA_LOCATION_IDS)[number]

export const AREA_LOCATION_LABELS: Record<AreaLocationId, string> = {{
  proximal: 'Proximal',
  mid: 'Mid',
  distal: 'Distal',
  whole_area: 'Whole area',
}}

export const AREA_LOCATION_OPTIONS: {{ id: AreaLocationId; label: string }}[] =
  AREA_LOCATION_IDS.map((id) => ({{ id, label: AREA_LOCATION_LABELS[id] }}))

export type JointsAreaKind = 'joint' | 'area'

export type JointsAreaZone = {{
  id: string
  label: string
  kind: JointsAreaKind
  view: 'front' | 'back'
  suggestMuscleView?: boolean
}}

function pair(
  view: 'front' | 'back',
  slug: string,
  label: string,
  kind: JointsAreaKind,
  suggestMuscleView = false
): JointsAreaZone[] {{
  return [
    {{
      id: `${{view}}_left_${{slug}}`,
      label: `Left ${{label}}`,
      kind,
      view,
      suggestMuscleView,
    }},
    {{
      id: `${{view}}_right_${{slug}}`,
      label: `Right ${{label}}`,
      kind,
      view,
      suggestMuscleView,
    }},
  ]
}}

export const JOINTS_AREAS_ZONES: JointsAreaZone[] = [
{chr(10).join(map_lines)}
]

export const JOINTS_AREAS_ZONE_IDS = JOINTS_AREAS_ZONES.map((z) => z.id)

const ZONE_BY_ID = new Map(JOINTS_AREAS_ZONES.map((z) => [z.id, z]))

export const JOINTS_AREA_LABELS: Record<string, string> = {{
  ...Object.fromEntries(JOINTS_AREAS_ZONES.map((z) => [z.id, z.label])),
  front_left_abdomen: 'Left Groin',
  front_right_abdomen: 'Right Groin',
}}

export function getJointsAreaZone(areaId: string): JointsAreaZone | undefined {{
  return ZONE_BY_ID.get(areaId) ?? ZONE_BY_ID.get(areaId.replace('abdomen', 'groin'))
}}

export function isJointsAreaId(areaId: string): boolean {{
  return ZONE_BY_ID.has(areaId) || areaId in JOINTS_AREA_LABELS
}}

export function getJointsAreaKind(areaId: string): JointsAreaKind | null {{
  return getJointsAreaZone(areaId)?.kind ?? null
}}

export function shouldSuggestMuscleView(areaId: string): boolean {{
  return Boolean(getJointsAreaZone(areaId)?.suggestMuscleView)
}}

export function isJointLocationId(value: unknown): value is JointLocationId {{
  return typeof value === 'string' && (JOINT_LOCATION_IDS as readonly string[]).includes(value)
}}

export function isAreaLocationId(value: unknown): value is AreaLocationId {{
  return typeof value === 'string' && (AREA_LOCATION_IDS as readonly string[]).includes(value)
}}
"""
    tsx = f"""'use client'

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
      strokeWidth="1.1"
      strokeLinejoin="round"
      strokeLinecap="round"
      paintOrder="fill stroke"
      vectorEffect="non-scaling-stroke"
      onClick={{(e) => onAreaClick(id, e)}}
    />
  )
}}

/** Exact panels from the original joints / areas mannequin, as clean vector paths. */
export default function JointsAreasSvg({{
  view,
  getAreaColor,
  onAreaClick,
  className,
}}: Props) {{
  const z = (id: string, d: string) => (
    <Zone key={{id}} id={{id}} d={{d}} fill={{getAreaColor(id)}} onAreaClick={{onAreaClick}} />
  )

  return (
    <svg
      width="400"
      height="600"
      viewBox={{view === 'front' ? '0 0 208 524' : '0 0 212 524'}}
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
{jsx_for(zones, 'front_')}
        </g>
      ) : (
        <g>
{jsx_for(zones, 'back_')}
        </g>
      )}}
    </svg>
  )
}}
"""
    OUT_MAP.write_text(map_ts)
    OUT_SVG.write_text(tsx)


def main() -> None:
    src = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
    front = extract(src[8:532, 0:208])
    back = extract(src[8:532, 258:470])
    fm, bm = 104.0, 106.0
    zones: list[tuple] = []
    used: set[str] = set()

    print("FRONT")
    for r in front:
        slug = unique_slug(used, "front", "right" if r["cx"] < fm else "left", classify_front(r, fm))
        side = "right" if r["cx"] < fm else "left"
        print(f"  {slug:14} {side:5} cy={r['cy']:.0f} cx={r['cx']:.0f} a={r['area']:.0f}")
        zid = f"front_{side}_{slug}"
        zones.append(
            (
                zid,
                f"{side.title()} {TITLES[slug]}",
                "joint" if slug in JOINTS else "area",
                "front",
                slug in SUGGEST,
                r["d"],
            )
        )

    print("BACK")
    for r in back:
        slug = unique_slug(used, "back", "left" if r["cx"] < bm else "right", classify_back(r, bm))
        side = "left" if r["cx"] < bm else "right"
        print(f"  {slug:14} {side:5} cy={r['cy']:.0f} cx={r['cx']:.0f} a={r['area']:.0f}")
        zid = f"back_{side}_{slug}"
        zones.append(
            (
                zid,
                f"{side.title()} {TITLES[slug]}",
                "joint" if slug in JOINTS else "area",
                "back",
                slug in SUGGEST,
                r["d"],
            )
        )

    catalog = OrderedDict((zid, label) for zid, label, *_rest in zones)
    print("\nCATALOG", len(catalog), "PATHS", len(zones))
    if any("abdomen" in zid for zid, *_ in zones):
        raise SystemExit("abdomen leaked into generated ids")
    write_files(zones)
    print("wrote", OUT_MAP, OUT_SVG)


if __name__ == "__main__":
    main()
