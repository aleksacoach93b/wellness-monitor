"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Focus, RefreshCw } from "lucide-react";
import type { PvtResult } from "@/lib/pvt/protocol";
import type { PvtSessionRow } from "@/lib/pvt/baseline";
import type { focusMonitoring } from "@/lib/pvt/monitoring";
import "./focus-monitoring.css";

type Detail = PvtSessionRow & {
  raw: PvtResult | null;
  monitoring: ReturnType<typeof focusMonitoring>;
  survey: { timezone: string };
};
const fmt = (x: number | null | undefined, digits = 1) =>
  typeof x === "number" && Number.isFinite(x) ? x.toFixed(digits) : "—";
export default function FocusSessionDetails({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<{ id: string; data: Detail } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setError("");
    fetch(`/api/pvt/admin/${encodeURIComponent(id)}?monitoring=1`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Unable to load session");
        return data as Detail;
      })
      .then((data) => {
        if (!ac.signal.aborted) setLoaded({ id, data });
      })
      .catch((e) => {
        if (!ac.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load session");
      });
    return () => ac.abort();
  }, [id, retry]);
  const data = loaded?.id === id && !error ? loaded.data : null,
    a = data?.monitoring.analysis;
  const raw = data?.raw,
    trials = raw?.trials || [];
  const download = () => {
    if (!data) return;
    const rows = [
      [
        "Trial",
        "Kind",
        "Stimulus onset ms",
        "Input / end ms",
        "Reaction time ms",
        "Scheduled wait ms",
      ],
      ...trials.map((t, i) => [
        i + 1,
        t.kind,
        t.onsetMs,
        t.atMs,
        t.rtMs,
        t.waitMs,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const el = document.createElement("a");
    el.href = url;
    el.download = `Focus trials - ${data.localDate} - ${data.id}.csv`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="fm-root">
      <header className="fm-header">
        <a
          className="fm-back"
          href={
            data
              ? `/admin/pvt?surveyId=${encodeURIComponent(data.surveyId)}&playerId=${encodeURIComponent(data.playerId)}`
              : "/admin/pvt"
          }
        >
          <ArrowLeft size={17} />
          Focus · Attention
        </a>
        <span className="fm-tag">SESSION ANALYSIS</span>
      </header>
      {error ? (
        <section className="fm-panel" role="alert">
          <h1>Session unavailable</h1>
          <p>{error}</p>
          <button
            className="fm-action"
            onClick={() => {
              setLoaded(null);
              setRetry((x) => x + 1);
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </section>
      ) : !data ? (
        <p role="status">Loading Focus analysis</p>
      ) : (
        <>
          <section className="fm-hero">
            <div className="fm-mark">
              <Focus size={28} />
            </div>
            <div>
              <p className="fm-kicker">
                FOCUS TEST · {data.durationSeconds} SECONDS
              </p>
              <h1>
                {data.player.firstName} {data.player.lastName}
              </h1>
              <p>
                {new Date(data.startedAt).toLocaleString("en-GB", {
                  timeZone: data.survey.timezone,
                })}{" "}
                · {data.survey.timezone}
              </p>
            </div>
            <span className="fm-tag">
              {data.summary?.quality || data.status}
              {data.practice ? " · PRACTICE" : ""}
            </span>
          </section>
          <div className="fm-context">
            <span>{data.context.posture}</span>
            <span>{data.context.caffeine ? "Caffeine" : "No caffeine"}</span>
            <span>{data.context.minutesAwake} min since waking</span>
            <span>{data.protocolVersion}</span>
            <span>
              {data.responseId
                ? "Saved with wellness"
                : "Not linked to wellness"}
            </span>
          </div>
          {!data.monitoring.eligible && (
            <p className="fm-note" role="status">
              {data.practice
                ? "Practice attempt."
                : "This attempt needs review or is incomplete."}{" "}
              Descriptive data remain visible; personal change comparisons are
              withheld. Flags: {data.summary?.flags?.join(", ") || data.status}.
            </p>
          )}
          <div className="fm-kpis">
            {[
              [
                "Median RT",
                fmt(data.summary?.medianRT, 0),
                "ms",
                "Original saved result",
              ],
              [
                "Mean RT",
                fmt(a?.meanRT, 0),
                "ms",
                `${a?.validResponses ?? '—'} measured responses`,
              ],
              [
                "RT variation",
                fmt(a?.cvRT),
                "%",
                `Sample SD ${fmt(a?.sdRT)} ms`,
              ],
              [
                "Slow responses",
                fmt(a?.slowPercent),
                "%",
                `${a?.slowResponses ?? "—"} at ≥355 ms · exploratory`,
              ],
            ].map(([label, value, unit, note]) => (
              <article className="fm-panel" key={label}>
                <p className="fm-kicker">{label}</p>
                <strong>
                  {value}
                  <small>{unit}</small>
                </strong>
                <p>{note}</p>
              </article>
            ))}
          </div>
          {!a ? (
            <p className="fm-note">
              Detailed analysis is unavailable because the original trial record
              is missing or malformed. No values have been estimated.
            </p>
          ) : (
            <>
              <div className="fm-charts">
                <section className="fm-panel">
                  <div className="fm-panel-head">
                    <h2>Every reaction</h2>
                    <span className="fm-tag">{a.validResponses} RESPONSES</span>
                  </div>
                  <p>
                    Recorded response times across the session. Dashed line:
                    exploratory 355 ms reference.
                  </p>
                  <ReactionTimeline
                    raw={raw!}
                    duration={data.durationSeconds}
                  />
                  <p className="fm-caption">
                    Slow measured responses are retained. Early taps, timeouts
                    and unfinished signals are listed separately below.
                  </p>
                </section>
                <section className="fm-panel">
                  <h2>Response distribution</h2>
                  <p>
                    Number of measured responses within each reaction-time
                    interval.
                  </p>
                  <ReactionDistribution raw={raw!} />
                  <div className="fm-range">
                    <span>
                      P10 <b>{fmt(a.p10RT, 0)} ms</b>
                    </span>
                    <span>
                      P90 <b>{fmt(a.p90RT, 0)} ms</b>
                    </span>
                    <span>
                      Range{" "}
                      <b>
                        {fmt(a.minRT, 0)}–{fmt(a.maxRT, 0)} ms
                      </b>
                    </span>
                  </div>
                </section>
              </div>
              <section className="fm-panel">
                <div className="fm-panel-head">
                  <h2>Personal comparison</h2>
                  <span className="fm-tag">PREVIOUS 28 DAYS</span>
                </div>
                <p>
                  First eligible attempt per day, most recent 14 days used. Same
                  duration, protocol, device/browser, position and caffeine
                  setting. At least 7 previous days per metric; reference is
                  their median.
                </p>
                {data.monitoring.truncated && (
                  <p className="fm-note">
                    History limit reached. Reference comparisons are withheld.
                  </p>
                )}
                <div className="fm-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>This session</th>
                        <th>Personal reference</th>
                        <th>Difference</th>
                        <th>Reference days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monitoring.comparisons.map((c) => {
                        const percent =
                            c.metric === "cvRT" || c.metric === "slowPercent",
                          unit = percent ? "%" : "ms";
                        return (
                          <tr key={c.metric}>
                            <th>
                              {
                                {
                                  medianRT: "Median RT",
                                  meanRT: "Mean RT",
                                  cvRT: "RT variation",
                                  slowPercent: "Slow responses",
                                }[c.metric]
                              }
                            </th>
                            <td>
                              {fmt(c.value)} {unit}
                            </td>
                            <td>
                              {c.reference === null
                                ? "Building reference"
                                : `${fmt(c.reference)} ${unit}`}
                            </td>
                            <td>
                              {c.difference === null
                                ? "—"
                                : percent
                                  ? `${c.difference > 0 ? "+" : ""}${fmt(c.difference)} percentage points`
                                  : `${c.changePercent! > 0 ? "+" : ""}${fmt(c.changePercent)}%`}
                            </td>
                            <td>{c.n}/7 minimum</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="fm-caption">
                  A positive difference means a higher measurement, not a
                  fatigue diagnosis. Normal day-to-day noise and learning can
                  contribute. These descriptive references do not define
                  meaningful-change thresholds.
                </p>
              </section>
              <section className="fm-panel">
                <div className="fm-panel-head">
                  <h2>First half / second half</h2>
                  <span className="fm-tag">EXPLORATORY</span>
                </div>
                <div className="fm-halves">
                  <div>
                    <p>First {data.durationSeconds / 2}s</p>
                    <strong>
                      {fmt(a.firstHalfMedian, 0)}
                      <small>ms</small>
                    </strong>
                    <p>{a.firstHalfResponses} responses</p>
                  </div>
                  <div>
                    <p>Last {data.durationSeconds / 2}s</p>
                    <strong>
                      {fmt(a.lastHalfMedian, 0)}
                      <small>ms</small>
                    </strong>
                    <p>{a.lastHalfResponses} responses</p>
                  </div>
                  <div>
                    <p>Median change</p>
                    <strong>
                      {a.halfDeltaPercent !== null && a.halfDeltaPercent > 0
                        ? "+"
                        : ""}
                      {fmt(a.halfDeltaPercent)}
                      <small>%</small>
                    </strong>
                    <p>At least 3 responses in each half</p>
                  </div>
                </div>
                <p className="fm-caption">
                  Halves use stimulus onset time. Small samples make this
                  comparison noisy; it does not establish cognitive endurance or
                  fatigue.
                </p>
              </section>
            </>
          )}
          <section className="fm-panel">
            <div className="fm-panel-head">
              <h2>Recording & participation</h2>
              <button
                className="fm-action"
                onClick={download}
                disabled={!trials.length}
              >
                <Download size={16} />
                Trial CSV
              </button>
            </div>
            <div className="fm-range">
              <span>
                Early taps <b>{data.summary?.falseStarts ?? "—"}</b>
              </span>
              <span>
                Omissions <b>{a?.omissions ?? "—"}</b>
              </span>
              <span>
                Unfinished signals <b>{a?.censored ?? "—"}</b>
              </span>
              <span>
                Largest frame interval <b>{fmt(raw?.maxFrameGapMs)} ms</b>
              </span>
            </div>
            <p className="fm-caption">
              An unfinished final signal is not a measured response or an
              omission. Frame intervals describe browser scheduling, not
              calibrated screen/touch latency. No neurological health or injury
              classification is calculated.
            </p>
            <details>
              <summary>Individual trial record ({trials.length})</summary>
              <div className="fm-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Trial</th>
                      <th>Outcome</th>
                      <th>Onset (s)</th>
                      <th>RT (ms)</th>
                      <th>Scheduled wait (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((t, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{t.kind}</td>
                        <td>
                          {fmt(t.onsetMs === null ? null : t.onsetMs / 1000, 3)}
                        </td>
                        <td>{fmt(t.rtMs)}</td>
                        <td>{fmt(t.waitMs, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <p className="fm-caption">
            Descriptive analysis: {a?.version || "unavailable"}. Historical
            scores and protocol versions are preserved. The 30/60-second Focus
            check requires its own reliability and timing validation.
          </p>
        </>
      )}
    </div>
  );
}
function ReactionTimeline({
  raw,
  duration,
}: {
  raw: PvtResult;
  duration: number;
}) {
  const points = raw.trials.filter(
      (t) => t.kind === "response" && t.rtMs !== null && t.rtMs >= 100,
    ),
    max = Math.max(500, ...points.map((t) => t.rtMs!)) * 1.12;
  const x = (n: number) => 52 + (n / (duration * 1000)) * 492,
    y = (n: number) => 194 - (n / max) * 160;
  return (
    <svg
      viewBox="0 0 580 245"
      className="fm-chart"
      role="img"
      aria-label="Reaction-time timeline. Exact values are in the individual trial record."
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1="52"
            x2="544"
            y1={y(max * f)}
            y2={y(max * f)}
            className="fm-grid"
          />
          <text x="44" y={y(max * f) + 4} textAnchor="end">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      <line x1="52" x2="544" y1={y(355)} y2={y(355)} className="fm-threshold" />
      {points.map((t, i) => (
        <circle
          key={i}
          cx={x(t.onsetMs!)}
          cy={y(t.rtMs!)}
          r="4.5"
          fill={t.rtMs! >= 355 ? "#fbbf24" : "#67e8f9"}
        >
          <title>
            Response {i + 1}: {fmt(t.rtMs)} ms at {fmt(t.onsetMs! / 1000, 2)}{" "}
            seconds
          </title>
        </circle>
      ))}
      {[0, duration / 2, duration].map((s) => (
        <text key={s} x={x(s * 1000)} y="216" textAnchor="middle">
          {s}s
        </text>
      ))}
      <text x="52" y="18">
        RT (ms)
      </text>
      <text x="298" y="239" textAnchor="middle">
        Time from session start
      </text>
    </svg>
  );
}
function ReactionDistribution({ raw }: { raw: PvtResult }) {
  const times = raw.trials
    .filter((t) => t.kind === "response" && t.rtMs !== null && t.rtMs >= 100)
    .map((t) => t.rtMs!);
  const high = Math.max(500, ...times),
    bins = Array.from(
      { length: 5 },
      (_, i) =>
        times.filter(
          (t) =>
            t >= (i * high) / 5 &&
            (i === 4 ? t <= high : t < ((i + 1) * high) / 5),
        ).length,
    ),
    max = Math.max(1, ...bins);
  return (
    <svg
      viewBox="0 0 580 245"
      className="fm-chart"
      role="img"
      aria-label="Histogram of measured reaction times. Bin counts are shown above each bar."
    >
      {[0, max].map((n) => (
        <g key={n}>
          <line
            x1="52"
            x2="544"
            y1={194 - (n / max) * 150}
            y2={194 - (n / max) * 150}
            className="fm-grid"
          />
          <text x="44" y={198 - (n / max) * 150} textAnchor="end">
            {n}
          </text>
        </g>
      ))}
      {bins.map((n, i) => (
        <g key={i}>
          <rect
            x={60 + i * 96}
            y={194 - (n / max) * 150}
            width="76"
            height={(n / max) * 150}
            rx="5"
            fill="#67e8f9"
            opacity=".75"
          />
          <text x={98 + i * 96} y={184 - (n / max) * 150} textAnchor="middle">
            {n}
          </text>
          <text x={98 + i * 96} y="215" textAnchor="middle">
            {Math.round((i * high) / 5)}–{Math.round(((i + 1) * high) / 5)}
          </text>
        </g>
      ))}
      <text x="52" y="18">
        Responses
      </text>
      <text x="298" y="239" textAnchor="middle">
        Reaction time (ms)
      </text>
    </svg>
  );
}
