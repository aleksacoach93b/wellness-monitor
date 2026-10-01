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
  const selected = fill !== 'transparent' && fill !== ''
  return (
    <path
      id={id}
      className="body-area"
      d={d}
      fill={selected ? fill : '#d1d5db'}
      stroke="#374151"
      strokeWidth="1.05"
      strokeLinejoin="round"
      strokeLinecap="round"
      paintOrder="fill stroke"
      vectorEffect="non-scaling-stroke"
      onClick={(e) => onAreaClick(id, e)}
    />
  )
}

/** Original joints mannequin, rebuilt as a clean symmetric vector. */
export default function JointsAreasSvg({
  view,
  getAreaColor,
  onAreaClick,
  className,
}: Props) {
  const z = (id: string, d: string, key: string) => (
    <Zone key={key} id={id} d={d} fill={getAreaColor(id)} onAreaClick={onAreaClick} />
  )

  return (
    <svg
      width="400"
      height="600"
      viewBox={view === 'front' ? '0 0 206 524' : '0 0 212 524'}
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'max-w-full h-auto'}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <style>{`
          .body-area { cursor: pointer; touch-action: manipulation; }
          .body-area:hover { filter: brightness(0.92); }
        `}</style>
      </defs>
      {view === 'front' ? (
        <g>
          {z('front_right_head', 'M102.2,8L95.0,8.2L87.0,10L82.0,14L79.0,20L78.0,28L78.0,42L79.0,54L82.0,64L87.0,71L90.0,74L102.2,74Z', 'front_right_head')}
          {z('front_left_head', 'M103.8,8L111.0,8.2L119.0,10L124.0,14L127.0,20L128.0,28L128.0,42L127.0,54L124.0,64L119.0,71L116.0,74L103.8,74Z', 'front_left_head')}
          {z('front_right_neck', 'M102.2,74L90.0,74L81.0,84L53.0,96L102.2,108Z', 'front_right_neck')}
          {z('front_left_neck', 'M103.8,74L116.0,74L125.0,84L153.0,96L103.8,108Z', 'front_left_neck')}
          {z('front_right_shoulder', 'M102.2,108L53.0,96L51.0,96L53.0,148L94.0,148L102.2,136Z', 'front_right_shoulder')}
          {z('front_left_shoulder', 'M103.8,108L153.0,96L155.0,96L153.0,148L112.0,148L103.8,136Z', 'front_left_shoulder')}
          {z('front_right_upper_arm', 'M51.0,96L45.0,99L35.0,108L29.0,122L26.0,136L25.0,148L51.0,148Z', 'front_right_upper_arm')}
          {z('front_left_upper_arm', 'M155.0,96L161.0,99L171.0,108L177.0,122L180.0,136L181.0,148L155.0,148Z', 'front_left_upper_arm')}
          {z('front_right_chest', 'M102.2,136L94.0,148L54.0,148L56.0,186L61.0,236L102.2,250Z', 'front_right_chest')}
          {z('front_left_chest', 'M103.8,136L112.0,148L152.0,148L150.0,186L145.0,236L103.8,250Z', 'front_left_chest')}
          {z('front_right_groin', 'M102.2,250L61.0,236L75.0,262L81.0,289L102.2,289Z', 'front_right_groin')}
          {z('front_left_groin', 'M103.8,250L145.0,236L131.0,262L125.0,289L103.8,289Z', 'front_left_groin')}
          {z('front_right_hip', 'M61.0,236L54.0,255L54.0,289L81.0,289L75.0,262Z', 'front_right_hip')}
          {z('front_left_hip', 'M145.0,236L152.0,255L152.0,289L125.0,289L131.0,262Z', 'front_left_hip')}
          {z('front_right_elbow', 'M51.0,148L24.0,148L20.0,186L56.0,186Z', 'front_right_elbow')}
          {z('front_left_elbow', 'M155.0,148L182.0,148L186.0,186L150.0,186Z', 'front_left_elbow')}
          {z('front_right_elbow', 'M56.0,186L20.0,186L15.0,209L61.0,209Z', 'front_right_elbow__2')}
          {z('front_left_elbow', 'M150.0,186L186.0,186L191.0,209L145.0,209Z', 'front_left_elbow__2')}
          {z('front_right_forearm', 'M61.0,209L15.0,209L10.0,268L26.0,268Z', 'front_right_forearm')}
          {z('front_left_forearm', 'M145.0,209L191.0,209L196.0,268L180.0,268Z', 'front_left_forearm')}
          {z('front_right_wrist', 'M26.0,268L10.0,268L6.0,289L20.0,289Z', 'front_right_wrist')}
          {z('front_left_wrist', 'M180.0,268L196.0,268L200.0,289L186.0,289Z', 'front_left_wrist')}
          {z('front_right_hand', 'M21.0,289L7.0,289L5.0,295L4.0,305L5.0,315L9.0,321L15.0,323L21.0,321L24.0,313L23.0,303L22.0,295Z', 'front_right_hand')}
          {z('front_left_hand', 'M185.0,289L199.0,289L201.0,295L202.0,305L201.0,315L197.0,321L191.0,323L185.0,321L182.0,313L183.0,303L184.0,295Z', 'front_left_hand')}
          {z('front_right_adductors', 'M102.2,289L85.0,289L92.0,330L102.2,310Z', 'front_right_adductors')}
          {z('front_left_adductors', 'M103.8,289L121.0,289L114.0,330L103.8,310Z', 'front_left_adductors')}
          {z('front_right_quads', 'M85.0,289L54.0,289L53.0,340L56.0,382L88.0,382L92.0,330Z', 'front_right_quads')}
          {z('front_left_quads', 'M121.0,289L152.0,289L153.0,340L150.0,382L118.0,382L114.0,330Z', 'front_left_quads')}
          {z('front_right_knee', 'M88.0,382L56.0,382L52.0,414L83.0,414Z', 'front_right_knee')}
          {z('front_left_knee', 'M118.0,382L150.0,382L154.0,414L123.0,414Z', 'front_left_knee')}
          {z('front_right_shin', 'M83.0,414L52.0,414L53.0,450L65.0,497L84.0,497Z', 'front_right_shin')}
          {z('front_left_shin', 'M123.0,414L154.0,414L153.0,450L141.0,497L122.0,497Z', 'front_left_shin')}
          {z('front_right_ankle', 'M84.0,497L65.0,497L58.0,510L87.0,510Z', 'front_right_ankle')}
          {z('front_left_ankle', 'M122.0,497L141.0,497L148.0,510L119.0,510Z', 'front_left_ankle')}
          {z('front_right_foot', 'M87.0,510L58.0,510L51.0,521L91.0,521Z', 'front_right_foot')}
          {z('front_left_foot', 'M119.0,510L148.0,510L155.0,521L115.0,521Z', 'front_left_foot')}
        </g>
      ) : (
        <g>
          {z('back_right_head', 'M105.2,8L100.0,8.5L94.0,11L88.0,16L84.0,24L81.5,36L82.0,48L86.0,60L91.0,67L105.2,67Z', 'back_right_head')}
          {z('back_left_head', 'M106.8,8L112.0,8.5L118.0,11L124.0,16L128.0,24L130.5,36L130.0,48L126.0,60L121.0,67L106.8,67Z', 'back_left_head')}
          {z('back_right_neck', 'M105.2,67L91.0,67L84.0,83L105.2,83Z', 'back_right_neck')}
          {z('back_left_neck', 'M106.8,67L121.0,67L128.0,83L106.8,83Z', 'back_left_neck')}
          {z('back_right_shoulder', 'M105.2,83L84.0,83L66.0,102L105.2,102Z', 'back_right_shoulder')}
          {z('back_left_shoulder', 'M106.8,83L128.0,83L146.0,102L106.8,102Z', 'back_left_shoulder')}
          {z('back_right_upper_arm', 'M66.0,102L44.0,102L34.0,118L29.0,154L55.0,154Z', 'back_right_upper_arm')}
          {z('back_left_upper_arm', 'M146.0,102L168.0,102L178.0,118L183.0,154L157.0,154Z', 'back_left_upper_arm')}
          {z('back_right_upper_back', 'M105.2,102L66.0,102L55.0,154L62.0,192L105.2,178Z', 'back_right_upper_back')}
          {z('back_left_upper_back', 'M106.8,102L146.0,102L157.0,154L150.0,192L106.8,178Z', 'back_left_upper_back')}
          {z('back_right_lower_back', 'M105.2,178L61.0,192L64.0,244L105.2,250Z', 'back_right_lower_back')}
          {z('back_left_lower_back', 'M106.8,178L151.0,192L148.0,244L106.8,250Z', 'back_left_lower_back')}
          {z('back_right_elbow', 'M55.0,154L28.0,154L23.0,187L58.0,187Z', 'back_right_elbow')}
          {z('back_left_elbow', 'M157.0,154L184.0,154L189.0,187L154.0,187Z', 'back_left_elbow')}
          {z('back_right_elbow', 'M58.0,187L23.0,187L18.0,209L63.0,209Z', 'back_right_elbow__2')}
          {z('back_left_elbow', 'M154.0,187L189.0,187L194.0,209L149.0,209Z', 'back_left_elbow__2')}
          {z('back_right_forearm', 'M63.0,209L18.0,209L13.0,268L28.0,268Z', 'back_right_forearm')}
          {z('back_left_forearm', 'M149.0,209L194.0,209L199.0,268L184.0,268Z', 'back_left_forearm')}
          {z('back_right_wrist', 'M28.0,268L13.0,268L9.0,291L23.0,291Z', 'back_right_wrist')}
          {z('back_left_wrist', 'M184.0,268L199.0,268L203.0,291L189.0,291Z', 'back_left_wrist')}
          {z('back_right_glutes', 'M105.2,250L64.0,244L60.0,260L57.0,275L57.0,291L105.2,291Z', 'back_right_glutes')}
          {z('back_left_glutes', 'M106.8,250L148.0,244L152.0,260L155.0,275L155.0,291L106.8,291Z', 'back_left_glutes')}
          {z('back_right_hand', 'M24.0,291L10.0,291L8.0,297L7.0,307L8.0,317L12.0,323L18.0,325L24.0,323L27.0,315L26.0,305L25.0,297Z', 'back_right_hand')}
          {z('back_left_hand', 'M188.0,291L202.0,291L204.0,297L205.0,307L204.0,317L200.0,323L194.0,325L188.0,323L185.0,315L186.0,305L187.0,297Z', 'back_left_hand')}
          {z('back_right_adductors', 'M105.2,291L90.0,291L96.0,330L105.2,312Z', 'back_right_adductors')}
          {z('back_left_adductors', 'M106.8,291L122.0,291L116.0,330L106.8,312Z', 'back_left_adductors')}
          {z('back_right_hamstrings', 'M90.0,291L57.0,291L56.0,340L59.0,373L92.0,373L96.0,330Z', 'back_right_hamstrings')}
          {z('back_left_hamstrings', 'M122.0,291L155.0,291L156.0,340L153.0,373L120.0,373L116.0,330Z', 'back_left_hamstrings')}
          {z('back_right_knee', 'M92.0,373L59.0,373L60.0,406L89.0,406Z', 'back_right_knee')}
          {z('back_left_knee', 'M120.0,373L153.0,373L152.0,406L123.0,406Z', 'back_left_knee')}
          {z('back_right_calves', 'M89.0,406L60.0,406L58.0,430L67.0,458L90.0,458Z', 'back_right_calves')}
          {z('back_left_calves', 'M123.0,406L152.0,406L154.0,430L145.0,458L122.0,458Z', 'back_left_calves')}
          {z('back_right_ankle', 'M90.0,458L67.0,458L66.0,503L89.0,503Z', 'back_right_ankle')}
          {z('back_left_ankle', 'M122.0,458L145.0,458L146.0,503L123.0,503Z', 'back_left_ankle')}
          {z('back_right_heel', 'M89.0,503L66.0,503L64.0,520L90.0,520Z', 'back_right_heel')}
          {z('back_left_heel', 'M123.0,503L146.0,503L148.0,520L122.0,520Z', 'back_left_heel')}
        </g>
      )}
    </svg>
  )
}
