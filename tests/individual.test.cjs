const { test, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, "../src/lib"),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "individual-unit-")),
  seen = new Set();
function compile(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const source = fs.readFileSync(path.join(root, name + ".ts"), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  js = js.replace(/require\("([^"]+)"\)/g, (full, id) => {
    if (!id.startsWith(".") && !id.startsWith("@/lib/")) return full;
    const target = id.startsWith("@/lib/")
      ? id.slice(6)
      : path.relative(root, path.resolve(root, path.dirname(name), id));
    compile(target);
    let rel = path.relative(
      path.dirname(path.join(dir, name + ".js")),
      path.join(dir, target + ".js"),
    );
    if (!rel.startsWith(".")) rel = "./" + rel;
    return `require(${JSON.stringify(rel)})`;
  });
  const output = path.join(dir, name + ".js");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, js);
}
for (const name of [
  "individualStats",
  "individualReport",
  "individualAnalysis",
  "individualModel",
])
  compile(name);
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const { ranks, pearson, correlate, personalScore, sampleSd } = require(
    path.join(dir, "individualStats.js"),
  ),
  { buildIndividualReport } = require(path.join(dir, "individualReport.js")),
  { individualSeries } = require(path.join(dir, "individualAnalysis.js"));
const points = (values) =>
  values.map((value, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    value,
  }));
test("rank correlations use mean ranks for ties and preserve sign", () => {
  assert.deepEqual(ranks([10, 20, 20, 40]), [1, 2.5, 2.5, 4]);
  assert.equal(pearson([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
  const x = points([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(correlate(x, points(x.map((p) => -p.value))).r, -1);
  assert.equal(correlate(x, x).r, 1);
});
test("missing days, small samples, constants and nonfinite values never fabricate coefficients", () => {
  assert.equal(correlate(points([1, 2]), points([2, 3])).r, null);
  assert.equal(
    correlate(
      points(Array(12).fill(1)),
      points(Array.from({ length: 12 }, (_, i) => i)),
    ).reason,
    "No variation in one variable",
  );
  assert.equal(
    correlate(points([null, NaN, Infinity]), points([1, 2, 3])).n,
    0,
  );
});
test("lag is one calendar day, not the previous available observation", () => {
  const x = points(Array.from({ length: 15 }, (_, i) => i + 1)).filter(
      (p) => p.date !== "2026-09-07",
    ),
    y = points(Array.from({ length: 15 }, (_, i) => i * 2));
  const a = correlate(x, y, "pearson", 1);
  assert.equal(a.n, 13);
  assert.ok(a.pairs.every((p) => p.xDate !== p.date));
  assert.ok(!a.pairs.some((p) => p.date === "2026-09-08"));
  assert.ok(Math.abs(a.r - 1) < 1e-12);
});
test("daily changes require consecutive days on both sides, respecting the selected range", () => {
  const x = points([
    1,
    2,
    4,
    7,
    null,
    10,
    15,
    21,
    28,
    36,
    45,
    55,
    66,
    78,
    91,
    105,
  ]);
  const a = correlate(x, x, "spearman", 0, true);
  assert.equal(a.n, 13);
  assert.equal(a.r, 1);
  assert.ok(
    !a.pairs.some((p) =>
      ["2026-09-01", "2026-09-05", "2026-09-06"].includes(p.date),
    ),
  );
});
test("personal STEN excludes current/future days and uses a 28-calendar-day sample SD", () => {
  const history = points(Array.from({ length: 28 }, (_, i) => i + 1));
  const cur = { date: "2026-09-29", value: 29 };
  const score = personalScore(cur, [
    ...history,
    cur,
    { date: "2026-10-01", value: 10000 },
  ]);
  assert.equal(score.n, 28);
  assert.equal(score.mean, 14.5);
  assert.ok(Math.abs(score.sd - Math.sqrt(203 / 3)) < 1e-10);
  assert.equal(score.sten, 9);
  assert.ok(score.z > 1.7 && score.z < 1.8);
  assert.equal(personalScore({ ...cur, value: 1e9 }, history).sten, 10);
  assert.equal(personalScore({ ...cur, value: -1e9 }, history).sten, 1);
});
test("STEN remains unavailable for sparse, constant and missing baselines; duplicates count once", () => {
  const hist = points(Array(28).fill(70));
  assert.equal(personalScore({ date: "2026-09-29", value: 75 }, hist).z, null);
  assert.equal(
    personalScore({ date: "2026-09-29", value: 75 }, hist.slice(0, 13)).n,
    13,
  );
  assert.equal(
    personalScore({ date: "2026-09-29", value: null }, hist).sten,
    null,
  );
  assert.equal(
    personalScore({ date: "2026-09-29", value: 75 }, [...hist, ...hist]).n,
    28,
  );
  assert.equal(sampleSd([1]), null);
});
const survey = { id: "s", title: "Wellness", timezone: "Europe/Belgrade" },
  player = {
    id: "p",
    firstName: "Đorđe",
    lastName: "Test",
    image: null,
    isActive: true,
  };
const q = (id, text, type = "SLIDER", options = null) => ({
    id,
    text,
    type,
    options,
    order: 0,
  }),
  hrq = q(
    "hr",
    "Resting HR",
    "NUMBER",
    JSON.stringify({ widget: "RHR_CAMERA" }),
  ),
  fq = q("f", "Focus test", "PVT");
const answer = (question, value) => ({
  questionId: question.id,
  question,
  value: typeof value === "string" ? value : JSON.stringify(value),
});
const hr = (position = "lying") => ({
  kind: "RHR",
  bpm: 70,
  position,
  rested: true,
  quality: "ACCEPTED",
  measuredAt: "2026-10-17T08:00:00Z",
  protocolVersion: "v1",
  algorithmVersion: "a1",
  receipt: "private-hr-receipt",
});
const response = (id, time, answers) => ({
  id,
  playerId: "p",
  submittedAt: new Date(time),
  sessionType: null,
  matchDay: null,
  answers,
});
const session = (id, responseId) => ({
  id,
  playerId: "p",
  surveyId: "s",
  questionId: "f",
  responseId,
  localDate: "2026-10-17",
  startedAt: new Date("2026-10-17T08:00:00Z"),
  durationSeconds: 30,
  protocolVersion: "v1",
  practice: false,
  status: "COMPLETED",
  deviceId: "private-device",
  userAgent: "private-UA",
  context: { posture: "seated", caffeine: false },
  summary: { medianRT: 250, quality: "OK", repeatRequired: false },
});
const build = (responses, focus = []) =>
  buildIndividualReport({
    survey,
    player,
    from: "2026-10-17",
    to: "2026-10-18",
    responses,
    focus,
    mappings: {},
    focusAvailable: true,
  });
test("analysis uses latest response per survey-local day; all submissions remain in daily history", () => {
  const r = build([
    response("old", "2026-10-17T06:00Z", [answer(q("m", "Mood"), "3")]),
    response("new", "2026-10-17T08:00Z", [answer(q("m", "Mood"), "8")]),
    response("midnight", "2026-10-17T22:30Z", [answer(q("m", "Mood"), "6")]),
  ]);
  assert.equal(r.days.find((d) => d.date === "2026-10-17").values.mood, 8);
  assert.equal(r.days.find((d) => d.date === "2026-10-17").responseCount, 2);
  assert.equal(r.days.at(-1).values.mood, 6);
});
test("only exact linked Focus receipts enter analysis and private fields never reach the report", () => {
  const responses = [
      response("r", "2026-10-17T09:00Z", [
        answer(fq, { kind: "PVT", attemptId: "a", token: "private-token" }),
        answer(hrq, hr()),
      ]),
    ],
    r = build(responses, [session("a", "r")]);
  assert.equal(
    r.days.find((d) => d.date === "2026-10-17").readings.filter((x) => x.valid)
      .length,
    2,
  );
  for (const secret of [
    "private-device",
    "private-UA",
    "private-token",
    "private-hr-receipt",
  ])
    assert.equal(JSON.stringify(r).includes(secret), false);
  const bad = build(responses, [session("a", "other-response")]);
  assert.equal(
    bad.days.flatMap((d) => d.readings).some((x) => x.kind === "focus"),
    false,
  );
});
test("quality review, practice, unsubmitted and different-day readings are excluded from correlations", () => {
  for (const extra of [
    { practice: true },
    { summary: { medianRT: 150, quality: "REVIEW", repeatRequired: true } },
    { localDate: "2026-10-16" },
    { status: "REPEAT" },
  ]) {
    const r = build(
      [
        response("r", "2026-10-17T09:00Z", [
          answer(fq, { kind: "PVT", attemptId: "a" }),
        ]),
      ],
      [{ ...session("a", "r"), ...extra }],
    );
    assert.equal(
      r.days.flatMap((d) => d.readings).filter((x) => x.valid).length,
      0,
    );
  }
  const r = build([], [session("a", null)]);
  assert.equal(r.days.flatMap((d) => d.readings).length, 0);
  assert.equal(r.attempts[0].saved, false);
});
test("HR position/protocol changes produce distinct cohorts and missing answers stay null", () => {
  const r = build([
    response("r", "2026-10-17T09:00Z", [answer(hrq, hr())]),
    response("r2", "2026-10-18T09:00Z", [
      answer(hrq, { ...hr("seated"), measuredAt: "2026-10-18T08:00Z" }),
    ]),
  ]);
  assert.equal(r.groups.length, 2);
  const a = individualSeries(r, r.groups[0].id, "");
  assert.equal(a.series.rhr.find((p) => p.date === "2026-10-18").value, null);
  assert.equal(r.days[0].values.readiness, null);
});
test("Focus duration/device/context remain separate without exposing identifiers", () => {
  const r = build(
    [
      response("r", "2026-10-17T09:00Z", [
        answer(fq, { kind: "PVT", attemptId: "a" }),
      ]),
      response("r2", "2026-10-18T09:00Z", [
        answer(fq, { kind: "PVT", attemptId: "b" }),
      ]),
    ],
    [
      session("a", "r"),
      {
        ...session("b", "r2"),
        localDate: "2026-10-18",
        durationSeconds: 60,
        startedAt: new Date("2026-10-18T08:00Z"),
      },
    ],
  );
  assert.equal(r.groups.length, 2);
});
test("custom numeric answers and body-map locations remain visible, without turning missing pain into zero", () => {
  const r = build([
    response("r", "2026-10-17T09:00Z", [
      answer(q("custom", "Bodyweight", "NUMBER"), "82.5"),
      answer(q("pain", "Painful Areas", "BODY_MAP"), {
        "path-7": { rating: 4, location: "muscle_belly", when: ["at_rest"] },
      }),
    ]),
  ]);
  const day = r.days.find((d) => d.date === "2026-10-17");
  assert.equal(day.values["question:custom"], 82.5);
  assert.equal(day.values.painMax, 4);
  assert.equal(day.zones[0].rating, 4);
  assert.ok(day.responses[0].answers.some((a) => a.text.includes("At rest")));
  assert.equal(r.days.at(-1).values.painMax, null);
});

compile("individualModel");

const { withinPlayerRidge } = require(path.join(dir, "individualModel.js"));
const modelRows = Array.from({ length: 120 }, (_, i) => {
  const d = new Date("2026-01-01T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + i);
  const x = Array.from(
    { length: 6 },
    (_, j) => Math.sin(i / (3 + j)) + (i % (j + 3)),
  );
  return {
    date: d.toISOString().slice(0, 10),
    x,
    y: 60 + 3 * x[0] - 2 * x[1] + x[2],
  };
});
test("ridge uses a chronological holdout with a calendar gap and outperforms the mean for a linear signal", () => {
  const r = withinPlayerRidge(modelRows);
  assert.ok(r.model);
  assert.ok(r.trainN >= 45);
  assert.equal(r.testN, 30);
  assert.ok(r.model.mae < r.model.baselineMae);
  assert.ok(
    (Date.parse(r.model.testFrom) - Date.parse(r.model.trainTo)) / 86400000 >=
      8,
  );
});
test("holdout outcomes and future feature scaling cannot leak into training", () => {
  const a = withinPlayerRidge(modelRows),
    b = withinPlayerRidge(
      modelRows.map((r, i) =>
        i >= 90 ? { ...r, y: 1e5, x: r.x.map((v) => v + 1000) } : r,
      ),
    );
  assert.deepEqual(a.model.coefficients, b.model.coefficients);
  assert.deepEqual(a.model.means, b.model.means);
  assert.deepEqual(a.model.sds, b.model.sds);
  assert.notEqual(a.model.mae, b.model.mae);
});
test("ridge gates small, constant and missing datasets rather than inventing results", () => {
  assert.equal(withinPlayerRidge(modelRows.slice(0, 50)).model, null);
  assert.equal(
    withinPlayerRidge(modelRows.map((r) => ({ ...r, y: 70 }))).model,
    null,
  );
  assert.equal(
    withinPlayerRidge(
      modelRows.map((r) => ({ ...r, x: [null, 1, 2, 3, 4, 5] })),
    ).n,
    0,
  );
});

test("ridge coefficients agree with an independent NumPy linear-system reference", () => {
  const model = withinPlayerRidge(modelRows).model;
  const expected = [
    2.8469940857384373, -2.3206655867091226, 1.408432187161733,
    0.0941663355828149, -0.005676978996927758, -0.11015252083962175,
  ];
  model.coefficients.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) < 1e-10),
  );
});
test("free text retains JSON-looking content instead of being mistaken for a measurement payload", () => {
  const value = '{"training":"gym","note":"felt good"}';
  const report = build([
    response("text", "2026-10-17T09:00Z", [
      answer(q("text", "Training note", "TEXT"), value),
    ]),
  ]);
  assert.equal(
    report.days.find((d) => d.date === "2026-10-17").responses[0].answers[0]
      .text,
    value,
  );
});

test('Focus mean, CV and slow-response series use original trials from the selected valid setup only', () => {
  const s=session('focus-analysis','r')
  s.raw={trials:[200,300,400,500].map((rtMs,i)=>({kind:'response',onsetMs:1000+i*5000,atMs:1000+i*5000+rtMs,rtMs,waitMs:1000})),elapsedMs:30000,maxFrameGapMs:16,interruption:null}
  const r=build([response('r','2026-10-17T08:01:00Z',[answer(fq,{kind:'PVT',attemptId:s.id})])],[s])
  const group=r.groups.find(g=>g.kind==='focus').id, data=individualSeries(r,'',group)
  assert.equal(data.series.focusMean.find(p=>p.date==='2026-10-17').value,350)
  assert.equal(data.series.focusSlow.find(p=>p.date==='2026-10-17').value,50)
  assert.ok(data.series.focusCV.find(p=>p.date==='2026-10-17').value>30)
  assert.ok(!JSON.stringify(r).includes('onsetMs'))
  assert.equal(individualSeries(r,'','wrong-setup').stats.find(x=>x.id==='focusCV').n,0)
  const old=build([response('r','2026-10-17T08:01:00Z',[answer(fq,{kind:'PVT',attemptId:s.id})])],[{...s,raw:null}])
  assert.equal(individualSeries(old,'',group).stats.find(x=>x.id==='focusCV').n,0)
})
