"use client";
import { useMemo } from "react";
import { MODEL_FEATURES, withinPlayerRidge } from "@/lib/individualModel";
import type { individualSeries } from "@/lib/individualAnalysis";
import type { IndividualReport } from "@/lib/individualReport";
import { ScatterChart } from "./IndividualCharts";
const fmt = (v: number) => v.toFixed(2);
export function IndividualModel({
  report,
  analysis,
  openDay,
}: {
  report: IndividualReport;
  analysis: ReturnType<typeof individualSeries>;
  openDay: (date: string, trigger?: HTMLElement | SVGElement) => void;
}) {
  const models = useMemo(
    () =>
      ["rhr", "focus"].map((id) => ({
        id,
        ...withinPlayerRidge(
          report.days
            .filter((d) => d.date >= report.from)
            .map((d) => ({
              date: d.date,
              x: MODEL_FEATURES.map((k) => d.values[k] as number),
              y: analysis.series[id].find((p) => p.date === d.date)
                ?.value as number,
            })),
        ),
      })),
    [report, analysis],
  );
  return (
    <article className="ip-panel">
      <div className="ip-panel-head">
        <div>
          <p className="ip-kicker">
            EXPERIMENTAL / WITHIN-PLAYER MACHINE LEARNING
          </p>
          <h3>Ridge regression · temporal holdout</h3>
        </div>
        <span className="ip-chip">No future forecasts</span>
      </div>
      <p className="ip-caption">
        Models use sleep duration, sleep quality, energy, soreness, mood and
        stress to estimate the same day’s RHR or Focus. Only complete,
        comparable daily records in the selected range are used. The newest 25%
        (at least 20 days) are held out, with a seven-calendar-day gap before
        them. Scaling is fitted on training data only.
      </p>
      <div className="ip-grid" style={{ marginTop: 16 }}>
        {models.map((m) => (
          <div className="ip-model" key={m.id}>
            <h4>{m.id === "rhr" ? "Resting HR" : "Focus median"}</h4>
            {!m.model ? (
              <>
                <strong>
                  {m.n} / {m.minimum} complete days
                </strong>
                <p>{m.reason}</p>
              </>
            ) : (
              <>
                <div className="ip-model-stats">
                  <span>
                    Holdout MAE
                    <b>
                      {fmt(m.model.mae)} {m.id === "rhr" ? "bpm" : "ms"}
                    </b>
                  </span>
                  <span>
                    Training-mean baseline MAE<b>{fmt(m.model.baselineMae)}</b>
                  </span>
                  <span>
                    Improvement over baseline
                    <b>
                      {m.model.improvement === null
                        ? "—"
                        : `${m.model.improvement.toFixed(1)}%`}
                    </b>
                  </span>
                </div>
                <p>
                  {m.trainN} training days ({m.model.trainFrom} –{" "}
                  {m.model.trainTo}) · {m.testN} holdout days (
                  {m.model.testFrom} – {m.model.testTo})
                </p>
                <p>
                  {m.model.mae < m.model.baselineMae
                    ? "Lower error than the training-mean baseline on this holdout."
                    : "No improvement over the training-mean baseline on this holdout."}
                </p>
                <ScatterChart
                  pairs={m.model.points.map((p) => ({
                    date: p.date,
                    xDate: p.date,
                    x: p.observed,
                    y: p.estimated,
                  }))}
                  xLabel="Observed"
                  yLabel="Holdout estimate"
                  onSelect={openDay}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <p className="ip-caption">
        Fixed ridge penalty λ = 10. This single-player temporal holdout is
        exploratory and is not external validation or an injury/fatigue model. A
        result is not shown when there are fewer than 80 complete days or
        insufficient variation.{" "}
        <a
          href="https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html"
          target="_blank"
          rel="noreferrer"
        >
          Ridge method reference
        </a>
      </p>
    </article>
  );
}
