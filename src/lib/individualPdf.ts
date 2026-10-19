import { MODEL_FEATURES, withinPlayerRidge } from "./individualModel";
import type { IndividualReport } from "./individualReport";
import type { individualSeries } from "./individualAnalysis";
import { correlate } from "./individualStats";
import { pdfRowPages } from "./opsPdfLayout";
type Analysis = ReturnType<typeof individualSeries>;
const fmt = (v: number | null | undefined, n = 1) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(n) : "—";
/** Fully local, paginated report of the selected player/range/setup. No data writes. */
export async function exportIndividualPdf({
  report,
  analysis,
  hrGroup,
  focusGroup,
  theme,
  method,
  lag,
  changes,
  includeDetails = false,
}: {
  report: IndividualReport;
  analysis: Analysis;
  hrGroup: string;
  focusGroup: string;
  theme: "dark" | "light";
  method: "spearman" | "pearson";
  lag: 0 | 1;
  changes: boolean;
  includeDetails?: boolean;
}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  const name = `${report.player.firstName} ${report.player.lastName}`,
    title = `Individual Wellness Report - ${name}`,
    range = `${report.from} to ${report.to}`;
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  const root = document.createElement("div");
  root.style.cssText = `width:1200px;font:13px/1.55 Arial,sans-serif;color:${theme === "dark" ? "#e5eefb" : "#17263c"};background:${theme === "dark" ? "#0a1728" : "#fff"};padding:20px;box-sizing:border-box;`;
  host.append(root);
  document.body.append(host);
  const doc = new jsPDF({
    orientation: "landscape",
    format: "a4",
    unit: "pt",
    compress: true,
  });
  doc.setProperties({
    title: `${title} - ${range}`,
    creator: "Wellness Monitor",
  });
  const make = (tag: string, text: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };
  const header = document.createElement("header");
  header.append(
    make("h1", title),
    make("p", `${report.survey.title} | ${range} | ${report.survey.timezone}`),
    make(
      "p",
      `HR: ${report.groups.find((g) => g.id === hrGroup)?.label || "No setup"} | Focus: ${report.groups.find((g) => g.id === focusGroup)?.label || "No setup"}`,
    ),
  );
  header.style.cssText = "padding:0 4px 12px;";
  header.querySelector("h1")!.style.cssText =
    "font-size:23px;line-height:1.4;margin:0 0 8px;";
  header
    .querySelectorAll("p")
    .forEach(
      (p) =>
        (p.style.cssText =
          "font-size:11px;margin:3px 0;overflow-wrap:anywhere;"),
    );
  const footer = make(
    "footer",
    `Generated ${new Date().toISOString()} | Personal descriptive report`,
  );
  footer.style.cssText = "padding:12px 4px;font-size:10px;";
  const columns = (names: string[]) => {
    const table = document.createElement("table");
    table.style.cssText =
      "width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px;";
    const head = table.createTHead().insertRow();
    names.forEach((n) => {
      const th = make("th", n);
      th.style.cssText = `padding:9px 8px;text-align:left;border-bottom:1px solid ${theme === "dark" ? "#426079" : "#cbd5e1"};background:${theme === "dark" ? "#163047" : "#edf3f8"};font-size:10px;text-transform:uppercase;overflow-wrap:anywhere;`;
      head.append(th);
    });
    table.createTBody();
    return table;
  };
  const addRow = (table: HTMLTableElement, values: string[]) => {
    const row = table.tBodies[0].insertRow();
    values.forEach((v) => {
      const td = row.insertCell();
      td.textContent = v;
      td.style.cssText = `padding:6px;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;border-bottom:1px solid ${theme === "dark" ? "#233a50" : "#e2e8f0"};`;
    });
    if (table.tBodies[0].rows.length % 2 === 0)
      row.style.background = theme === "dark" ? "#102238" : "#f6f8fb";
  };
  const sections: { label: string; note: string; table: HTMLTableElement }[] =
    [];
  const samplePoints = (id: string) =>
    analysis.series[id].filter((p) => p.date >= report.from);
  const trends = columns(["Resting HR (bpm)", "Focus median (ms)"]);
  addRow(trends, ["", ""]);
  for (const [column, id] of ["rhr", "focus"].entries()) {
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 550 240");
    svg.style.width = "100%";
    const points = samplePoints(id),
      valid = points.filter((p) => p.value !== null),
      values = valid.map((p) => p.value as number);
    if (values.length) {
      const min = Math.min(...values) - 2,
        max = Math.max(...values) + 2,
        x = (i: number) => 45 + (i / Math.max(1, points.length - 1)) * 485,
        y = (v: number) => 20 + ((max - v) / (max - min)) * 180;
      for (const f of [0, 0.5, 1]) {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", "45");
        line.setAttribute("x2", "530");
        line.setAttribute("y1", String(20 + f * 180));
        line.setAttribute("y2", String(20 + f * 180));
        line.setAttribute("stroke", theme === "dark" ? "#2a4258" : "#dce5ed");
        svg.append(line);
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", "3");
        label.setAttribute("y", String(24 + f * 180));
        label.setAttribute("font-size", "12");
        label.setAttribute("fill", theme === "dark" ? "#a9bed3" : "#52677d");
        label.textContent = (max - f * (max - min)).toFixed(0);
        svg.append(label);
      }
      let path = "";
      const draw = () => {
        if (!path) return;
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", path);
        p.setAttribute("fill", "none");
        p.setAttribute(
          "stroke",
          id === "rhr"
            ? theme === "dark"
              ? "#67e8f9"
              : "#087b92"
            : theme === "dark"
              ? "#c4b5fd"
              : "#7950b4",
        );
        p.setAttribute("stroke-width", "2.5");
        svg.append(p);
        path = "";
      };
      points.forEach((p, i) => {
        if (p.value === null) draw();
        else path += `${path ? " L" : "M"}${x(i)} ${y(p.value)}`;
      });
      draw();
      for (const i of [0, points.length - 1]) {
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", String(i ? 530 : 45));
        t.setAttribute("y", "228");
        t.setAttribute("text-anchor", i ? "end" : "start");
        t.setAttribute("font-size", "12");
        t.setAttribute("fill", theme === "dark" ? "#a9bed3" : "#52677d");
        t.textContent = points[i].date;
        svg.append(t);
      }
    } else {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", "30");
      t.setAttribute("y", "100");
      t.setAttribute("fill", theme === "dark" ? "#a9bed3" : "#52677d");
      t.textContent = "No eligible readings in this period";
      svg.append(t);
    }
    trends.tBodies[0].rows[0].cells[column].append(svg);
  }
  sections.push({
    label: "Objective trends",
    note: "Selected measurement setups only. Gaps indicate missing or excluded measurements; values are not interpolated.",
    table: trends,
  });
  const stats = columns([
    "Variable",
    "Latest / date",
    "Median",
    "SD",
    "Personal STEN",
    "Z-score",
    "Baseline days",
  ]);
  analysis.stats.forEach((s) =>
    addRow(stats, [
      s.label,
      `${fmt(s.latest?.value)} ${s.unit}\n${s.latest?.date || "—"}`,
      fmt(s.median),
      fmt(s.sd, 2),
      s.score?.sten?.toString() || "—",
      fmt(s.score?.z, 2),
      `${s.score?.n || 0} / 14 min${s.score?.reason ? "\n" + s.score.reason : ""}`,
    ]),
  );
  sections.push({
    label: "Standardized profile",
    note: "Latest eligible value per variable. Baseline: previous 28 calendar days, excluding that value’s day; at least 14 prior values. STEN = round(5.5 + 2 × Z), bounded to 1–10. Higher means a higher raw value, not better readiness. Personal display scale; not population norms.",
    table: stats,
  });
  const corr = columns([
    "Variable",
    "RHR coefficient",
    "Paired days",
    "Focus coefficient",
    "Paired days",
  ]);
  const sample = (id: string) =>
    analysis.series[id].filter((p) => p.date >= report.from);
  for (const m of analysis.metrics) {
    const hr =
        m.id === "rhr"
          ? null
          : correlate(sample(m.id), sample("rhr"), method, lag, changes),
      fc =
        m.id === "focus"
          ? null
          : correlate(sample(m.id), sample("focus"), method, lag, changes);
    addRow(corr, [
      m.label,
      hr ? fmt(hr.r, 2) + (hr.reason ? "\n" + hr.reason : "") : "—",
      hr ? String(hr.n) : "—",
      fc ? fmt(fc.r, 2) + (fc.reason ? "\n" + fc.reason : "") : "—",
      fc ? String(fc.n) : "—",
    ]);
  }
  sections.push({
    label: "Correlations",
    note: `${method === "spearman" ? "Spearman rank correlation (ties use average ranks)" : "Pearson linear correlation"} | ${lag ? "Variable yesterday → outcome today" : "Same day"} | ${changes ? "Consecutive day-to-day changes" : "Daily values"}. Minimum 10 paired days. Exploratory associations only; repeated days may be serially related. No causal or predictive claims.`,
    table: corr,
  });
  const daily = columns([
    "Date",
    "Submitted",
    "RHR bpm",
    "Focus ms",
    "Readiness",
    "Sleep h",
    "Energy",
    "Soreness",
    "Mood",
    "Stress",
  ]);
  for (const day of report.days.filter((d) => d.date >= report.from)) {
    const val = (id: string) =>
      fmt(analysis.series[id].find((p) => p.date === day.date)?.value);
    addRow(daily, [
      day.date,
      day.submittedAt ? `${day.responseCount} submission(s)` : "Missing",
      val("rhr"),
      val("focus"),
      ...[
        "readiness",
        "sleepHours",
        "fatigue",
        "soreness",
        "mood",
        "stress",
      ].map(val),
    ]);
  }
  sections.push({
    label: "Daily history",
    note: "One latest submitted questionnaire per local day. Missing and excluded measurements are shown as dashes. Only the selected HR and Focus setups enter the numeric columns.",
    table: daily,
  });
  const body = columns([
    "Date",
    "Kind",
    "Area",
    "Intensity",
    "Exact location",
    "Triggers",
  ]);
  for (const day of report.days.filter((d) => d.date >= report.from))
    for (const z of day.zones)
      addRow(body, [
        day.date,
        z.kind,
        z.label,
        `${z.rating}/10`,
        z.location || "—",
        z.when.join(", ") || "—",
      ]);
  if (body.tBodies[0].rows.length)
    sections.push({
      label: "Reported body areas",
      note: "Latest submitted questionnaire per day. Original location and trigger descriptions retained.",
      table: body,
    });
  const responses = columns(["Local date / time", "Question", "Answer"]);
  for (const day of report.days.filter((d) => d.date >= report.from))
    for (const r of day.responses)
      for (const a of r.answers) {
        const text = a.text || "No answer"; // Long free-text answers continue without losing content.
        const chunks = text.match(/[\s\S]{1,650}/g) || ["No answer"];
        chunks.forEach((chunk, i) =>
          addRow(responses, [
            `${day.date}\n${new Date(r.submittedAt).toLocaleTimeString("en-GB", { timeZone: report.survey.timezone })}`,
            `${a.question}${i ? " (continued)" : ""}`,
            chunk,
          ]),
        );
      }
  if (includeDetails && responses.tBodies[0].rows.length)
    sections.push({
      label: "Questionnaire responses",
      note: "Every saved submission, including earlier submissions on the same day. Charts and correlations use the latest submission only.",
      table: responses,
    });
  const attempts = columns([
    "Date / time",
    "Duration",
    "Status",
    "Median ms",
    "Quality",
    "Saved",
    "Practice",
  ]);
  report.attempts.forEach((a) =>
    addRow(attempts, [
      `${a.date}\n${new Date(a.time).toLocaleTimeString("en-GB", { timeZone: report.survey.timezone })}`,
      `${a.duration}s`,
      a.status,
      fmt(a.median, 0),
      a.quality,
      a.saved ? "Yes" : "No",
      a.practice ? "Yes" : "No",
    ]),
  );
  if (includeDetails && attempts.tBodies[0].rows.length)
    sections.push({
      label: "Focus attempt log",
      note: "Includes unsaved and practice attempts. Ineligible attempts are excluded from statistical analysis.",
      table: attempts,
    });
  const hrLog = columns([
    "Date / time",
    "Status",
    "HR bpm",
    "Position",
    "Reason",
  ]);
  report.hrAttempts.forEach((a) =>
    addRow(hrLog, [
      `${a.date} ${new Date(a.time).toLocaleTimeString("en-GB", { timeZone: report.survey.timezone })}`,
      a.status,
      fmt(a.bpm, 0),
      a.position || "—",
      a.reason || "—",
    ]),
  );
  if (includeDetails && hrLog.tBodies[0].rows.length)
    sections.push({
      label: "HR measurement log",
      note: "Acquisition outcomes. Only eligible readings saved in a questionnaire enter statistical analyses.",
      table: hrLog,
    });
  const modelTable = columns([
    "Outcome",
    "Complete days",
    "Training / holdout",
    "Holdout MAE",
    "Baseline MAE",
    "Evidence",
  ]);
  for (const id of ["rhr", "focus"]) {
    const m = withinPlayerRidge(
      report.days
        .filter((d) => d.date >= report.from)
        .map((d) => ({
          date: d.date,
          x: MODEL_FEATURES.map((k) => d.values[k] as number),
          y: analysis.series[id].find((p) => p.date === d.date)
            ?.value as number,
        })),
    );
    addRow(modelTable, [
      id === "rhr" ? "Resting HR" : "Focus median",
      String(m.n),
      `${m.trainN} / ${m.testN}`,
      fmt(m.model?.mae, 2),
      fmt(m.model?.baselineMae, 2),
      m.reason ||
        (m.model!.mae < m.model!.baselineMae
          ? "Lower error on this holdout"
          : "No improvement over baseline"),
    ]);
  }
  sections.push({
    label: "Experimental within-player ridge model",
    note: "Same-day retrospective estimates from six wellness/sleep variables. Minimum 80 complete comparable days, latest 25% (at least 20) held out, seven-day purge gap, train-only scaling, fixed ridge penalty 10. Baseline is the training mean. Not externally validated; no injury/fatigue forecasts.",
    table: modelTable,
  });
  const pageW = doc.internal.pageSize.getWidth(),
    pageH = doc.internal.pageSize.getHeight(),
    margin = 22,
    pdfW = pageW - 2 * margin,
    pdfH = pageH - 2 * margin;
  let pageCount = 0;
  try {
    for (const section of sections) {
      const heading = make("h2", section.label);
      heading.style.cssText = "font-size:19px;margin:12px 4px 8px;";
      const note = make("p", section.note);
      note.style.cssText = "font-size:11px;margin:0 4px 12px;";
      root.replaceChildren(header, heading, note, section.table, footer);
      const heights = Array.from(section.table.tBodies[0].rows).map(
        (r) => r.getBoundingClientRect().height,
      );
      // Measure actual header, margins and padding rather than reserving arbitrary blank space.
      const reserve =
        root.getBoundingClientRect().height -
        heights.reduce((sum, height) => sum + height, 0);
      const available = (pdfH * 1200) / pdfW - reserve - 3;
      const pages = pdfRowPages(heights, available);
      for (const [part, rows] of pages.entries()) {
        const table = section.table.cloneNode(true) as HTMLTableElement;
        for (const [i, row] of Array.from(table.tBodies[0].rows).entries())
          if (!rows.includes(i)) row.remove();
        footer.textContent = `${range} | ${section.label} ${part + 1}/${pages.length} | Page ${pageCount + 1} | Generated ${new Date().toISOString()}`;
        root.replaceChildren(header, heading, note, table, footer);
        const height = Math.ceil(root.getBoundingClientRect().height),
          scale = Math.min(1.75, Math.sqrt(4_000_000 / (1200 * height)));
        const canvas = await html2canvas(root, {
          scale,
          backgroundColor: theme === "dark" ? "#0a1728" : "#ffffff",
          logging: false,
          windowWidth: 1500,
          scrollX: 0,
          scrollY: 0,
        });
        const imageH = (canvas.height / canvas.width) * pdfW;
        if (imageH > pdfH + 1)
          throw Error(
            "A report section does not fit. Choose a shorter range or try again.",
          );
        if (pageCount++) doc.addPage();
        if (theme === "dark") {
          doc.setFillColor("#0a1728");
          doc.rect(0, 0, pageW, pageH, "F");
        }
        doc.addImage(
          canvas,
          "PNG",
          margin,
          margin,
          pdfW,
          imageH,
          undefined,
          "FAST",
        );
        canvas.width = canvas.height = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").slice(0, 100);
    await doc.save(
      `Individual Wellness Report - ${safe} - ${report.from} to ${report.to}.pdf`,
      { returnPromise: true },
    );
  } finally {
    host.remove();
  }
}
