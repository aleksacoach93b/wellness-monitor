#!/usr/bin/env python3
"""Split the original joints artwork into Front / Back vector panels.

Does not invent zones or names. Each closed black panel between the white
grid lines becomes one SVG path, labeled with the original catalog names.
"""

from __future__ import annotations

from collections import OrderedDict
from pathlib import Path

import cv2
import numpy as np

SRC = Path(
    "/Users/aleksaboskovic/.cursor/projects/Users-aleksaboskovic-wellness-app/assets/"
    "Joints_and_Body_Area_visuals_new-b1e2959d-e24e-42b5-82a6-0e19745ea16b.png"
)
ROOT = Path("/Users/aleksaboskovic/wellness-app/wellness-monitor")
OUT_MAP = ROOT / "src/lib/jointsAreasMap.ts"
OUT_SVG = ROOT / "src/components/JointsAreasSvg.tsx"
EDIT_DIR = ROOT / "joints-to-edit"
PREVIEW = ROOT / "scripts/joints-trace-preview.png"

FRONT_BOX = (7, 18, 251, 663)  # x0,y0,x1,y1
BACK_BOX = (334, 18, 577, 663)

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

FRONT_ORDER = [
    "head",
    "neck",
    "upper_chest",
    "upper_arm",
    "shoulder",
    "chest",
    "elbow",
    "lower_arm",
    "forearm",
    "groin",
    "hip",
    "wrist",
    "hand",
    "quads",
    "adductors",
    "knee",
    "shin",
    "ankle",
    "foot",
]
BACK_ORDER = [
    "head",
    "neck",
    "shoulder",
    "upper_arm",
    "upper_back",
    "elbow",
    "lower_back",
    "lower_arm",
    "forearm",
    "glutes",
    "wrist",
    "hand",
    "hamstrings",
    "adductors",
    "knee",
    "calves",
    "ankle",
    "heel",
]


def extract(gray: np.ndarray) -> list[dict]:
    h, w = gray.shape
    big = cv2.resize(gray, (w * SCALE, h * SCALE), interpolation=cv2.INTER_NEAREST)
    body = big < 240
    lines = (big > 140) & (big < 252) & body
    walls = cv2.dilate(lines.astype(np.uint8) * 255, np.ones((3, 3), np.uint8), 1)
    mid = (w * SCALE) // 2
    walls[:, mid - 2 : mid + 3] = 255
    ink = np.where(body, 255, 0).astype(np.uint8)
    ink[walls > 0] = 0
    n, labels, stats, cents = cv2.connectedComponentsWithStats(ink, 4)
    regs: list[dict] = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA]) / (SCALE * SCALE)
        if area < 25:
            continue
        mask = (labels == i).astype(np.uint8)
        cnts, _ = cv2.findContours(mask * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cnts:
            continue
        cnt = max(cnts, key=cv2.contourArea)
        d = clean_path(cnt)
        if not d:
            continue
        regs.append(
            {
                "area": area,
                "cx": float(cents[i][0]) / SCALE,
                "cy": float(cents[i][1]) / SCALE,
                "w": int(stats[i, cv2.CC_STAT_WIDTH]) / SCALE,
                "h": int(stats[i, cv2.CC_STAT_HEIGHT]) / SCALE,
                "d": d,
                "cnt": cnt,
            }
        )
    regs.sort(key=lambda r: (r["cy"], r["cx"]))
    return regs


def snap_hv(pts: np.ndarray) -> np.ndarray:
    out = [pts[0].copy()]
    for p in pts[1:]:
        prev = out[-1]
        dx, dy = p[0] - prev[0], p[1] - prev[1]
        if abs(dx) < 1.2 and abs(dy) < 1.2:
            continue
        if abs(dy) <= abs(dx) * 0.08:
            p = np.array([p[0], prev[1]])
        elif abs(dx) <= abs(dy) * 0.08:
            p = np.array([prev[0], p[1]])
        if np.linalg.norm(p - prev) >= 1.6:
            out.append(p)
    if len(out) >= 3:
        first, last = out[0], out[-1]
        dx, dy = last[0] - first[0], last[1] - first[1]
        if abs(dy) <= abs(dx) * 0.08:
            out[-1][1] = first[1]
        elif abs(dx) <= abs(dy) * 0.08:
            out[-1][0] = first[0]
    return np.array(out)


def remove_collinear(pts: np.ndarray) -> np.ndarray:
    if len(pts) < 4:
        return pts
    keep = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = keep[-1], pts[i], pts[i + 1]
        ab = b - a
        bc = c - b
        cross = abs(ab[0] * bc[1] - ab[1] * bc[0])
        if cross > 2.2:
            keep.append(b)
    keep.append(pts[-1])
    return np.array(keep)


def clean_path(cnt: np.ndarray) -> str:
    peri = cv2.arcLength(cnt, True)
    M = cv2.moments(cnt)
    cy = (M["m01"] / M["m00"] / SCALE) if M["m00"] else 0
    # Collapse PNG stair-steps; keep head/hand silhouette denser.
    if cy < 80 or cy > 340:
        eps = max(SCALE * 0.85, peri * 0.0020)
    else:
        eps = max(SCALE * 1.15, peri * 0.0026)
    approx = cv2.approxPolyDP(cnt, eps, True)
    pts = approx.reshape(-1, 2).astype(np.float64)
    pts = snap_hv(pts)
    pts = remove_collinear(pts)
    if len(pts) < 3:
        return ""
    scaled = [(round(float(p[0]) / SCALE, 1), round(float(p[1]) / SCALE, 1)) for p in pts]
    dedup = [scaled[0]]
    for p in scaled[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if len(dedup) >= 2 and dedup[0] == dedup[-1]:
        dedup = dedup[:-1]
    if len(dedup) < 3:
        return ""
    return "M" + "L".join(f"{x},{y}" for x, y in dedup) + "Z"


def classify_front(r: dict, mid: float) -> str:
    cy, cx, area, h = r["cy"], r["cx"], r["area"], r["h"]
    far = abs(cx - mid) > 70
    if cy < 70:
        return "head"
    if cy < 100:
        return "neck"
    if cy < 120 and h < 22:
        return "upper_chest"
    if far:
        if cy < 180:
            return "upper_arm"
        if cy < 225:
            return "elbow"
        if cy < 265:
            return "lower_arm"
        if cy < 320:
            return "forearm"
        if h < 20 or area < 300:
            return "wrist"
        return "hand"
    if cy < 185:
        return "shoulder"
    if cy < 285:
        return "chest"
    if cy < 350 and area > 1200:
        return "groin"
    if cy < 360 and abs(cx - mid) > 35:
        return "hip"
    if cy < 400 and abs(cx - mid) < 30:
        return "adductors"
    if cy < 460:
        return "quads"
    if cy < 520:
        return "knee"
    if cy < 600:
        return "shin"
    if h < 16 and cy < 630:
        return "ankle"
    return "foot"


def classify_back(r: dict, mid: float) -> str:
    cy, cx, area, h = r["cy"], r["cx"], r["area"], r["h"]
    far = abs(cx - mid) > 70
    if cy < 65:
        return "head"
    if cy < 98:
        return "neck"
    if cy < 125 and h < 26:
        return "shoulder"
    if far:
        if cy < 185:
            return "upper_arm"
        if cy < 225:
            return "elbow"
        if cy < 265:
            return "lower_arm"
        if cy < 320:
            return "forearm"
        if h < 20 or area < 300:
            return "wrist"
        return "hand"
    if cy < 220:
        return "upper_back"
    if cy < 300:
        return "lower_back"
    if cy < 355:
        return "glutes"
    if cy < 400 and abs(cx - mid) < 30:
        return "adductors"
    if cy < 450:
        return "hamstrings"
    if cy < 505:
        return "knee"
    if cy < 570:
        return "calves"
    if cy < 615:
        return "ankle"
    return "heel"


def jsx_for(zones: list[tuple[str, str]], prefix: str) -> str:
    lines = []
    used: dict[str, int] = {}
    for zid, d in zones:
        if not zid.startswith(prefix):
            continue
        n = used.get(zid, 0)
        used[zid] = n + 1
        key = zid if n == 0 else f"{zid}__{n + 1}"
        lines.append(f"          {{z('{zid}', '{d}', '{key}')}}")
    return "\n".join(lines)


def svg_paths(zones: list[tuple[str, str]], prefix: str) -> str:
    used: dict[str, int] = {}
    parts = []
    for zid, d in zones:
        if not zid.startswith(prefix):
            continue
        n = used.get(zid, 0)
        used[zid] = n + 1
        pid = zid if n == 0 else f"{zid}__{n + 1}"
        parts.append(
            f'  <path id="{pid}" class="body-area" d="{d}" fill="#d1d5db" '
            f'stroke="#374151" stroke-width="1.1" stroke-linejoin="round" '
            f'stroke-linecap="round"/>'
        )
    return "\n".join(parts)


def write_edit_svg(path: Path, view_box: str, body: str, note: str) -> None:
    path.write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" width="800" height="1200">
  <!-- {note} Keep every path id. Edit shapes only. -->
{body}
</svg>
"""
    )


def write_files(front_w: int, front_h: int, back_w: int, back_h: int, zones: list[tuple[str, str]]) -> None:
    map_lines = []
    for slug in FRONT_ORDER:
        sug = ", true" if slug in SUGGEST else ""
        kind = "joint" if slug in JOINTS else "area"
        map_lines.append(f"  ...pair('front', '{slug}', '{TITLES[slug]}', '{kind}'{sug}),")
    for slug in BACK_ORDER:
        sug = ", true" if slug in SUGGEST else ""
        kind = "joint" if slug in JOINTS else "area"
        map_lines.append(f"  ...pair('back', '{slug}', '{TITLES[slug]}', '{kind}'{sug}),")

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

/** Exact closed panels from the original joints / areas mannequin. */
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
      viewBox={{view === 'front' ? '0 0 {front_w} {front_h}' : '0 0 {back_w} {back_h}'}}
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

    EDIT_DIR.mkdir(exist_ok=True)
    write_edit_svg(
        EDIT_DIR / "front.svg",
        f"0 0 {front_w} {front_h}",
        svg_paths(zones, "front_"),
        "FRONT. Original closed panels.",
    )
    write_edit_svg(
        EDIT_DIR / "back.svg",
        f"0 0 {back_w} {back_h}",
        svg_paths(zones, "back_"),
        "BACK. Original closed panels.",
    )
    gap = 40
    back_shift = front_w + gap
    combined_paths = svg_paths(zones, "front_") + f'\n  <g transform="translate({back_shift},0)">\n'
    combined_paths += "\n".join("  " + line for line in svg_paths(zones, "back_").splitlines())
    combined_paths += "\n  </g>"
    write_edit_svg(
        EDIT_DIR / "front-and-back.svg",
        f"0 0 {front_w + gap + back_w} {max(front_h, back_h)}",
        combined_paths,
        "FRONT (left) + BACK (right). Original closed panels.",
    )


def main() -> None:
    src = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
    if src is None:
        raise SystemExit(f"missing source {SRC}")
    fx0, fy0, fx1, fy1 = FRONT_BOX
    bx0, by0, bx1, by1 = BACK_BOX
    front = src[fy0:fy1, fx0:fx1]
    back = src[by0:by1, bx0:bx1]
    fh, fw = front.shape
    bh, bw = back.shape
    front_regs = extract(front)
    back_regs = extract(back)

    zones: list[tuple[str, str]] = []
    used: set[str] = set()

    print(f"FRONT {len(front_regs)}  {fw}x{fh}")
    fm = fw / 2
    for r in front_regs:
        side = "right" if r["cx"] < fm else "left"
        slug = classify_front(r, fm)
        zid = f"front_{side}_{slug}"
        print(
            f"  {zid:28} cy={r['cy']:6.1f} cx={r['cx']:6.1f} "
            f"a={r['area']:6.0f} {r['w']:.0f}x{r['h']:.0f}"
        )
        if zid in used:
            raise SystemExit(f"duplicate id {zid}")
        if slug not in TITLES:
            raise SystemExit(f"unknown slug {slug}")
        used.add(zid)
        zones.append((zid, r["d"]))

    print(f"BACK {len(back_regs)}  {bw}x{bh}")
    bm = bw / 2
    for r in back_regs:
        side = "left" if r["cx"] < bm else "right"
        slug = classify_back(r, bm)
        zid = f"back_{side}_{slug}"
        print(
            f"  {zid:28} cy={r['cy']:6.1f} cx={r['cx']:6.1f} "
            f"a={r['area']:6.0f} {r['w']:.0f}x{r['h']:.0f}"
        )
        if zid in used:
            raise SystemExit(f"duplicate id {zid}")
        if slug not in TITLES:
            raise SystemExit(f"unknown slug {slug}")
        used.add(zid)
        zones.append((zid, r["d"]))

    expected = {f"front_{s}_{slug}" for slug in FRONT_ORDER for s in ("left", "right")}
    expected |= {f"back_{s}_{slug}" for slug in BACK_ORDER for s in ("left", "right")}
    missing = sorted(expected - used)
    extra = sorted(used - expected)
    if missing or extra:
        raise SystemExit(f"catalog mismatch missing={missing} extra={extra}")
    if any("abdomen" in zid for zid, _ in zones):
        raise SystemExit("abdomen leaked into generated ids")

    write_files(fw, fh, bw, bh, zones)

    preview = np.full((max(fh, bh), fw + 40 + bw, 3), 255, np.uint8)
    rng = np.random.default_rng(3)

    def paint(regs: list[dict], xoff: int, gray: np.ndarray) -> None:
        h, w = gray.shape
        big = cv2.resize(gray, (w * SCALE, h * SCALE), interpolation=cv2.INTER_NEAREST)
        body = big < 240
        lines = (big > 140) & (big < 252) & body
        walls = cv2.dilate(lines.astype(np.uint8) * 255, np.ones((3, 3), np.uint8), 1)
        mid = (w * SCALE) // 2
        walls[:, mid - 2 : mid + 3] = 255
        ink = np.where(body, 255, 0).astype(np.uint8)
        ink[walls > 0] = 0
        n, labels, *_ = cv2.connectedComponentsWithStats(ink, 4)
        keep = []
        for i in range(1, n):
            area = int(cv2.connectedComponentsWithStats(ink, 4)[2][i, cv2.CC_STAT_AREA]) / (
                SCALE * SCALE
            ) if False else None
            _ = area
        n, labels, stats, _c = cv2.connectedComponentsWithStats(ink, 4)
        color_img = np.full((h, w, 3), 255, np.uint8)
        idx = 0
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA]) / (SCALE * SCALE)
            if area < 25:
                continue
            col = tuple(int(x) for x in rng.integers(40, 230, 3))
            small = cv2.resize(
                (labels == i).astype(np.uint8) * 255,
                (w, h),
                interpolation=cv2.INTER_NEAREST,
            )
            color_img[small > 0] = col
            idx += 1
        preview[0:h, xoff : xoff + w] = color_img

    paint(front_regs, 0, front)
    paint(back_regs, fw + 40, back)
    cv2.imwrite(str(PREVIEW), preview)

    print("wrote", OUT_MAP)
    print("wrote", OUT_SVG)
    print("wrote", EDIT_DIR / "front.svg")
    print("wrote", EDIT_DIR / "back.svg")
    print("paths", len(zones), "catalog", len(expected))


if __name__ == "__main__":
    main()
