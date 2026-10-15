/** Presentation only: the timing engine and stored reaction times remain uncapped. */
export const PVT_RING_MAX_MS = 500
export function pvtRingFraction(elapsedMs: number) {
  return Number.isFinite(elapsedMs) ? Math.min(1, Math.max(0, elapsedMs / PVT_RING_MAX_MS)) : 0
}
export function pvtVisualFrame(active: boolean, elapsedMs: number, feedback: string, showFeedback: boolean) {
  const response = !active && showFeedback && /^\d+ ms$/.test(feedback) ? Number.parseInt(feedback, 10) : null
  return {
    text: active ? String(Math.max(0, Math.floor(elapsedMs))).padStart(3, '0') : showFeedback ? feedback.replace(/ ms$/, '') : 'WAIT',
    numeric: active || response !== null,
    fill: active ? pvtRingFraction(elapsedMs) : response !== null ? pvtRingFraction(response) : 0,
    status: active ? 'TAP NOW' : response !== null ? 'RESPONSE RECORDED' : 'WAIT FOR THE SIGNAL',
  }
}
