'use client'

import type { MouseEvent } from 'react'

type Props = {
  view: 'front' | 'back'
  getAreaColor: (areaId: string) => string
  onAreaClick: (areaId: string, event: MouseEvent) => void
  className?: string
}

function Zone({
  id,
  d,
  fill,
  onAreaClick,
}: {
  id: string
  d: string
  fill: string
  onAreaClick: (areaId: string, event: MouseEvent) => void
}) {
  return (
    <path
      id={id}
      className="body-area"
      d={d}
      fill={fill}
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinejoin="round"
      strokeLinecap="round"
      onClick={(e) => onAreaClick(id, e)}
    />
  )
}

/** Geometric mannequin matching the joints/areas template.
 *  Front: figure's left is +x (viewer's right). Back: figure's left is −x (viewer's left). */
export default function JointsAreasSvg({
  view,
  getAreaColor,
  onAreaClick,
  className,
}: Props) {
  const z = (id: string, d: string) => (
    <Zone id={id} d={d} fill={getAreaColor(id)} onAreaClick={onAreaClick} />
  )

  return (
    <svg
      width="400"
      height="600"
      viewBox="0 0 280 640"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'max-w-full h-auto'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <style>{`
          .body-area { cursor: pointer; transition: opacity 0.15s; touch-action: manipulation; }
          .body-area:hover { opacity: 0.82; }
          .body-area:active { opacity: 0.95; }
        `}</style>
      </defs>
      {view === 'front' ? (
        <g>
          {z('front_right_head', 'M140 18 C118 18 106 32 106 50 C106 68 118 80 140 80 Z')}
          {z('front_left_head', 'M140 18 C162 18 174 32 174 50 C174 68 162 80 140 80 Z')}
          {z('front_right_neck', 'M140 80 H124 V98 H140 Z')}
          {z('front_left_neck', 'M140 80 H156 V98 H140 Z')}
          {z(
            'front_right_shoulder',
            'M140 98 H88 L56 112 L54 148 H140 Z'
          )}
          {z(
            'front_left_shoulder',
            'M140 98 H192 L224 112 L226 148 H140 Z'
          )}
          {z('front_right_chest', 'M140 148 H54 L58 198 H140 Z')}
          {z('front_left_chest', 'M140 148 H226 L222 198 H140 Z')}
          {z('front_right_abdomen', 'M140 198 H58 L64 248 H140 Z')}
          {z('front_left_abdomen', 'M140 198 H222 L216 248 H140 Z')}
          {z('front_right_hip', 'M140 248 H64 L78 292 H140 Z')}
          {z('front_left_hip', 'M140 248 H216 L202 292 H140 Z')}

          {z('front_right_upper_arm', 'M54 112 L28 124 L32 186 L56 176 Z')}
          {z('front_left_upper_arm', 'M226 112 L252 124 L248 186 L224 176 Z')}
          {z('front_right_elbow', 'M32 186 L56 176 L58 206 L30 214 Z')}
          {z('front_left_elbow', 'M248 186 L224 176 L222 206 L250 214 Z')}
          {z('front_right_forearm', 'M30 214 L58 206 L54 268 L26 274 Z')}
          {z('front_left_forearm', 'M250 214 L222 206 L226 268 L254 274 Z')}
          {z('front_right_wrist', 'M26 274 L54 268 L52 288 L24 292 Z')}
          {z('front_left_wrist', 'M254 274 L226 268 L228 288 L256 292 Z')}
          {z('front_right_hand', 'M24 292 L52 288 L48 332 L18 328 Z')}
          {z('front_left_hand', 'M256 292 L228 288 L232 332 L262 328 Z')}

          {z('front_right_quads', 'M88 292 L78 292 L74 402 H108 L112 292 Z')}
          {z('front_left_quads', 'M192 292 L202 292 L206 402 H172 L168 292 Z')}
          {z('front_right_adductors', 'M140 292 H112 L108 402 H140 Z')}
          {z('front_left_adductors', 'M140 292 H168 L172 402 H140 Z')}
          {z('front_right_knee', 'M74 402 H140 V436 H76 Z')}
          {z('front_left_knee', 'M140 402 H206 V436 H140 Z')}
          {z('front_right_shin', 'M76 436 H140 L136 520 H82 Z')}
          {z('front_left_shin', 'M140 436 H204 L198 520 H144 Z')}
          {z('front_right_ankle', 'M82 520 H136 L134 544 H84 Z')}
          {z('front_left_ankle', 'M144 520 H198 L196 544 H146 Z')}
          {z('front_right_foot', 'M84 544 H134 L148 598 H62 Z')}
          {z('front_left_foot', 'M146 544 H196 L218 598 H132 Z')}
        </g>
      ) : (
        <g>
          {z('back_left_head', 'M140 18 C118 18 106 32 106 50 C106 68 118 80 140 80 Z')}
          {z('back_right_head', 'M140 18 C162 18 174 32 174 50 C174 68 162 80 140 80 Z')}
          {z('back_left_neck', 'M140 80 H124 V98 H140 Z')}
          {z('back_right_neck', 'M140 80 H156 V98 H140 Z')}
          {z(
            'back_left_shoulder',
            'M140 98 H88 L56 112 L54 148 H140 Z'
          )}
          {z(
            'back_right_shoulder',
            'M140 98 H192 L224 112 L226 148 H140 Z'
          )}
          {z('back_left_upper_back', 'M140 148 H54 L58 198 H140 Z')}
          {z('back_right_upper_back', 'M140 148 H226 L222 198 H140 Z')}
          {z('back_left_mid_back', 'M140 198 H58 L64 248 H140 Z')}
          {z('back_right_mid_back', 'M140 198 H222 L216 248 H140 Z')}
          {z('back_left_lower_back', 'M140 248 H64 L72 276 H140 Z')}
          {z('back_right_lower_back', 'M140 248 H216 L208 276 H140 Z')}
          {z('back_left_glutes', 'M140 276 H90 L90 318 H140 Z')}
          {z('back_right_glutes', 'M140 276 H190 L190 318 H140 Z')}
          {z('back_left_hip', 'M90 276 H72 L74 318 H90 Z')}
          {z('back_right_hip', 'M190 276 H208 L206 318 H190 Z')}

          {z('back_left_upper_arm', 'M54 112 L28 124 L32 186 L56 176 Z')}
          {z('back_right_upper_arm', 'M226 112 L252 124 L248 186 L224 176 Z')}
          {z('back_right_elbow', 'M248 186 L224 176 L222 206 L250 214 Z')}
          {z('back_left_elbow', 'M32 186 L56 176 L58 206 L30 214 Z')}
          {z('back_left_forearm', 'M30 214 L58 206 L54 268 L26 274 Z')}
          {z('back_right_forearm', 'M250 214 L222 206 L226 268 L254 274 Z')}
          {z('back_left_wrist', 'M26 274 L54 268 L52 288 L24 292 Z')}
          {z('back_right_wrist', 'M254 274 L226 268 L228 288 L256 292 Z')}
          {z('back_left_hand', 'M24 292 L52 288 L48 332 L18 328 Z')}
          {z('back_right_hand', 'M256 292 L228 288 L232 332 L262 328 Z')}

          {z('back_left_hamstrings', 'M88 318 L74 318 L74 402 H108 L112 318 Z')}
          {z('back_right_hamstrings', 'M192 318 L206 318 L206 402 H172 L168 318 Z')}
          {z('back_left_adductors', 'M140 318 H112 L108 402 H140 Z')}
          {z('back_right_adductors', 'M140 318 H168 L172 402 H140 Z')}
          {z('back_left_knee', 'M74 402 H140 V436 H76 Z')}
          {z('back_right_knee', 'M140 402 H206 V436 H140 Z')}
          {z('back_left_calves', 'M76 436 H140 L136 520 H82 Z')}
          {z('back_right_calves', 'M140 436 H204 L198 520 H144 Z')}
          {z('back_left_ankle', 'M82 520 H136 L134 544 H84 Z')}
          {z('back_right_ankle', 'M144 520 H198 L196 544 H146 Z')}
          {z('back_left_heel', 'M84 544 H134 L140 598 H70 Z')}
          {z('back_right_heel', 'M146 544 H196 L210 598 H140 Z')}
        </g>
      )}
    </svg>
  )
}
