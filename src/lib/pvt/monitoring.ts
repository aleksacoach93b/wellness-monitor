import { focusAnalysisFromRaw, rtQuantile } from "./analysis";
import type { PvtSessionRow } from "./baseline";

type Session = Omit<PvtSessionRow, "player"> & { raw?: unknown };
export function focusMonitoring(
  current: Session,
  history: Session[],
  truncated = false,
) {
  const analysis = focusAnalysisFromRaw(current.raw, current.durationSeconds);
  const first = new Date(`${current.localDate}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - 28);
  const from = first.toISOString().slice(0, 10);
  const eligible = (s: Session) =>
    !s.practice &&
    s.status === "COMPLETED" &&
    s.summary?.quality === "OK" &&
    !s.summary.repeatRequired &&
    typeof s.summary.medianRT === "number" &&
    Number.isFinite(s.summary.medianRT) &&
    s.summary.medianRT > 0;
  const daily = new Map<string, Session>();
  for (const s of [...history].sort(
    (a, b) =>
      a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  )) {
    if (
      eligible(s) &&
      s.playerId === current.playerId &&
      s.surveyId === current.surveyId &&
      s.questionId === current.questionId &&
      s.durationSeconds === current.durationSeconds &&
      s.protocolVersion === current.protocolVersion &&
      s.deviceId === current.deviceId &&
      s.userAgent === current.userAgent &&
      s.context.posture === current.context.posture &&
      s.context.caffeine === current.context.caffeine &&
      s.localDate >= from &&
      s.localDate < current.localDate &&
      !daily.has(s.localDate)
    )
      daily.set(s.localDate, s);
  }
  const prior = [...daily.values()]
    .slice(-14)
    .map((s) => ({
      ...s,
      analysis: focusAnalysisFromRaw(s.raw, s.durationSeconds),
    }));
  const comparisons = (
    ["medianRT", "meanRT", "cvRT", "slowPercent"] as const
  ).map((metric) => {
    const value =
      metric === "medianRT"
        ? (current.summary?.medianRT ?? null)
        : (analysis?.[metric] ?? null);
    const values = prior
      .map((s) =>
        metric === "medianRT" ? s.summary?.medianRT : s.analysis?.[metric],
      )
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const reference =
      !truncated && values.length >= 7 ? rtQuantile(values, 0.5) : null;
    const difference =
      eligible(current) && value !== null && reference !== null
        ? value - reference
        : null;
    return {
      metric,
      value,
      n: values.length,
      reference,
      difference,
      changePercent:
        difference !== null && reference !== null && reference !== 0
          ? (difference / reference) * 100
          : null,
    };
  });
  return {
    analysis,
    comparisons,
    eligible: eligible(current),
    referenceDays: prior.length,
    truncated,
  };
}
