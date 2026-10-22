"use client";
import Image from "next/image";
import { useOpsAccess } from "@/components/opsShare/OpsAccess";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Focus,
  Heart,
  Loader2,
  RefreshCw,
  ScanLine,
  UserRound,
  X,
} from "lucide-react";
import BodyMap from "@/components/BodyMap";
import { getJointsAreaZone, isJointsAreaId } from "@/lib/jointsAreasMap";
import {
  defaultIndividualGroup,
  individualSeries,
} from "@/lib/individualAnalysis";
import { correlate, finite, personalScore } from "@/lib/individualStats";
import { shiftDay } from "@/lib/opsDates";
import type { IndividualReport, IndividualDay } from "@/lib/individualReport";
import { LineChart, ScatterChart } from "./IndividualCharts";
import { IndividualModel } from "./IndividualModel";
import "./ops-individual.css";
const fmt = (x: number | null | undefined, digits = 1) =>
  finite(x) ? x.toFixed(digits) : "—";
const dateLabel = (date: string) => date.split("-").reverse().join(".");
type Roster = {
  players: IndividualReport["player"][];
  survey: IndividualReport["survey"];
  today: string;
};
export default function OpsIndividual({
  surveyId,
  endDate,
}: {
  surveyId: string;
  endDate: string;
}) {
  const { readOnly, apiBase, request } = useOpsAccess();
  const [roster, setRoster] = useState<Roster | null>(null),
    [playerId, setPlayerId] = useState(""),
    [range, setRange] = useState({ from: shiftDay(endDate, -27), to: endDate }),
    [draft, setDraft] = useState(range),
    [rangeError, setRangeError] = useState("");
  const [loadedReport, setReport] = useState<IndividualReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [rosterError, setRosterError] = useState(""),
    [rosterRetry, setRosterRetry] = useState(0);
  const [hrGroup, setHrGroup] = useState(""),
    [focusGroup, setFocusGroup] = useState(""),
    [tab, setTab] = useState("overview"),
    [selectedDay, setSelectedDay] = useState(""),
    [trendMetric, setTrendMetric] = useState("readiness"),
    [scoreMetric, setScoreMetric] = useState("rhr"),
    [scoreMode, setScoreMode] = useState<"sten" | "z">("sten");
  const [corrTarget, setCorrTarget] = useState("rhr"),
    [corrOther, setCorrOther] = useState("focus"),
    [method, setMethod] = useState<"spearman" | "pearson">("spearman"),
    [lag, setLag] = useState<0 | 1>(0),
    [changes, setChanges] = useState(false),
    [bodyKind, setBodyKind] = useState<"pain" | "soreness">("pain"),
    [bodyLayer, setBodyLayer] = useState<"muscle" | "joints">("muscle");
  const [exporting, setExporting] = useState(false),
    [pdfTheme, setPdfTheme] = useState<"dark" | "light">("light"),
    [exportError, setExportError] = useState(""),
    [includeDetails, setIncludeDetails] = useState(false);
  const detail = useRef<HTMLDialogElement>(null),
    lastFocus = useRef<HTMLElement | SVGElement | null>(null),
    exportLock = useRef(false);
  useEffect(() => {
    const ac = new AbortController();
    let active = true;
    setRoster(null);
    setPlayerId("");
    setReport(null);
    setRosterError("");
    request(`${apiBase}/individual?surveyId=${encodeURIComponent(surveyId)}`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error || "Unable to load players");
        if (active) setRoster(b);
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") setRosterError(e.message);
      });
    return () => {
      active = false;
      ac.abort();
    };
  }, [surveyId, rosterRetry, apiBase, request]);
  useEffect(() => {
    if (!playerId) return;
    const ac = new AbortController();
    let active = true;
    setBusy(true);
    setReport(null);
    setError("");
    setSelectedDay("");
    const params = new URLSearchParams({ surveyId, playerId, ...range });
    request(`${apiBase}/individual?${params}`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error || "Unable to load individual report");
        if (active) {
          setReport(b);
          setHrGroup(defaultIndividualGroup(b, "rhr"));
          setFocusGroup(defaultIndividualGroup(b, "focus"));
        }
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      ac.abort();
    };
  }, [surveyId, playerId, range, retry, apiBase, request]);
  const report =
    loadedReport?.player.id === playerId &&
    loadedReport.survey.id === surveyId &&
    loadedReport.from === range.from &&
    loadedReport.to === range.to
      ? loadedReport
      : null;
  const analysis = useMemo(
    () => (report ? individualSeries(report, hrGroup, focusGroup) : null),
    [report, hrGroup, focusGroup],
  );
  const days = report?.days.filter((d) => d.date >= report.from) || [],
    history = [...days].reverse(),
    submitted = days.filter((d) => d.submittedAt).length;
  const visibleSeries = (id: string) =>
    analysis?.series[id]?.filter((p) => !report || p.date >= report.from) || [];
  const correlations = useMemo(
    () =>
      analysis
        ? analysis.metrics
            .filter((m) => m.id !== corrTarget)
            .map((m) => ({
              ...m,
              ...correlate(
                analysis.series[m.id].filter((p) => p.date >= range.from),
                analysis.series[corrTarget].filter((p) => p.date >= range.from),
                method,
                lag,
                changes,
              ),
            }))
        : [],
    [analysis, corrTarget, range.from, method, lag, changes],
  );
  const correlation =
    correlations.find((c) => c.id === corrOther) || correlations[0];
  const focusPlayer = roster?.players.find((p) => p.id === playerId);
  const openDay = (date: string, trigger?: HTMLElement | SVGElement) => {
    lastFocus.current =
      trigger ||
      (document.activeElement instanceof HTMLElement ||
      document.activeElement instanceof SVGElement
        ? document.activeElement
        : null);
    setSelectedDay(date);
    if (!detail.current?.open) detail.current?.showModal();
  };
  const closeDay = () => {
    const trigger = lastFocus.current;
    detail.current?.close();
    setSelectedDay("");
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };
  const selected = days.find((d) => d.date === selectedDay);
  const applyRange = (from: string, to: string) => {
    if (
      !from ||
      !to ||
      from > to ||
      to > (roster?.today || endDate) ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365
    ) {
      setRangeError(
        "Choose a valid range of up to 366 days, ending today or earlier.",
      );
      return;
    }
    setRangeError("");
    setDraft({ from, to });
    setRange({ from, to });
  };
  const exportPdf = async () => {
    if (readOnly || !report || !analysis || exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    setExportError("");
    try {
      const { exportIndividualPdf } = await import("@/lib/individualPdf");
      await exportIndividualPdf({
        report,
        analysis,
        hrGroup,
        focusGroup,
        theme: pdfTheme,
        method,
        lag,
        changes,
        includeDetails,
      });
    } catch (e) {
      setExportError(
        e instanceof Error
          ? e.message
          : "Unable to export report. Please try again.",
      );
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };
  const exportChoices = (
    <div className="ip-export">
      <select
        aria-label="Individual PDF content"
        value={includeDetails ? "full" : "summary"}
        onChange={(e) => setIncludeDetails(e.target.value === "full")}
      >
        <option value="summary">Summary report</option>
        <option value="full">Full history report</option>
      </select>
      <select
        aria-label="Individual PDF appearance"
        value={pdfTheme}
        onChange={(e) => setPdfTheme(e.target.value as "dark" | "light")}
      >
        <option value="light">Light PDF</option>
        <option value="dark">Dark PDF</option>
      </select>
      <button
        type="button"
        disabled={!report || busy || exporting}
        onClick={() => void exportPdf()}
      >
        {exporting ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Download size={16} />
        )}
        Export PDF
      </button>
    </div>
  );
  return (
    <section className="ip-root" aria-label="Individual player monitoring">
      <header className="ip-hero">
        <div className="ip-orbit" aria-hidden />
        <div className="ip-player">
          <span>
            <UserRound size={32} />
            {focusPlayer?.image && (
              <Image
                width={76}
                height={76}
                unoptimized
                src={focusPlayer.image}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </span>
          <div>
            <p className="ip-kicker">LIVE OPS / INDIVIDUAL</p>
            <h2>
              {focusPlayer
                ? `${focusPlayer.firstName} ${focusPlayer.lastName}`
                : "Individual player"}
            </h2>
            <p>
              {roster?.survey.title || "Individual wellness history"}
              {focusPlayer && !focusPlayer.isActive ? " · Inactive player" : ""}
            </p>
          </div>
        </div>
        {!readOnly && exportChoices}
      </header>
      <div className="ip-controls">
        <label>
          Player
          <select
            aria-label="Individual player"
            value={playerId}
            disabled={!roster}
            onChange={(e) => {
              setPlayerId(e.target.value);
              setTab("overview");
            }}
          >
            <option value="">Select a player</option>
            {roster?.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName}, {p.firstName}
                {p.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <div className="ip-presets">
          {[7, 14, 28, 90].map((n) => (
            <button
              type="button"
              key={n}
              className={
                shiftDay(range.to, 1 - n) === range.from ? "is-active" : ""
              }
              onClick={() => applyRange(shiftDay(range.to, 1 - n), range.to)}
            >
              {n} days
            </button>
          ))}
        </div>
        <label>
          From
          <input
            aria-label="Individual from date"
            type="date"
            value={draft.from}
            max={draft.to || roster?.today || endDate}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            aria-label="Individual to date"
            type="date"
            value={draft.to}
            max={roster?.today || endDate}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="ip-apply"
          onClick={() => applyRange(draft.from, draft.to)}
        >
          <CalendarDays size={15} />
          Apply
        </button>
      </div>
      {rangeError && (
        <p role="alert" className="ip-error">
          {rangeError}
        </p>
      )}
      {(error || rosterError) && (
        <div className="ip-error" role="alert">
          {error || rosterError}
          <button
            type="button"
            onClick={() =>
              rosterError
                ? setRosterRetry((n) => n + 1)
                : setRetry((n) => n + 1)
            }
          >
            <RefreshCw size={14} />
            Retry individual report
          </button>
        </div>
      )}
      {exportError && (
        <p role="alert" className="ip-error">
          {exportError}
        </p>
      )}
      {busy || (!!playerId && !report && !error) ? (
        <div role="status" className="ip-empty">
          <Loader2 className="animate-spin" size={28} />
          Loading player history
        </div>
      ) : !playerId ? (
        <div className="ip-empty">
          <div className="ip-empty-icon">
            <ScanLine size={38} />
          </div>
          <h3>Select a player</h3>
          <p>Measurements, questionnaire history and within-player analysis.</p>
        </div>
      ) : report && analysis ? (
        <>
          <div className="ip-context">
            <span>
              <CalendarDays size={14} />
              {dateLabel(report.from)} — {dateLabel(report.to)}
            </span>
            <span>{report.survey.timezone}</span>
            <span>
              {submitted}/{days.length} calendar days submitted
            </span>
          </div>
          {!report.focusAvailable && (
            <p className="ip-error" role="status">
              Focus history is temporarily unavailable. Questionnaire and HR
              history remain available.
            </p>
          )}
          <div className="ip-setups">
            {(["rhr", "focus"] as const).map((kind) => (
              <label key={kind}>
                {kind === "rhr" ? <Heart size={15} /> : <Focus size={15} />}{" "}
                {kind === "rhr"
                  ? "HR measurement setup"
                  : "Focus measurement setup"}
                <select
                  aria-label={`${kind} measurement setup`}
                  value={kind === "rhr" ? hrGroup : focusGroup}
                  onChange={(e) =>
                    kind === "rhr"
                      ? setHrGroup(e.target.value)
                      : setFocusGroup(e.target.value)
                  }
                >
                  {!report.groups.some((g) => g.kind === kind) && (
                    <option value="">No saved setup</option>
                  )}
                  {report.groups
                    .filter((g) => g.kind === kind)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label} · {g.count} days
                      </option>
                    ))}
                </select>
                <small>
                  {
                    report.groups.find(
                      (g) => g.id === (kind === "rhr" ? hrGroup : focusGroup),
                    )?.details
                  }
                </small>
              </label>
            ))}
          </div>
          <div className="ip-kpis">
            {["readiness", "rhr", "focus", "sleepHours"].map((id) => {
              const m = analysis.stats.find((s) => s.id === id)!;
              return (
                <article
                  key={id}
                  style={{ "--ip-accent": m.color } as React.CSSProperties}
                >
                  <div className="ip-kpi-top">
                    <span>{m.label}</span>
                    {id === "rhr" ? (
                      <Heart size={18} />
                    ) : id === "focus" ? (
                      <Focus size={18} />
                    ) : (
                      <Activity size={18} />
                    )}
                  </div>
                  <strong>
                    {fmt(
                      m.latest?.value,
                      id === "focus" || id === "rhr" ? 0 : 1,
                    )}
                    <small>{m.unit}</small>
                  </strong>
                  <span className="ip-kpi-date">
                    {m.latest
                      ? `Last recorded ${dateLabel(m.latest.date)}`
                      : "No comparable value"}
                  </span>
                  <div className="ip-mini">
                    <LineChart
                      points={visibleSeries(id)}
                      color={m.color}
                      unit={m.unit}
                      onSelect={openDay}
                    />
                  </div>
                  <footer>
                    <span>
                      Period median <b>{fmt(m.median)}</b>
                    </span>
                    <span>{m.n} measured days</span>
                  </footer>
                </article>
              );
            })}
          </div>
          <nav className="ip-tabs" aria-label="Individual analysis sections">
            {[
              ["overview", "Overview"],
              ["correlations", "Correlations"],
              ["history", "Daily history"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "is-active" : ""}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <>
              <div className="ip-grid">
                <article className="ip-panel">
                  <div className="ip-panel-head">
                    <div>
                      <p className="ip-kicker">OBJECTIVE MEASUREMENTS</p>
                      <h3>Resting heart rate</h3>
                    </div>
                    <span className="ip-chip">bpm</span>
                  </div>
                  <LineChart
                    points={visibleSeries("rhr")}
                    color="#67e8f9"
                    unit="bpm"
                    onSelect={openDay}
                  />
                  <p className="ip-caption">
                    Accepted, saved readings from the selected setup. Gaps
                    represent missing or excluded results.
                  </p>
                </article>
                <article className="ip-panel">
                  <div className="ip-panel-head">
                    <div>
                      <p className="ip-kicker">REACTION TIME</p>
                      <h3>Focus median</h3>
                    </div>
                    <span className="ip-chip">ms</span>
                  </div>
                  <LineChart
                    points={visibleSeries("focus")}
                    color="#c4b5fd"
                    unit="ms"
                    onSelect={openDay}
                  />
                  <p className="ip-caption">
                    Only saved, non-practice results with OK quality. Device,
                    browser, protocol and context are matched.
                  </p>
                </article>
              </div>
              <div className="ip-grid">
                <article className="ip-panel">
                  <div className="ip-panel-head">
                    <h3>Wellness & sleep</h3>
                    <select
                      aria-label="Wellness chart variable"
                      value={trendMetric}
                      onChange={(e) => setTrendMetric(e.target.value)}
                    >
                      {analysis.metrics
                        .filter((m) => !["rhr", "focus"].includes(m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <LineChart
                    points={visibleSeries(trendMetric)}
                    color={
                      analysis.metrics.find((m) => m.id === trendMetric)
                        ?.color || "#6ee7b7"
                    }
                    unit={
                      analysis.metrics.find((m) => m.id === trendMetric)
                        ?.unit || ""
                    }
                    onSelect={openDay}
                  />
                  <p className="ip-caption">
                    Original questionnaire scales are retained. Existing
                    wellness scales use 1 = lowest and 10 = highest favourable
                    response.
                  </p>
                </article>
                <article className="ip-panel">
                  <div className="ip-panel-head">
                    <h3>
                      Personal {scoreMode === "sten" ? "STEN" : "Z-score"}{" "}
                      history
                    </h3>
                    <div className="ip-segment">
                      <button
                        type="button"
                        className={scoreMode === "sten" ? "is-active" : ""}
                        onClick={() => setScoreMode("sten")}
                      >
                        STEN
                      </button>
                      <button
                        type="button"
                        className={scoreMode === "z" ? "is-active" : ""}
                        onClick={() => setScoreMode("z")}
                      >
                        Z
                      </button>
                    </div>
                  </div>
                  <select
                    aria-label="Standardized variable"
                    value={scoreMetric}
                    onChange={(e) => setScoreMetric(e.target.value)}
                  >
                    {analysis.metrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <LineChart
                    points={visibleSeries(scoreMetric).map((p) => {
                      const s = personalScore(
                        p,
                        analysis.series[scoreMetric] || [],
                      );
                      return {
                        date: p.date,
                        value: scoreMode === "sten" ? s.sten : s.z,
                      };
                    })}
                    color="#fcd34d"
                    unit={scoreMode === "sten" ? "STEN" : "Z"}
                    standard={scoreMode === "sten"}
                    onSelect={openDay}
                  />
                  <p className="ip-caption">
                    Previous 28 calendar days, at least 14 valid daily values.
                    Higher STEN means a higher raw value, not necessarily better
                    readiness.
                  </p>
                </article>
              </div>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <div>
                    <p className="ip-kicker">WITHIN-PLAYER REFERENCE</p>
                    <h3>Standardized profile</h3>
                  </div>
                  <span className="ip-chip">STEN 1–10</span>
                </div>
                <div className="ip-table-scroll">
                  <table className="ip-table">
                    <thead>
                      <tr>
                        <th>Variable</th>
                        <th>Latest / date</th>
                        <th>Period median</th>
                        <th>Period SD</th>
                        <th>Personal STEN</th>
                        <th>Z-score</th>
                        <th>Baseline days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.stats.map((m) => (
                        <tr key={m.id}>
                          <th>{m.label}</th>
                          <td>
                            {fmt(m.latest?.value)} {m.unit}
                            <small>{m.latest?.date || "—"}</small>
                          </td>
                          <td>{fmt(m.median)}</td>
                          <td>{fmt(m.sd, 2)}</td>
                          <td
                            title={
                              m.score?.reason ||
                              "STEN = round(5.5 + 2 × Z), bounded to 1–10"
                            }
                          >
                            <div className="ip-sten">
                              {Array.from({ length: 10 }, (_, i) => (
                                <i
                                  key={i}
                                  className={
                                    m.score?.sten === i + 1 ? "is-active" : ""
                                  }
                                />
                              ))}
                              <b>{m.score?.sten ?? "—"}</b>
                            </div>
                            {m.score?.reason && <small>{m.score.reason}</small>}
                          </td>
                          <td>{fmt(m.score?.z, 2)}</td>
                          <td>{m.score?.n ?? 0} / 14 min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <div>
                    <p className="ip-kicker">PERSONAL DEVIATIONS</p>
                    <h3>Measurements outside ±2 SD</h3>
                  </div>
                  <span className="ip-chip">Descriptive flags</span>
                </div>
                <div className="ip-deviations">
                  {(["rhr", "focus"] as const)
                    .flatMap((id) =>
                      visibleSeries(id).map((p) => ({
                        id,
                        p,
                        score: personalScore(p, analysis.series[id]),
                      })),
                    )
                    .filter(
                      (x) => x.score.z !== null && Math.abs(x.score.z) >= 2,
                    )
                    .sort(
                      (a, b) =>
                        b.p.date.localeCompare(a.p.date) ||
                        a.id.localeCompare(b.id),
                    )
                    .slice(0, 12)
                    .map((x) => (
                      <button
                        type="button"
                        key={x.id + x.p.date}
                        onClick={(e) => openDay(x.p.date, e.currentTarget)}
                      >
                        <strong>
                          {x.id === "rhr" ? "RHR" : "Focus"} ·{" "}
                          {fmt(x.p.value, 0)} {x.id === "rhr" ? "bpm" : "ms"}
                        </strong>
                        <span>
                          {dateLabel(x.p.date)} · Z {fmt(x.score.z, 2)} · STEN{" "}
                          {x.score.sten}
                        </span>
                      </button>
                    ))}
                </div>
                <p className="ip-caption">
                  Large deviations from the previous 28-day personal baseline,
                  with at least 14 prior valid days. These flags describe
                  unusual values; they are not a fatigue diagnosis or a
                  trained-model prediction. Up to 12 most recent events are
                  listed.
                </p>
              </article>
              <BodyHistory
                days={days}
                kind={bodyKind}
                setKind={setBodyKind}
                layer={bodyLayer}
                setLayer={setBodyLayer}
                openDay={openDay}
              />
            </>
          )}
          {tab === "correlations" && (
            <>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <div>
                    <p className="ip-kicker">EXPLORATORY ASSOCIATIONS</p>
                    <h3>Correlation analysis</h3>
                  </div>
                  <span className="ip-chip">Paired daily values</span>
                </div>
                <div className="ip-corr-controls">
                  <label>
                    Outcome
                    <select
                      aria-label="Correlation outcome"
                      value={corrTarget}
                      onChange={(e) => {
                        setCorrTarget(e.target.value);
                        if (e.target.value === corrOther)
                          setCorrOther(
                            e.target.value === "rhr" ? "focus" : "rhr",
                          );
                      }}
                    >
                      <option value="rhr">Resting HR</option>
                      <option value="focus">Focus median</option>
                    </select>
                  </label>
                  <label>
                    Method
                    <select
                      aria-label="Correlation method"
                      value={method}
                      onChange={(e) =>
                        setMethod(e.target.value as typeof method)
                      }
                    >
                      <option value="spearman">Spearman ρ · ranks</option>
                      <option value="pearson">Pearson r · raw values</option>
                    </select>
                  </label>
                  <label>
                    Timing
                    <select
                      aria-label="Correlation lag"
                      value={lag}
                      onChange={(e) => setLag(Number(e.target.value) as 0 | 1)}
                    >
                      <option value="0">Same calendar day</option>
                      <option value="1">
                        Variable yesterday → outcome today
                      </option>
                    </select>
                  </label>
                  <label>
                    Values
                    <select
                      aria-label="Correlation values"
                      value={changes ? "changes" : "raw"}
                      onChange={(e) => setChanges(e.target.value === "changes")}
                    >
                      <option value="raw">Daily values</option>
                      <option value="changes">Day-to-day changes</option>
                    </select>
                  </label>
                </div>
                <p className="ip-caption">
                  One latest submitted questionnaire per day; no missing values
                  filled in. At least 10 paired days are required to display a
                  coefficient. Daily observations may be serially related; these
                  are descriptive associations, not causal effects or predictive
                  validation.
                </p>
              </article>
              <div className="ip-correlation-grid">
                <article className="ip-panel">
                  <h3>Correlation matrix</h3>
                  <p className="ip-caption">
                    Select a variable to inspect the paired observations.
                  </p>
                  <div className="ip-corr-list">
                    {correlations.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className={correlation?.id === c.id ? "is-active" : ""}
                        onClick={() => setCorrOther(c.id)}
                      >
                        <span>
                          {c.label}
                          <small>
                            {c.n} paired days{c.reason ? " · " + c.reason : ""}
                          </small>
                        </span>
                        <span className="ip-corr-track">
                          <i
                            style={{
                              width: `${Math.abs(c.r || 0) * 100}%`,
                              background:
                                c.r !== null && c.r < 0 ? "#c4b5fd" : "#67e8f9",
                            }}
                          />
                        </span>
                        <strong>{fmt(c.r, 2)}</strong>
                        {c.r !== null &&
                          (c.r < 0 ? (
                            <ArrowDownRight size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          ))}
                      </button>
                    ))}
                  </div>
                </article>
                <article className="ip-panel">
                  <div className="ip-panel-head">
                    <h3>
                      {correlation?.label || "Variable"} ×{" "}
                      {corrTarget === "rhr" ? "Resting HR" : "Focus"}
                    </h3>
                    <span className="ip-chip">
                      {method === "spearman" ? "ρ" : "r"}{" "}
                      {fmt(correlation?.r, 2)}
                    </span>
                  </div>
                  <ScatterChart
                    pairs={correlation?.pairs || []}
                    xLabel={
                      (changes ? "Δ " : "") + (correlation?.label || "Variable")
                    }
                    yLabel={
                      (changes ? "Δ " : "") +
                      (corrTarget === "rhr" ? "RHR (bpm)" : "Focus (ms)")
                    }
                    onSelect={openDay}
                  />
                  <p className="ip-caption">
                    {lag
                      ? "Each point pairs the preceding calendar day’s variable with the outcome date."
                      : "Each point represents one calendar day."}{" "}
                    {correlation?.reason ||
                      `${correlation?.n || 0} observed pairs. Positive: higher values occur together. Negative: higher values accompany lower values.`}
                  </p>
                  <div className="ip-table-scroll ip-pairs">
                    <table className="ip-table">
                      <thead>
                        <tr>
                          <th>Variable date</th>
                          <th>Outcome date</th>
                          <th>Variable</th>
                          <th>Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {correlation?.pairs.map((p) => (
                          <tr key={p.date}>
                            <td>{p.xDate}</td>
                            <td>
                              <button
                                type="button"
                                onClick={(e) =>
                                  openDay(p.date, e.currentTarget)
                                }
                              >
                                {p.date}
                              </button>
                            </td>
                            <td>{fmt(p.x, 2)}</td>
                            <td>{fmt(p.y, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </>
          )}
          {tab === "history" && (
            <>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <h3>Daily record</h3>
                  <span className="ip-chip">{submitted} submitted days</span>
                </div>
                <div className="ip-day-grid">
                  {days.map((d) => (
                    <button
                      type="button"
                      key={d.date}
                      title={`${d.date} · ${d.submittedAt ? "Submitted" : "No questionnaire"}`}
                      className={d.submittedAt ? "is-done" : ""}
                      onClick={(e) => openDay(d.date, e.currentTarget)}
                    >
                      {d.date.slice(8)}
                      {d.submittedAt && <Check size={10} />}
                    </button>
                  ))}
                </div>
                <div className="ip-table-scroll">
                  <table className="ip-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Questionnaire</th>
                        <th>RHR</th>
                        <th>Focus median</th>
                        <th>Readiness</th>
                        <th>Sleep</th>
                        <th>Energy</th>
                        <th>Soreness</th>
                        <th>Mood</th>
                        <th>Stress</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((d) => (
                        <tr key={d.date}>
                          <th>
                            <button
                              type="button"
                              onClick={(e) => openDay(d.date, e.currentTarget)}
                            >
                              {dateLabel(d.date)}
                            </button>
                          </th>
                          <td>
                            {d.submittedAt
                              ? `${d.responseCount} submitted`
                              : "Missing"}
                          </td>
                          <td>
                            {fmt(
                              analysis.series.rhr.find((p) => p.date === d.date)
                                ?.value,
                              0,
                            )}
                          </td>
                          <td>
                            {fmt(
                              analysis.series.focus.find(
                                (p) => p.date === d.date,
                              )?.value,
                              0,
                            )}
                          </td>
                          {[
                            "readiness",
                            "sleepHours",
                            "fatigue",
                            "soreness",
                            "mood",
                            "stress",
                          ].map((id) => (
                            <td key={id}>{fmt(d.values[id])}</td>
                          ))}
                          <td>
                            <button
                              type="button"
                              onClick={(e) => openDay(d.date, e.currentTarget)}
                              aria-label={`Open responses ${d.date}`}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <h3>Focus attempt log</h3>
                  <span className="ip-chip">
                    Includes unsaved & practice attempts
                  </span>
                </div>
                <p className="ip-caption">
                  Only eligible saved results enter the trend and correlation
                  analyses.
                </p>
                <div className="ip-table-scroll">
                  <table className="ip-table">
                    <thead>
                      <tr>
                        <th>Date / time ({report.survey.timezone})</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Median</th>
                        <th>Quality</th>
                        <th>Saved</th>
                        <th>Practice</th>
                        {!readOnly && <th>Analysis</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {report.attempts.map((a, i) => (
                        <tr key={i}>
                          <td>
                            {new Date(a.time).toLocaleString("en-GB", {
                              timeZone: report.survey.timezone,
                            })}
                          </td>
                          <td>{a.duration}s</td>
                          <td>{a.status}</td>
                          <td>{fmt(a.median, 0)} ms</td>
                          <td>{a.quality}</td>
                          <td>{a.saved ? "Yes" : "No"}</td>
                          <td>{a.practice ? "Yes" : "No"}</td>
                          {!readOnly && <td><a href={`/admin/pvt/session/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">Inspect session ↗</a></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.attempts.length && (
                    <p className="ip-caption">
                      No Focus attempts in this period.
                    </p>
                  )}
                </div>
              </article>
              <article className="ip-panel">
                <div className="ip-panel-head">
                  <h3>HR measurement log</h3>
                  <span className="ip-chip">Acquisition outcomes</span>
                </div>
                {!report.hrTrackingAvailable ? (
                  <p className="ip-caption">
                    HR attempt tracking is unavailable. Saved HR questionnaire
                    results are still shown above.
                  </p>
                ) : (
                  <>
                    <p className="ip-caption">
                      Includes accepted and unsuccessful camera attempts.
                      Accepted attempts enter analyses only when saved in a
                      questionnaire and eligible for the selected setup.
                    </p>
                    <div className="ip-table-scroll">
                      <table className="ip-table">
                        <thead>
                          <tr>
                            <th>Date / time</th>
                            <th>Status</th>
                            <th>HR</th>
                            <th>Position</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.hrAttempts.map((a, i) => (
                            <tr key={i}>
                              <td>
                                {new Date(a.time).toLocaleString("en-GB", {
                                  timeZone: report.survey.timezone,
                                })}
                              </td>
                              <td>{a.status}</td>
                              <td>{fmt(a.bpm, 0)} bpm</td>
                              <td>{a.position || "—"}</td>
                              <td>{a.reason || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!report.hrAttempts.length && (
                        <p className="ip-caption">
                          No recorded HR attempts in this period.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </article>
            </>
          )}
          <IndividualModel
            report={report}
            analysis={analysis}
            openDay={openDay}
          />
          <details className="ip-method">
            <summary>Methods & interpretation</summary>
            <p>
              Personal baseline: the preceding 28 calendar days, excluding the
              scored day, with at least 14 valid daily values. Z = (value −
              baseline mean) / sample SD. STEN = round(5.5 + 2 × Z), clipped to
              1–10. No score is generated for missing values or a constant
              baseline.
            </p>
            <p>
              This personal STEN transformation is a display scale, not a
              population-normed or validated readiness test. Higher STEN means a
              higher raw measurement. RHR and reaction time are not “better”
              simply because their STEN is higher. Subjective scales retain
              their questionnaire direction.
            </p>
            <p>
              HR setups separate question, position, protocol and algorithm.
              Saved HR answers do not contain device identity. Focus setups
              additionally match device/browser, duration, posture and caffeine
              context. Correlations use only the selected setups and range, with
              average ranks for tied Spearman values. Day-to-day change requires
              measurements on consecutive calendar days.
            </p>
            <p>
              Associations can reflect shared trends or other influences.
              Correlation panels report no p-values or injury probabilities. The
              separate ridge panel provides retrospective holdout estimates only
              when its data requirements are met. Calendar-day coverage does not
              assume that the survey was scheduled every day.
            </p>
            <p>
              <a
                href="https://www.savilleassessment.com/wp-content/uploads/2024/07/Chapter-18-Norms.pdf"
                target="_blank"
                rel="noreferrer"
              >
                STEN scoring reference
              </a>{" "}
              ·{" "}
              <a
                href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/cor.test.html"
                target="_blank"
                rel="noreferrer"
              >
                Correlation methods
              </a>{" "}
              ·{" "}
              <a
                href="https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm"
                target="_blank"
                rel="noreferrer"
              >
                Interpreting associations
              </a>
            </p>
          </details>
        </>
      ) : null}
      <dialog
        className="ip-detail"
        ref={detail}
        aria-labelledby="ip-day-title"
        onCancel={(e) => {
          e.preventDefault();
          closeDay();
        }}
      >
        <header>
          <div>
            <p className="ip-kicker">DAILY RECORD</p>
            <h3 id="ip-day-title">
              {selectedDay ? dateLabel(selectedDay) : "Responses"}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeDay}
            aria-label="Close daily responses"
          >
            <X size={20} />
          </button>
        </header>
        <div className="ip-detail-content">
          {selected ? (
            <>
              <div className="ip-reading-list">
                {selected.readings.map((r, i) => (
                  <div key={i}>
                    <strong>
                      {r.kind === "rhr" ? "Resting HR" : "Focus median"} ·{" "}
                      {fmt(
                        r.value,
                        r.kind === "rhr" || r.kind === "focus" ? 0 : 1,
                      )}{" "}
                      {r.kind === "rhr" ? "bpm" : "ms"}
                    </strong>
                    <span>{r.context}</span>
                    <small>{r.note}</small>
                    <small>
                      Measured:{" "}
                      {Number.isFinite(Date.parse(r.measuredAt))
                        ? new Date(r.measuredAt).toLocaleString("en-GB", {
                            timeZone: report?.survey.timezone,
                          })
                        : "Unknown timestamp"}
                    </small>
                  </div>
                ))}
              </div>
              {selected.responses.length ? (
                selected.responses.map((r, i) => (
                  <section key={i}>
                    <h4>
                      {i === 0 ? "Latest submission" : "Earlier submission"} ·{" "}
                      {new Date(r.submittedAt).toLocaleTimeString("en-GB", {
                        timeZone: report?.survey.timezone,
                      })}
                    </h4>
                    {(r.matchDay || r.sessionType) && (
                      <p>
                        {[r.matchDay, r.sessionType]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <dl>
                      {r.answers.map((a, j) => (
                        <div key={j}>
                          <dt>{a.question}</dt>
                          <dd>{a.text || "No answer"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))
              ) : (
                <p>No questionnaire was submitted on this date.</p>
              )}
            </>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}
function BodyHistory({
  days,
  kind,
  setKind,
  layer,
  setLayer,
  openDay,
}: {
  days: IndividualDay[];
  kind: "pain" | "soreness";
  setKind: (k: "pain" | "soreness") => void;
  layer: "muscle" | "joints";
  setLayer: (l: "muscle" | "joints") => void;
  openDay: (d: string, trigger?: HTMLElement | SVGElement) => void;
}) {
  const zones = new Map<
    string,
    { label: string; max: number; dates: string[]; side: "front" | "back" }
  >();
  for (const d of days)
    for (const z of d.zones.filter(
      (z) =>
        z.kind === kind &&
        (layer === "joints" ? isJointsAreaId(z.id) : !isJointsAreaId(z.id)),
    )) {
      const id =
        layer === "joints" ? getJointsAreaZone(z.id)?.id || z.id : z.id;
      const old = zones.get(id) || {
        label: z.label,
        max: 0,
        dates: [],
        side: z.side,
      };
      old.max = Math.max(old.max, z.rating);
      if (!old.dates.includes(d.date)) old.dates.push(d.date);
      zones.set(id, old);
    }
  return (
    <article className="ip-panel">
      <div className="ip-panel-head">
        <div>
          <p className="ip-kicker">REPORTED AREAS / SELECTED PERIOD</p>
          <h3>Body map history</h3>
        </div>
        <div className="ip-segment">
          <button
            type="button"
            className={kind === "pain" ? "is-active" : ""}
            onClick={() => setKind("pain")}
          >
            Pain
          </button>
          <button
            type="button"
            className={kind === "soreness" ? "is-active" : ""}
            onClick={() => setKind("soreness")}
          >
            Soreness
          </button>
        </div>
      </div>
      <div className="ip-segment">
        <button
          type="button"
          className={layer === "muscle" ? "is-active" : ""}
          onClick={() => setLayer("muscle")}
        >
          Muscles
        </button>
        <button
          type="button"
          className={layer === "joints" ? "is-active" : ""}
          onClick={() => setLayer("joints")}
        >
          Joints / areas
        </button>
      </div>
      <div className="ip-body">
        <div className="ip-mannequins">
          {(["front", "back"] as const).map((view) => (
            <div key={view}>
              <span>{view === "front" ? "Front" : "Back"}</span>
              <BodyMap
                mode="preview"
                mapMode={layer}
                view={view}
                selectedAreas={Object.fromEntries(
                  [...zones]
                    .filter(([, z]) => z.side === view)
                    .map(([id, z]) => [id, z.max]),
                )}
                onAreaClick={() => {}}
                onViewChange={() => {}}
                onContinue={() => {}}
                onClose={() => {}}
                colorScheme={kind}
              />
            </div>
          ))}
        </div>
        <div className="ip-zone-list">
          {[...zones]
            .sort((a, b) => b[1].dates.length - a[1].dates.length)
            .map(([id, z]) => (
              <div key={id}>
                <strong>{z.label}</strong>
                <span>
                  {z.dates.length} reported days · peak {z.max}/10
                </span>
                <div>
                  {z.dates.map((date) => (
                    <button
                      type="button"
                      key={date}
                      onClick={(e) => openDay(date, e.currentTarget)}
                    >
                      {dateLabel(date)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          {!zones.size && <p>No {kind} areas reported in this period.</p>}
        </div>
      </div>
      <p className="ip-caption">
        The map shows peak reported intensity per area. Select a date to inspect
        exact location and triggers.
      </p>
    </article>
  );
}
