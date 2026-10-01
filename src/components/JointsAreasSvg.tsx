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
      fill={selected ? fill : '#d4d4d4'}
      stroke="#111827"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      paintOrder="fill stroke"
      vectorEffect="non-scaling-stroke"
      onClick={(e) => onAreaClick(id, e)}
    />
  )
}

/** Exact closed panels from the original joints / areas mannequin. */
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
      viewBox={view === 'front' ? '0 0 243 645' : '0 0 243 645'}
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
          {z('front_right_head', 'M119.5 3 L108 3 C103 4 99 8 96 12 C92 17 90 23 90 31 L90 53 C90 58 93 61 94 66 C96 73 100 78 105 81 L119.5 87 Z', 'front_right_head')}
          {z('front_left_head', 'M 123.5 3 L 135 3 C 140 4 144 8 147 12 C 151 17 153 23 153 31 L 153 53 C 153 58 150 61 149 66 C 147 73 143 78 138 81 L 123.5 87 Z', 'front_left_head')}
          {z('front_right_neck', 'M101 83 L119.5 91 L119.5 105 L101 93 Z', 'front_right_neck')}
          {z('front_left_neck', 'M 142 83 L 123.5 91 L 123.5 105 L 142 93 Z', 'front_left_neck')}
          {z('front_right_upper_chest', 'M98 97 L102 97 C108 101 113 106 119.5 109.5 L64 109.5 C75 105 87 100 98 97 Z', 'front_right_upper_chest')}
          {z('front_left_upper_chest', 'M 145 97 L 141 97 C 135 101 130 106 123.5 109.5 L 179 109.5 C 168 105 156 100 145 97 Z', 'front_left_upper_chest')}
          {z('front_right_shoulder', 'M57 113.5 L119.5 113.5 L119.5 162.5 L108 176 L57 176 Z', 'front_right_shoulder')}
          {z('front_left_shoulder', 'M 186 113.5 L 123.5 113.5 L 123.5 162.5 L 135 176 L 186 176 Z', 'front_left_shoulder')}
          {z('front_right_upper_arm', 'M52 114 C43 116 35 121 30 128 C26 138 24 149 24 159 C24 170 26 179 28 185 L52 173 Z', 'front_right_upper_arm')}
          {z('front_left_upper_arm', 'M 191 114 C 200 116 208 121 213 128 C 217 138 219 149 219 159 C 219 170 217 179 215 185 L 191 173 Z', 'front_left_upper_arm')}
          {z('front_right_elbow', 'M52 178 L28 189 C25 197 24 208 23 218 L24 222 L55 227 C58 220 59 213 58 206 Z', 'front_right_elbow')}
          {z('front_left_elbow', 'M 191 178 L 215 189 C 218 197 219 208 220 218 L 219 222 L 188 227 C 185 220 184 213 185 206 Z', 'front_left_elbow')}
          {z('front_right_chest', 'M56.5 180 L107 180 L119.5 170.5 L119.5 300 L67 281 C68 261 67 241 64 225 C62 211 58 194 56.5 180 Z', 'front_right_chest')}
          {z('front_left_chest', 'M 186.5 180 L 136 180 L 123.5 170.5 L 123.5 300 L 176 281 C 175 261 176 241 179 225 C 181 211 185 194 186.5 180 Z', 'front_left_chest')}
          {z('front_right_lower_arm', 'M20 226 L52 232 L47 253.5 L14 248.5 Z', 'front_right_lower_arm')}
          {z('front_left_lower_arm', 'M 223 226 L 191 232 L 196 253.5 L 229 248.5 Z', 'front_left_lower_arm')}
          {z('front_right_forearm', 'M13.5 254 L44 258 C43 272 41 285 36 298 L25 325 L8 325 L8 286 C8 274 10 263 13.5 254 Z', 'front_right_forearm')}
          {z('front_left_forearm', 'M 229.5 254 L 199 258 C 200 272 202 285 207 298 L 218 325 L 235 325 L 235 286 C 235 274 233 263 229.5 254 Z', 'front_left_forearm')}
          {z('front_right_groin', 'M69 286 L119.5 304.5 L119.5 353 L94 353 L82 322 C77 316 72 312 68 308 Z', 'front_right_groin')}
          {z('front_left_groin', 'M 174 286 L 123.5 304.5 L 123.5 353 L 149 353 L 161 322 C 166 316 171 312 175 308 Z', 'front_left_groin')}
          {z('front_right_wrist', 'M5 330 L23 330 L22 341 L4 341 Z', 'front_right_wrist')}
          {z('front_left_wrist', 'M 238 330 L 220 330 L 221 341 L 239 341 Z', 'front_left_wrist')}
          {z('front_right_hip', 'M67 314 C64 326 63 340 62 353 L88 353 L78 325 Z', 'front_right_hip')}
          {z('front_left_hip', 'M 176 314 C 179 326 180 340 181 353 L 155 353 L 165 325 Z', 'front_left_hip')}
          {z('front_right_hand', 'M4 345 L23 345 C25 352 27 362 27 372 L27 385 C26 389 23 389 21 385 L15 373 C14 370 13 371 13 375 L14 382 C16 386 21 390 24 393 C27 396 26 399 22 398 L15 395 C8 393 4 387 3 380 C1 370 2 356 4 345 Z', 'front_right_hand')}
          {z('front_left_hand', 'M 239 345 L 220 345 C 218 352 216 362 216 372 L 216 385 C 217 389 220 389 222 385 L 228 373 C 229 370 230 371 230 375 L 229 382 C 227 386 222 390 219 393 C 216 396 217 399 221 398 L 228 395 C 235 393 239 387 240 380 C 242 370 241 356 239 345 Z', 'front_left_hand')}
          {z('front_right_adductors', 'M95 356 L119.5 356 L114 409 C111 410 109 406 107 401 Z', 'front_right_adductors')}
          {z('front_left_adductors', 'M 148 356 L 123.5 356 L 129 409 C 132 410 134 406 136 401 Z', 'front_left_adductors')}
          {z('front_right_quads', 'M62 356 L91 356 C97 376 104 398 108 418 C109 434 107 452 106 469 L60 469 C59 442 59 415 61 392 Z', 'front_right_quads')}
          {z('front_left_quads', 'M 181 356 L 152 356 C 146 376 139 398 135 418 C 134 434 136 452 137 469 L 183 469 C 184 442 184 415 182 392 Z', 'front_left_quads')}
          {z('front_right_knee', 'M65 473 L104 473 C101 484 98 495 96 505 L61 505 C62 494 63 483 65 473 Z', 'front_right_knee')}
          {z('front_left_knee', 'M 178 473 L 139 473 C 142 484 145 495 147 505 L 182 505 C 181 494 180 483 178 473 Z', 'front_left_knee')}
          {z('front_right_shin', 'M59 511 L98 511 L97 610 L75 610 C73 595 72 581 68 568 C62 550 59 532 59 511 Z', 'front_right_shin')}
          {z('front_left_shin', 'M 184 511 L 145 511 L 146 610 L 168 610 C 170 595 171 581 175 568 C 181 550 184 532 184 511 Z', 'front_left_shin')}
          {z('front_right_ankle', 'M76 615 L97 615 L99 627 L75 627 Z', 'front_right_ankle')}
          {z('front_left_ankle', 'M 167 615 L 146 615 L 144 627 L 168 627 Z', 'front_left_ankle')}
          {z('front_right_foot', 'M67 631 L101 631 C102 635 102 639 101 643 L58 643 C58 638 62 634 67 631 Z', 'front_right_foot')}
          {z('front_left_foot', 'M 176 631 L 142 631 C 141 635 141 639 142 643 L 185 643 C 185 638 181 634 176 631 Z', 'front_left_foot')}
        </g>
      ) : (
        <g>
          {z('back_right_head', 'M123.1,3.1L123.1,70.8L124.1,72.8L140.8,79.8L141.8,73.9L144.8,68.8L144.8,64.9L146.9,63.8L147.8,59.9L148.9,59.8L148.9,57.9L151.8,53.8L151.8,45.9L152.9,44.8L152.9,41.1L151.8,41.0L151.8,30.1L150.8,30.0L150.8,27.1L149.8,27.0L149.8,23.1L148.8,23.0L146.8,14.1L139.8,8.0L139.8,6.0L136.9,3.1Z', 'back_right_head')}
          {z('back_left_head', 'M118.8,3.1L106.1,3.1L103.0,7.1L98.0,9.0L96.9,11.0L95.0,11.0L93.1,21.0L92.1,21.1L92.1,24.0L91.0,24.1L91.0,35.0L90.0,35.1L90.0,56.9L98.1,68.9L101.1,78.8L104.8,78.8L108.9,75.8L118.8,72.8Z', 'back_left_head')}
          {z('back_left_neck', 'M118.8,76.1L101.0,83.0L100.1,93.8L118.8,93.8Z', 'back_left_neck')}
          {z('back_right_neck', 'M124.1,76.1L124.1,93.8L142.8,93.8L139.8,83.1Z', 'back_right_neck')}
          {z('back_right_shoulder', 'M124.1,97.1L124.1,115.8L182.8,115.8L149.8,97.1Z', 'back_right_shoulder')}
          {z('back_left_shoulder', 'M118.8,97.1L93.1,97.1L57.0,115.8L118.8,115.8Z', 'back_left_shoulder')}
          {z('back_left_upper_arm', 'M49.8,121.1L32.0,127.0L31.1,132.0L26.0,140.1L22.0,161.8L26.1,183.8L29.8,183.8L49.8,173.8Z', 'back_left_upper_arm')}
          {z('back_right_upper_arm', 'M192.1,121.1L192.1,174.8L213.8,186.8L218.8,167.8L218.8,145.1L207.8,128.1Z', 'back_right_upper_arm')}
          {z('back_right_upper_back', 'M124.1,120.1L124.1,213.8L177.8,231.8L186.8,178.8L186.8,120.1Z', 'back_right_upper_back')}
          {z('back_left_upper_back', 'M54.1,120.1L54.1,181.8L64.1,231.8L67.8,232.8L119.8,213.8L119.8,120.1Z', 'back_left_upper_back')}
          {z('back_left_elbow', 'M51.8,180.1L27.1,188.1L20.0,218.1L21.1,221.8L54.8,227.8L57.8,221.1Z', 'back_left_elbow')}
          {z('back_right_elbow', 'M190.1,179.1L185.1,220.8L188.1,227.8L219.8,221.8L220.8,220.1L213.8,190.1Z', 'back_right_elbow')}
          {z('back_left_lower_arm', 'M19.1,225.1L13.1,248.8L45.8,253.8L51.8,232.1Z', 'back_left_lower_arm')}
          {z('back_right_lower_arm', 'M222.8,226.1L192.1,232.1L198.1,254.8L227.8,248.8Z', 'back_right_lower_arm')}
          {z('back_left_lower_back', 'M119.8,217.1L67.1,236.1L71.1,257.9L71.1,301.8L92.9,292.8L97.0,292.8L119.8,305.8Z', 'back_left_lower_back')}
          {z('back_right_lower_back', 'M123.1,217.1L123.1,304.8L124.8,305.8L146.9,292.8L154.0,293.8L173.8,301.8L173.8,235.1L153.9,229.1Z', 'back_right_lower_back')}
          {z('back_right_forearm', 'M228.8,253.1L197.1,258.1L202.1,283.8L217.1,325.8L236.8,325.8L236.8,268.1Z', 'back_right_forearm')}
          {z('back_left_forearm', 'M12.1,253.1L6.0,286.1L6.0,325.8L24.8,325.8L38.9,291.8L44.8,258.1Z', 'back_left_forearm')}
          {z('back_left_glutes', 'M92.1,297.1L67.1,307.1L67.1,346.8L76.0,350.8L91.1,358.8L96.8,359.8L119.8,349.8L119.8,310.1L108.9,306.1L94.8,297.1Z', 'back_left_glutes')}
          {z('back_right_glutes', 'M150.8,297.1L144.1,299.1L143.0,301.1L123.1,311.1L123.1,349.8L124.1,351.8L145.1,360.8L178.8,344.8L174.8,307.1Z', 'back_right_glutes')}
          {z('back_left_wrist', 'M5.1,329.1L4.1,340.8L23.9,340.8L22.8,329.1Z', 'back_left_wrist')}
          {z('back_right_wrist', 'M236.8,329.1L220.1,329.1L220.1,341.8L236.8,341.8Z', 'back_right_wrist')}
          {z('back_left_hand', 'M2.0,346.1L2.0,371.8L1.1,371.9L4.0,384.8L10.1,389.9L12.1,393.9L27.8,396.8L27.8,392.0L25.9,392.0L24.9,390.1L20.9,389.1L19.8,387.0L14.8,385.0L14.8,381.0L13.9,380.9L13.9,377.1L12.8,377.0L12.8,373.8L18.0,372.8L19.1,373.9L19.1,384.8L24.1,387.8L25.8,385.8L28.9,367.0L27.9,366.9L27.9,363.1L26.8,363.0L23.9,346.1Z', 'back_left_hand')}
          {z('back_right_hand', 'M237.8,346.1L219.1,346.1L218.1,354.0L217.1,354.1L217.1,360.0L216.1,360.1L216.1,368.0L215.0,368.1L217.1,386.8L221.8,385.8L224.8,377.9L226.0,377.8L226.0,387.0L217.1,391.0L217.0,392.1L215.1,392.1L214.1,394.8L216.1,396.8L228.8,394.9L238.8,382.8L241.9,367.1L240.8,367.0Z', 'back_right_hand')}
          {z('back_left_adductors', 'M119.8,356.1L98.1,364.1L98.1,368.8L99.1,368.9L99.1,371.8L100.1,371.9L100.1,374.8L101.1,374.9L101.1,377.8L104.1,383.9L104.1,387.8L105.1,387.9L105.1,390.8L106.1,390.9L106.1,393.8L107.1,393.9L107.1,396.8L108.1,396.9L108.1,399.8L111.1,405.9L113.1,415.8L113.8,412.9L114.9,412.8L114.9,405.9L115.8,405.8L115.8,392.9L117.8,392.9L117.8,386.9L119.8,386.8Z', 'back_left_adductors')}
          {z('back_right_adductors', 'M124.1,357.1L124.1,388.8L125.1,388.9L125.1,393.8L126.1,393.9L127.1,404.8L128.1,404.9L129.8,414.8L131.8,410.8L132.8,402.9L134.8,399.8L135.8,391.9L136.8,391.8L136.8,388.9L139.8,382.8L143.8,364.1Z', 'back_right_adductors')}
          {z('back_right_hamstrings', 'M181.9,349.1L179.1,349.1L148.1,365.1L148.1,369.0L146.1,372.1L146.1,376.0L144.1,379.1L144.1,383.0L142.1,386.1L141.1,394.0L139.1,397.1L138.1,405.0L136.1,408.1L136.1,412.0L135.1,412.1L133.1,423.0L132.1,423.1L132.1,438.8L134.1,438.8L134.1,451.8L135.1,451.9L136.1,458.8L177.8,458.8L178.8,446.9L179.8,446.8L179.8,440.9L180.8,440.8L180.8,434.9L181.8,434.8L181.8,427.9L182.8,427.8L182.8,421.9L183.9,421.8L183.9,402.9L184.9,402.8L184.9,370.1L183.8,370.0Z', 'back_right_hamstrings')}
          {z('back_left_hamstrings', 'M61.1,350.1L59.1,368.0L58.0,368.1L58.0,375.0L57.0,375.1L57.0,376.8L58.1,376.9L58.1,412.8L59.1,412.9L59.1,424.8L60.1,424.9L60.1,430.8L61.1,430.9L61.1,436.8L62.1,436.9L64.1,456.8L65.1,458.8L105.8,458.8L105.8,445.9L108.8,441.8L108.8,435.9L109.8,435.8L109.8,429.9L110.8,429.8L110.8,420.1L109.8,420.0L109.8,416.1L108.8,416.0L108.8,413.1L107.8,413.0L107.8,410.1L104.8,404.0L104.8,400.1L103.8,400.0L103.8,397.1L102.8,397.0L102.8,394.1L99.8,388.0L99.8,384.1L98.8,384.0L98.8,381.1L97.8,381.0L97.8,378.1L94.8,372.0L92.8,363.1L89.9,363.1L77.8,356.1L74.9,356.1L68.8,352.1Z', 'back_left_hamstrings')}
          {z('back_left_knee', 'M66.1,462.1L66.1,494.8L102.8,494.8L104.8,472.9L105.8,472.8L105.8,462.1Z', 'back_left_knee')}
          {z('back_right_knee', 'M136.1,462.1L140.1,494.8L176.9,494.8L176.9,462.1Z', 'back_right_knee')}
          {z('back_right_calves', 'M140.1,501.1L136.0,537.8L137.1,537.9L137.1,543.8L138.1,543.9L138.1,548.8L139.1,548.9L141.0,564.8L176.8,564.8L176.8,560.9L177.8,560.8L177.8,556.9L178.8,556.8L178.8,552.9L180.8,548.8L180.8,543.9L181.8,543.8L180.8,543.0L180.8,523.1L179.8,523.0L179.8,515.1L177.8,511.0L176.8,501.1Z', 'back_right_calves')}
          {z('back_left_calves', 'M65.1,501.1L64.1,513.0L63.1,513.1L63.1,523.0L62.1,523.1L62.1,532.0L61.1,532.1L61.1,540.8L62.1,540.9L66.1,564.8L101.9,564.8L101.9,560.9L102.9,560.8L105.9,545.1L105.9,524.1L104.8,524.0L104.8,514.1L103.8,514.0L101.8,501.1Z', 'back_left_calves')}
          {z('back_left_ankle', 'M68.1,568.1L67.1,571.8L68.1,571.9L68.1,575.8L71.1,581.9L74.1,599.8L75.1,599.9L75.1,618.8L98.8,618.8L97.8,614.1L96.8,614.0L96.8,610.1L95.8,610.0L95.8,606.1L94.8,606.0L94.8,601.1L93.8,601.0L93.8,583.9L95.8,580.8L95.8,576.9L96.8,576.8L98.8,568.1L75.1,568.1L75.0,569.1L73.8,568.1L68.9,569.1Z', 'back_left_ankle')}
          {z('back_right_ankle', 'M144.1,568.1L144.1,572.8L145.1,572.9L145.1,576.8L146.1,576.9L146.1,580.8L148.1,584.9L148.1,605.0L147.1,605.1L144.1,618.8L168.9,618.8L168.9,585.9L170.8,585.9L171.8,577.9L174.8,571.8L174.8,568.1L170.9,569.1L170.8,568.1L147.1,568.1L145.9,569.1Z', 'back_right_ankle')}
          {z('back_right_heel', 'M140.0,623.1L138.1,642.8L173.9,642.8L171.9,623.1L170.8,622.1L141.1,622.1Z', 'back_right_heel')}
          {z('back_left_heel', 'M71.0,623.1L68.1,642.9L104.9,642.9L102.8,628.1L101.8,628.0L101.8,623.1L100.8,622.1L72.1,622.1Z', 'back_left_heel')}
        </g>
      )}
    </svg>
  )
}
