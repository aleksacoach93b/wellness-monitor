/** Descriptive, within-player statistics. No injury prediction or population norms. */
import { shiftDay } from "./opsDates";
export type Sample = { date: string; value: number | null };
export const MIN_BASELINE_DAYS = 14;
export const MIN_CORRELATION_PAIRS = 10;
export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function mean(values: number[]) {
  return values.length
    ? values.reduce((s, v) => s + v, 0) / values.length
    : null;
}
export function medianValue(values: number[]) {
  if (!values.length) return null;
  const x = [...values].sort((a, b) => a - b),
    m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
}
export function sampleSd(values: number[]) {
  const m = mean(values);
  return m === null || values.length < 2
    ? null
    : Math.sqrt(
        values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1),
      );
}
export function personalScore(current: Sample, samples: Sample[]) {
  // One latest daily value; only the preceding 28 calendar days, excluding the current day.
  const unique = new Map(
    samples
      .filter(
        (p) =>
          p.date >= shiftDay(current.date, -28) &&
          p.date < current.date &&
          finite(p.value),
      )
      .map((p) => [p.date, p.value as number]),
  );
  const values = [...unique.values()],
    n = values.length,
    avg = mean(values),
    sd = sampleSd(values);
  const z =
    finite(current.value) && n >= MIN_BASELINE_DAYS && sd !== null && sd > 1e-9
      ? (current.value - avg!) / sd
      : null;
  return {
    n,
    mean: avg,
    sd,
    z,
    sten:
      z === null ? null : Math.max(1, Math.min(10, Math.round(5.5 + 2 * z))),
    reason: !finite(current.value)
      ? "Missing value"
      : n < MIN_BASELINE_DAYS
        ? `Needs ${MIN_BASELINE_DAYS} prior daily values`
        : sd === null || sd <= 1e-9
          ? "Baseline has no variation"
          : null,
  };
}
export function ranks(values: number[]) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const out: number[] = [];
  for (let i = 0; i < order.length; ) {
    let j = i + 1;
    while (j < order.length && order[j].value === order[i].value) j++;
    for (let k = i; k < j; k++) out[order[k].index] = (i + j + 1) / 2;
    i = j;
  }
  return out;
}
export function pearson(x: number[], y: number[]) {
  if (
    x.length !== y.length ||
    x.length < 2 ||
    !x.every(finite) ||
    !y.every(finite)
  )
    return null;
  const a = mean(x)!,
    b = mean(y)!;
  let xy = 0,
    xx = 0,
    yy = 0;
  x.forEach((v, i) => {
    xy += (v - a) * (y[i] - b);
    xx += (v - a) ** 2;
    yy += (y[i] - b) ** 2;
  });
  return xx <= 1e-12 || yy <= 1e-12
    ? null
    : Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
}
export type CorrelationPair = {
  date: string;
  xDate: string;
  x: number;
  y: number;
};
export function correlate(
  x: Sample[],
  y: Sample[],
  method: "spearman" | "pearson" = "spearman",
  lag: 0 | 1 = 0,
  changes = false,
) {
  const xm = new Map(x.map((p) => [p.date, p.value])),
    ym = new Map(y.map((p) => [p.date, p.value]));
  const pairs: CorrelationPair[] = [];
  for (const [date, yValue] of [...ym].sort(([a], [b]) => a.localeCompare(b))) {
    const xDate = shiftDay(date, -lag),
      xValue = xm.get(xDate);
    if (!finite(xValue) || !finite(yValue)) continue;
    const xPrev = xm.get(shiftDay(xDate, -1)),
      yPrev = ym.get(shiftDay(date, -1));
    if (changes && (!finite(xPrev) || !finite(yPrev))) continue;
    pairs.push({
      date,
      xDate,
      x: changes ? xValue - xPrev! : xValue,
      y: changes ? yValue - yPrev! : yValue,
    });
  }
  const n = pairs.length,
    vx = pairs.map((p) => p.x),
    vy = pairs.map((p) => p.y);
  const r =
    n < MIN_CORRELATION_PAIRS
      ? null
      : method === "spearman"
        ? pearson(ranks(vx), ranks(vy))
        : pearson(vx, vy);
  return {
    n,
    r,
    pairs,
    reason:
      n < MIN_CORRELATION_PAIRS
        ? `Needs ${MIN_CORRELATION_PAIRS} paired days`
        : r === null
          ? "No variation in one variable"
          : null,
  };
}
