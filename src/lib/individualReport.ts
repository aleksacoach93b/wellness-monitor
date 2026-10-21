import { parseDayMetrics, type ParseDayMetricsOptions } from "./opsWellness";
import { isRhrQuestion, parseRhrAnswer } from "./rhr/options";
import { parsePvtAnswer } from "./pvt/options";
import {
  bodyMapAreaSide,
  getBodyMapLocationLabel,
  getBodyMapRating,
  getBodyMapWhenLabels,
} from "./bodyMapPainLocation";
import { getMuscleName } from "./muscleNames";
import { zonedDay, shiftDay, recentDays } from "./opsDates";
import { finite } from "./individualStats";
import { focusAnalysisFromRaw } from "./pvt/analysis";
export type IndividualQuestion = {
  id: string;
  text: string;
  type: string;
  options: string | null;
  order: number;
};
export type IndividualResponse = {
  id: string;
  playerId: string | null;
  submittedAt: Date;
  sessionType: string | null;
  matchDay: string | null;
  answers: {
    questionId: string;
    value: string;
    question: IndividualQuestion;
  }[];
};
export type IndividualFocus = {
  raw?: unknown;
  id: string;
  playerId: string;
  surveyId: string;
  questionId: string | null;
  responseId: string | null;
  localDate: string;
  startedAt: Date;
  durationSeconds: number;
  protocolVersion: string;
  practice: boolean;
  status: string;
  deviceId: string;
  userAgent: string;
  context: unknown;
  summary: unknown;
};
export type IndividualMetric = {
  id: string;
  label: string;
  unit: string;
  color: string;
};
export type IndividualReading = {
  attemptId?: string;
  focusMetrics?: {
    meanRT: number | null;
    cvRT: number | null;
    slowPercent: number | null;
  };
  questionId: string;
  kind: "rhr" | "focus";
  group: string;
  value: number | null;
  valid: boolean;
  note: string;
  context: string;
  measuredAt: string;
};
export type IndividualZone = {
  id: string;
  label: string;
  kind: "pain" | "soreness";
  rating: number;
  side: "front" | "back";
  location: string | null;
  when: string[];
};
export type IndividualDay = {
  date: string;
  submittedAt: string | null;
  responseCount: number;
  values: Record<string, number | null>;
  readings: IndividualReading[];
  zones: IndividualZone[];
  responses: {
    submittedAt: string;
    sessionType: string | null;
    matchDay: string | null;
    answers: { question: string; text: string }[];
  }[];
};
export type IndividualReport = {
  survey: { id: string; title: string; timezone: string };
  player: {
    id: string;
    firstName: string;
    lastName: string;
    image: string | null;
    isActive: boolean;
  };
  from: string;
  to: string;
  metrics: IndividualMetric[];
  groups: {
    id: string;
    kind: "rhr" | "focus";
    label: string;
    details: string;
    count: number;
  }[];
  days: IndividualDay[];
  focusAvailable: boolean;
  hrTrackingAvailable: boolean;
  hrAttempts: {
    date: string;
    time: string;
    status: string;
    bpm: number | null;
    position: string | null;
    reason: string | null;
  }[];
  attempts: {
    id: string;
    date: string;
    time: string;
    duration: number;
    status: string;
    quality: string;
    practice: boolean;
    saved: boolean;
    median: number | null;
  }[];
};
export const CORE_METRICS: IndividualMetric[] = [
  { id: "readiness", label: "Readiness", unit: "/10", color: "#6ee7b7" },
  { id: "sleepHours", label: "Sleep duration", unit: "h", color: "#a5b4fc" },
  { id: "sleepQuality", label: "Sleep quality", unit: "/10", color: "#93c5fd" },
  { id: "fatigue", label: "Energy / fatigue", unit: "/10", color: "#fcd34d" },
  { id: "soreness", label: "Soreness score", unit: "/10", color: "#fda4af" },
  { id: "mood", label: "Mood", unit: "/10", color: "#c4b5fd" },
  { id: "stress", label: "Stress score", unit: "/10", color: "#67e8f9" },
  { id: "painMax", label: "Peak pain", unit: "/10", color: "#fb923c" },
];
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function hours(value: string | null) {
  if (!value) return null;
  const m = value.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*m)?$/i);
  const n = m ? Number(m[1]) + Number(m[2] || 0) / 60 : null;
  return n !== null && finite(n) && n <= 24 ? n : null;
}
function numeric(value: string) {
  const s = value.trim();
  const n = Number(s);
  return s && finite(n) ? n : null;
}
function answerText(
  a: IndividualResponse["answers"][number],
  readings: IndividualReading[],
  zones: IndividualZone[],
) {
  if (isRhrQuestion(a.question)) {
    const r = parseRhrAnswer(a.value);
    return r
      ? `${r.bpm} bpm · ${r.position} · ${r.quality}`
      : "No accepted reading";
  }
  if (a.question.type === "PVT") {
    const r = parsePvtAnswer(a.value),
      reading = readings.find(
        (x) => x.kind === "focus" && x.questionId === a.questionId,
      );
    return r
      ? reading
        ? `${reading.value ?? "—"} ms · ${reading.context} · ${reading.note}`
        : "Saved receipt · linked result unavailable"
      : "No completed result";
  }
  if (a.question.type === "BODY_MAP") {
    const kind = a.question.text.toLowerCase().includes("sore")
      ? "soreness"
      : "pain";
    const entries = zones.filter((z) => z.kind === kind);
    return entries.length
      ? entries
          .map(
            (z) =>
              `${z.label}: ${z.rating}/10${z.location ? " · " + z.location : ""}${z.when.length ? " · " + z.when.join(", ") : ""}`,
          )
          .join("; ")
      : a.value.trim().startsWith("{")
        ? "No areas reported"
        : a.value;
  }
  if (a.question.type === "TEXT" || a.question.type === "EMAIL") return a.value;
  try {
    const x: unknown = JSON.parse(a.value);
    if (Array.isArray(x)) return x.map(String).join(", ");
    if (x && typeof x === "object") return "Structured response";
  } catch {}
  return a.value;
}
/** One latest submitted questionnaire per local day for analysis; retain every submission for drill-down. */
export function buildIndividualReport(args: {
  survey: IndividualReport["survey"];
  player: IndividualReport["player"];
  from: string;
  to: string;
  responses: IndividualResponse[];
  focus: IndividualFocus[];
  mappings: ParseDayMetricsOptions;
  focusAvailable: boolean;
  hrTrackingAvailable?: boolean;
  hrAttempts?: IndividualReport["hrAttempts"];
}): IndividualReport {
  const { survey, player, from, to, focus } = args;
  const sessions = new Map(focus.map((s) => [s.id, s]));
  const definitions = new Map<string, IndividualMetric>(
    CORE_METRICS.map((m) => [m.id, m]),
  );
  const groups: IndividualReport["groups"] = [],
    groupKeys = new Map<string, string>();
  const groupFor = (
    kind: "rhr" | "focus",
    key: string,
    label: string,
    details: string,
  ) => {
    let id = groupKeys.get(key);
    if (!id) {
      id = `${kind}-${groupKeys.size + 1}`;
      groupKeys.set(key, id);
      groups.push({ id, kind, label, details, count: 0 });
    }
    return id;
  };
  const rows = new Map<string, IndividualResponse[]>();
  for (const r of [...args.responses].sort(
    (a, b) =>
      b.submittedAt.getTime() - a.submittedAt.getTime() ||
      b.id.localeCompare(a.id),
  )) {
    if (r.playerId !== player.id) continue;
    const d = zonedDay(r.submittedAt, survey.timezone);
    if (d < shiftDay(from, -28) || d > to) continue;
    rows.set(d, [...(rows.get(d) || []), r]);
  }
  const first = shiftDay(from, -28),
    count = Math.round((Date.parse(to) - Date.parse(first)) / 86400000) + 1;
  const days = recentDays(to, count).map((date): IndividualDay => {
    const submissions = rows.get(date) || [],
      latest = submissions[0];
    const values: IndividualDay["values"] = Object.fromEntries(
      CORE_METRICS.map((m) => [m.id, null]),
    );
    const parse = (r: IndividualResponse) => {
      const metrics = parseDayMetrics(r.answers, args.mappings),
        zones: IndividualZone[] = [];
      for (const kind of ["pain", "soreness"] as const)
        for (const [id, stored] of Object.entries(
          kind === "pain" ? metrics.painAreas : metrics.sorenessAreas,
        )) {
          const rating = getBodyMapRating(stored);
          if (rating > 0)
            zones.push({
              id,
              label: getMuscleName(id),
              kind,
              rating,
              side: bodyMapAreaSide(id),
              location: getBodyMapLocationLabel(stored),
              when: getBodyMapWhenLabels(stored),
            });
        }
      const readings: IndividualReading[] = [];
      for (const a of [...r.answers].sort(
        (a, b) => a.question.order - b.question.order,
      )) {
        if (isRhrQuestion(a.question)) {
          const h = parseRhrAnswer(a.value);
          if (!h) continue;
          const context = `${a.question.text} · ${h.position || "Unknown position"}`;
          const group = groupFor(
            "rhr",
            JSON.stringify([
              "rhr",
              a.questionId,
              h.position,
              h.protocolVersion,
              h.algorithmVersion || "",
            ]),
            context,
            [h.protocolVersion, h.algorithmVersion].filter(Boolean).join(" / "),
          );
          let sameDay = false;
          try {
            sameDay =
              zonedDay(new Date(h.measuredAt), survey.timezone) === date;
          } catch {}
          const valid = h.rested === true && sameDay && !!h.position;
          readings.push({
            questionId: a.questionId,
            kind: "rhr",
            group,
            value: h.bpm,
            valid,
            note: valid
              ? "Accepted · saved with wellness"
              : !sameDay
                ? "Measured on another day · excluded"
                : "Rest / position not confirmed · excluded",
            context,
            measuredAt: h.measuredAt,
          });
        } else if (a.question.type === "PVT") {
          const receipt = parsePvtAnswer(a.value),
            s = receipt ? sessions.get(receipt.attemptId) : undefined;
          if (
            !s ||
            s.responseId !== r.id ||
            s.questionId !== a.questionId ||
            s.playerId !== player.id ||
            s.surveyId !== survey.id
          )
            continue;
          const c = object(s.context),
            summary = object(s.summary);
          const context = `${a.question.text} · ${s.durationSeconds}s · ${String(c.posture || "Unknown position")} · ${c.caffeine === true ? "Caffeine" : c.caffeine === false ? "No caffeine" : "Caffeine unknown"}`;
          const group = groupFor(
            "focus",
            JSON.stringify([
              "focus",
              a.questionId,
              s.durationSeconds,
              s.protocolVersion,
              s.deviceId,
              s.userAgent,
              c.posture,
              c.caffeine,
            ]),
            context,
            `${s.protocolVersion} · Consistent device/browser setup`,
          );
          const value =
            finite(summary.medianRT) && summary.medianRT > 0
              ? summary.medianRT
              : null;
          const valid =
            !s.practice &&
            s.status === "COMPLETED" &&
            summary.quality === "OK" &&
            summary.repeatRequired !== true &&
            value !== null &&
            s.localDate === date;
          readings.push({
            attemptId: s.id,
            focusMetrics: (() => {
              const a = focusAnalysisFromRaw(s.raw, s.durationSeconds);
              return a
                ? { meanRT: a.meanRT, cvRT: a.cvRT, slowPercent: a.slowPercent }
                : undefined;
            })(),
            questionId: a.questionId,
            kind: "focus",
            group,
            value,
            valid,
            note: valid
              ? "OK · saved with wellness"
              : "Review / practice / different day · excluded",
            context,
            measuredAt: s.startedAt.toISOString(),
          });
        }
      }
      return { metrics, zones, readings };
    };
    const latestData = latest ? parse(latest) : null;
    if (latestData) {
      for (const key of [
        "readiness",
        "sleepQuality",
        "fatigue",
        "soreness",
        "mood",
        "stress",
      ] as const)
        values[key] = latestData.metrics[key];
      values.sleepHours = hours(latestData.metrics.sleepDuration);
      values.painMax = latest.answers.some((a) => {
        if (
          a.question.type !== "BODY_MAP" ||
          !/pain|bol/i.test(a.question.text)
        )
          return false;
        if (/^(no|false)$/i.test(a.value.trim())) return true;
        try {
          const x = JSON.parse(a.value);
          return !!x && typeof x === "object" && !Array.isArray(x);
        } catch {
          return false;
        }
      })
        ? Math.max(
            0,
            ...latestData.zones
              .filter((z) => z.kind === "pain")
              .map((z) => z.rating),
          )
        : null;
      for (const a of latest.answers) {
        if (
          !["SLIDER", "RATING_SCALE", "SCALE", "NUMBER", "RPE"].includes(
            a.question.type,
          ) ||
          isRhrQuestion(a.question)
        )
          continue;
        const single = parseDayMetrics([a], args.mappings);
        if (
          [
            "readiness",
            "sleepQuality",
            "fatigue",
            "soreness",
            "mood",
            "stress",
          ].some((k) => single[k as keyof typeof single] !== null)
        )
          continue;
        const id = `question:${a.questionId}`;
        definitions.set(id, {
          id,
          label: a.question.text,
          unit: "",
          color: "#c4b5fd",
        });
        values[id] = numeric(a.value);
      }
    }
    const responses = submissions.map((r, i) => {
      const info = i === 0 ? latestData! : parse(r);
      return {
        submittedAt: r.submittedAt.toISOString(),
        sessionType: r.sessionType,
        matchDay: r.matchDay,
        answers: [...r.answers]
          .sort((a, b) => a.question.order - b.question.order)
          .map((a) => ({
            question: a.question.text,
            text: answerText(a, info.readings, info.zones),
          })),
      };
    });
    return {
      date,
      submittedAt: latest?.submittedAt.toISOString() || null,
      responseCount: submissions.length,
      values,
      readings: latestData?.readings || [],
      zones: latestData?.zones || [],
      responses: date >= from ? responses : [],
    };
  });
  for (const group of groups)
    group.count = days.filter(
      (d) =>
        d.date >= from &&
        d.readings.some((r) => r.group === group.id && r.valid),
    ).length;
  // Opaque setup numbers keep private device/browser identifiers out of the API.
  for (const kind of ["rhr", "focus"] as const)
    groups
      .filter((g) => g.kind === kind)
      .forEach((g, i) => {
        g.label += ` · Setup ${i + 1}`;
      });
  return {
    survey,
    player,
    from,
    to,
    metrics: [...definitions.values()],
    groups,
    days,
    focusAvailable: args.focusAvailable,
    hrTrackingAvailable: args.hrTrackingAvailable ?? true,
    hrAttempts: args.hrAttempts || [],
    attempts: focus
      .filter(
        (s) =>
          s.playerId === player.id &&
          s.surveyId === survey.id &&
          s.localDate >= from &&
          s.localDate <= to,
      )
      .map((s) => {
        const summary = object(s.summary);
        return {
          id: s.id,
          date: s.localDate,
          time: s.startedAt.toISOString(),
          duration: s.durationSeconds,
          status: s.status,
          quality: String(summary.quality || "—"),
          practice: s.practice,
          saved:
            !!s.responseId &&
            args.responses.some(
              (r) =>
                r.id === s.responseId &&
                r.playerId === player.id &&
                r.answers.some(
                  (a) =>
                    a.questionId === s.questionId &&
                    parsePvtAnswer(a.value)?.attemptId === s.id,
                ),
            ),
          median: finite(summary.medianRT) ? summary.medianRT : null,
        };
      }),
  };
}
