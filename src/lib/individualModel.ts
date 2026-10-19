import { finite, mean } from "./individualStats";
import { shiftDay } from "./opsDates";
export const MODEL_FEATURES = [
  "sleepHours",
  "sleepQuality",
  "fatigue",
  "soreness",
  "mood",
  "stress",
] as const;
export type ModelRow = { date: string; x: number[]; y: number };
/** Fixed ridge penalty, forward-only holdout and a seven-calendar-day purge gap. */
export function withinPlayerRidge(input: ModelRow[]) {
  const rows = [
    ...new Map(
      input
        .filter(
          (r) =>
            finite(r.y) &&
            r.x.length === MODEL_FEATURES.length &&
            r.x.every(finite),
        )
        .map((r) => [r.date, r]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const n = rows.length,
    minimum = 80,
    testCount = Math.max(20, Math.floor(n * 0.25)),
    test = rows.slice(-testCount),
    cut = test.length ? shiftDay(test[0].date, -7) : "";
  const train = rows
    .slice(0, Math.max(0, n - testCount))
    .filter((r) => r.date < cut);
  const unavailable = (reason: string) => ({
    n,
    minimum,
    trainN: train.length,
    testN: test.length,
    reason,
    model: null,
  });
  if (n < minimum)
    return unavailable(
      "Needs 80 complete, comparable daily records in the selected range",
    );
  if (train.length < 45)
    return unavailable("Needs 45 training days after the seven-day gap");
  const yMean = mean(train.map((r) => r.y))!,
    yVariance = mean(train.map((r) => (r.y - yMean) ** 2))!;
  if (yVariance < 1e-9) return unavailable("Training outcome has no variation");
  const means = MODEL_FEATURES.map((_, i) => mean(train.map((r) => r.x[i]))!),
    sds = means.map((m, i) =>
      Math.sqrt(mean(train.map((r) => (r.x[i] - m) ** 2))!),
    );
  if (sds.every((v) => v < 1e-9))
    return unavailable("Training predictors have no variation");
  const scaled = (r: ModelRow) =>
    r.x.map((v, i) => (sds[i] < 1e-9 ? 0 : (v - means[i]) / sds[i]));
  const p = MODEL_FEATURES.length,
    lambda = 10,
    A = Array.from({ length: p }, () => Array(p).fill(0) as number[]),
    b = Array(p).fill(0) as number[];
  for (const r of train) {
    const x = scaled(r);
    for (let i = 0; i < p; i++) {
      b[i] += x[i] * (r.y - yMean);
      for (let j = 0; j < p; j++) A[i][j] += x[i] * x[j];
    }
  }
  for (let i = 0; i < p; i++) A[i][i] += lambda;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < p; i++) {
    let pivot = i;
    for (let j = i + 1; j < p; j++)
      if (Math.abs(M[j][i]) > Math.abs(M[pivot][i])) pivot = j;
    [M[i], M[pivot]] = [M[pivot], M[i]];
    const div = M[i][i];
    if (!finite(div) || Math.abs(div) < 1e-12)
      return unavailable("Model could not be estimated");
    for (let j = i; j <= p; j++) M[i][j] /= div;
    for (let k = 0; k < p; k++)
      if (k !== i) {
        const f = M[k][i];
        for (let j = i; j <= p; j++) M[k][j] -= f * M[i][j];
      }
  }
  const coefficients = M.map((row) => row[p]),
    points = test.map((r) => ({
      date: r.date,
      observed: r.y,
      estimated:
        yMean + scaled(r).reduce((s, v, i) => s + v * coefficients[i], 0),
    }));
  const mae = mean(points.map((r) => Math.abs(r.observed - r.estimated)))!,
    baselineMae = mean(points.map((r) => Math.abs(r.observed - yMean)))!;
  if (!finite(mae) || !finite(baselineMae) || !coefficients.every(finite))
    return unavailable("Model could not be estimated");
  return {
    n,
    minimum,
    trainN: train.length,
    testN: test.length,
    reason: null,
    model: {
      lambda,
      means,
      sds,
      coefficients,
      yMean,
      mae,
      baselineMae,
      improvement:
        baselineMae > 1e-9 ? (100 * (baselineMae - mae)) / baselineMae : null,
      trainFrom: train[0].date,
      trainTo: train.at(-1)!.date,
      testFrom: test[0].date,
      testTo: test.at(-1)!.date,
      points,
    },
  };
}
