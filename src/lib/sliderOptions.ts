/**
 * Slider questions store labels in Question.options as JSON.
 * Legacy: { left?, center?, right? }
 * Extended: adds optional steps: { "1": "...", ... "10": "..." } for per-value captions.
 */

export interface SliderLabelsState {
  left?: string
  center?: string
  right?: string
  steps?: Record<string, string>
}

export function parseSliderOptions(raw: string | null): SliderLabelsState | null {
  if (!raw?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const o = parsed as Record<string, unknown>
    const out: SliderLabelsState = {}

    if (typeof o.left === 'string') out.left = o.left
    if (typeof o.center === 'string') out.center = o.center
    if (typeof o.right === 'string') out.right = o.right

    if (o.steps && typeof o.steps === 'object' && !Array.isArray(o.steps)) {
      const steps: Record<string, string> = {}
      for (const [k, v] of Object.entries(o.steps as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) steps[k] = v.trim()
      }
      if (Object.keys(steps).length > 0) out.steps = steps
    }

    if (!out.left && !out.center && !out.right && !out.steps) return null
    return out
  } catch {
    return null
  }
}

/** Persist to DB; omit empty strings so legacy rows stay small. */
export function serializeSliderLabels(labels: SliderLabelsState | undefined): string | null {
  if (!labels) return null
  const out: Record<string, unknown> = {}
  if (labels.left?.trim()) out.left = labels.left.trim()
  if (labels.center?.trim()) out.center = labels.center.trim()
  if (labels.right?.trim()) out.right = labels.right.trim()
  if (labels.steps && typeof labels.steps === 'object') {
    const cleaned: Record<string, string> = {}
    for (let i = 1; i <= 10; i++) {
      const key = String(i)
      const t = labels.steps[key]?.trim()
      if (t) cleaned[key] = t
    }
    if (Object.keys(cleaned).length > 0) out.steps = cleaned
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null
}
