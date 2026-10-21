import type { IndividualReport } from "./individualReport";
import {
  finite,
  mean,
  medianValue,
  sampleSd,
  personalScore,
  type Sample,
} from "./individualStats";
export function defaultIndividualGroup(
  report: IndividualReport,
  kind: "rhr" | "focus",
) {
  const latest = [...report.days]
    .reverse()
    .filter((d) => d.date >= report.from)
    .flatMap((d) => d.readings)
    .find((r) => r.kind === kind && r.valid);
  return (
    latest?.group ||
    report.groups.find((g) => g.kind === kind && g.count > 0)?.id ||
    report.groups.find((g) => g.kind === kind)?.id ||
    ""
  );
}
export function individualSeries(
  report: IndividualReport,
  hrGroup: string,
  focusGroup: string,
) {
  const metrics = [
    { id: "rhr", label: "Resting HR", unit: "bpm", color: "#67e8f9" },
    { id: "focus", label: "Focus median", unit: "ms", color: "#c4b5fd" },
    { id: "focusMean", label: "Focus mean RT", unit: "ms", color: "#a5b4fc" },
    { id: "focusCV", label: "Focus RT variation", unit: "%", color: "#fcd34d" },
    {
      id: "focusSlow",
      label: "Focus slow responses (exploratory)",
      unit: "%",
      color: "#fda4af",
    },
    ...report.metrics,
  ];
  const series: Record<string, Sample[]> = {};
  for (const metric of metrics)
    series[metric.id] = report.days.map((d) => ({
      date: d.date,
      value:
        metric.id.startsWith("focus") && metric.id !== "focus"
          ? (d.readings.find(
              (r) => r.kind === "focus" && r.group === focusGroup && r.valid,
            )?.focusMetrics?.[
              metric.id === "focusMean"
                ? "meanRT"
                : metric.id === "focusCV"
                  ? "cvRT"
                  : "slowPercent"
            ] ?? null)
          : metric.id === "rhr" || metric.id === "focus"
            ? (d.readings.find(
                (r) =>
                  r.kind === metric.id &&
                  r.group === (metric.id === "rhr" ? hrGroup : focusGroup) &&
                  r.valid,
              )?.value ?? null)
            : (d.values[metric.id] ?? null),
    }));
  const stats = metrics.map((metric) => {
    const points = series[metric.id].filter(
        (p) => p.date >= report.from && finite(p.value),
      ),
      values = points.map((p) => p.value as number),
      latest = points.at(-1);
    return {
      ...metric,
      n: values.length,
      latest: latest || null,
      mean: mean(values),
      median: medianValue(values),
      sd: sampleSd(values),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      score: latest ? personalScore(latest, series[metric.id]) : null,
    };
  });
  return { metrics, series, stats };
}
