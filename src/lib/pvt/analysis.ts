import type { PvtResult } from "./protocol";

/** Descriptive analytics only. Does not change protocol, eligibility or stored RTs. */
export const FOCUS_ANALYSIS_VERSION = "focus-descriptive-v1";
export type FocusAnalysis = {
  version: typeof FOCUS_ANALYSIS_VERSION;
  validResponses: number;
  meanRT: number | null;
  sdRT: number | null;
  cvRT: number | null;
  minRT: number | null;
  maxRT: number | null;
  p10RT: number | null;
  p90RT: number | null;
  slowThresholdMs: number;
  slowResponses: number;
  slowPercent: number | null;
  omissions: number;
  censored: number;
  firstHalfResponses: number;
  lastHalfResponses: number;
  firstHalfMedian: number | null;
  lastHalfMedian: number | null;
  halfDeltaPercent: number | null;
};
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const avg = (x: number[]) =>
  x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
/** Linear interpolation (Hyndman–Fan type 7). No extrapolation. */
export function rtQuantile(values: number[], fraction: number): number | null {
  if (
    !values.length ||
    !values.every(finite) ||
    fraction < 0 ||
    fraction > 1 ||
    !finite(fraction)
  )
    return null;
  const sorted = [...values].sort((a, b) => a - b),
    i = (sorted.length - 1) * fraction,
    lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
export function analyzeFocus(
  result: PvtResult,
  duration: number,
  slowThresholdMs = 355,
): FocusAnalysis {
  // Timeouts and the naturally unfinished final stimulus are not measured responses.
  const responses = result.trials.filter(
    (t) => t.kind === "response" && finite(t.rtMs) && t.rtMs >= 100,
  );
  const times = responses.map((t) => t.rtMs!),
    meanRT = avg(times);
  const sdRT =
    times.length > 1 && meanRT !== null
      ? Math.sqrt(
          times.reduce((s, x) => s + (x - meanRT) ** 2, 0) / (times.length - 1),
        )
      : null;
  const first = responses
    .filter((t) => t.onsetMs !== null && t.onsetMs < duration * 500)
    .map((t) => t.rtMs!);
  const last = responses
    .filter((t) => t.onsetMs !== null && t.onsetMs >= duration * 500)
    .map((t) => t.rtMs!);
  // Short windows can be sparse: require at least three responses in EACH half.
  const firstHalfMedian = first.length >= 3 ? rtQuantile(first, 0.5) : null;
  const lastHalfMedian = last.length >= 3 ? rtQuantile(last, 0.5) : null;
  const slowResponses = times.filter((t) => t >= slowThresholdMs).length;
  return {
    version: FOCUS_ANALYSIS_VERSION,
    validResponses: times.length,
    meanRT,
    sdRT,
    cvRT: meanRT !== null && sdRT !== null ? (sdRT / meanRT) * 100 : null,
    minRT: times.length ? Math.min(...times) : null,
    maxRT: times.length ? Math.max(...times) : null,
    p10RT: rtQuantile(times, 0.1),
    p90RT: rtQuantile(times, 0.9),
    slowThresholdMs,
    slowResponses,
    slowPercent: times.length ? (slowResponses / times.length) * 100 : null,
    omissions: result.trials.filter((t) => t.kind === "timeout").length,
    censored: result.trials.filter((t) => t.kind === "censored").length,
    firstHalfResponses: first.length,
    lastHalfResponses: last.length,
    firstHalfMedian,
    lastHalfMedian,
    halfDeltaPercent:
      firstHalfMedian !== null && lastHalfMedian !== null
        ? (lastHalfMedian / firstHalfMedian - 1) * 100
        : null,
  };
}
/** Historical records are derived on read; their saved score/version is never rewritten. */
export function focusAnalysisFromRaw(
  raw: unknown,
  duration: number,
): FocusAnalysis | null {
  if (!raw || typeof raw !== "object" || !finite(duration) || duration <= 0)
    return null;
  const r = raw as Record<string, unknown>;
  if (
    !Array.isArray(r.trials) ||
    r.trials.length > 2000 ||
    !finite(r.elapsedMs) ||
    r.elapsedMs < 0 ||
    !finite(r.maxFrameGapMs) ||
    r.maxFrameGapMs < 0
  )
    return null;
  let previous = 0;
  for (const t of r.trials) {
    if (!t || typeof t !== "object") return null;
    const x = t as Record<string, unknown>;
    if (
      !["response", "false-start", "timeout", "censored"].includes(
        String(x.kind),
      ) ||
      !finite(x.atMs) ||
      x.atMs < previous ||
      x.atMs > r.elapsedMs + 5 ||
      (x.onsetMs !== null && (!finite(x.onsetMs) || x.onsetMs < 0)) ||
      (x.rtMs !== null && (!finite(x.rtMs) || x.rtMs < 0)) ||
      (x.waitMs !== null && (!finite(x.waitMs) || x.waitMs < 0)) ||
      (x.onsetMs === null && (x.kind !== "false-start" || x.rtMs !== null)) ||
      (x.onsetMs !== null &&
        (x.rtMs === null ||
          Math.abs(x.atMs - (x.onsetMs as number) - (x.rtMs as number)) > 2)) ||
      (x.kind === "response" &&
        (x.onsetMs === null ||
          x.rtMs === null ||
          Math.abs(x.atMs - (x.onsetMs as number) - (x.rtMs as number)) > 2))
    )
      return null;
    previous = x.atMs as number;
  }
  return analyzeFocus(raw as PvtResult, duration);
}
