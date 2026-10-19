// Isolated synthetic history. Never run against production.
import fs from "node:fs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
const base = process.env.PVT_TEST_BASE_URL,
  database = process.env.PVT_TEST_DATABASE_URL;
if (
  !base ||
  !database ||
  new URL(base).hostname !== "127.0.0.1" ||
  new URL(database).hostname !== "127.0.0.1"
)
  throw Error("Explicit loopback URLs required");
const db = new PrismaClient({ datasourceUrl: database }),
  teamId = "individual-fixture-team",
  surveyId = "individual-fixture-survey",
  playerId = "individual-fixture-player",
  other = "individual-fixture-outside";
const token = await new SignJWT({
  email: "individual@example.invalid",
  role: "TEAM_ADMIN",
  teamId,
})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("individual-fixture-admin")
  .setIssuedAt()
  .setExpirationTime("4h")
  .sign(new TextEncoder().encode("pvt-local-test-only"));
const q = (id, text, type = "SLIDER", options = null, order = 0) => ({
  id,
  text,
  type,
  options,
  order,
  required: false,
});
const questions = [
  q("ind-hr", "Resting HR", "NUMBER", JSON.stringify({ widget: "RHR_CAMERA" })),
  q("ind-focus", "Focus test", "PVT"),
  q("ind-sleep", "Sleep quality"),
  q("ind-bed", "What time did you go to sleep?", "TIME"),
  q("ind-wake", "What time did you wake up?", "TIME"),
  q("ind-fatigue", "How fatigued do you feel today?"),
  q("ind-sore", "Soreness"),
  q("ind-mood", "Mood"),
  q("ind-stress", "Stress"),
  q("ind-pain", "Painful Areas", "BODY_MAP"),
  q("ind-comment", "Comments", "TEXT"),
  q("ind-custom", "Bodyweight", "NUMBER"),
];
let checks = 0;
const check = (v, msg) => {
  assert.ok(v, msg);
  checks++;
};
async function req(query = "", auth = true) {
  const r = await fetch(base + "/api/ops/individual?" + query, {
    headers: auth ? { Cookie: "wm_admin_session=" + token } : {},
  });
  return {
    status: r.status,
    body: await r.json(),
    cache: r.headers.get("cache-control"),
  };
}
try {
  for (const [id, name] of [
    [teamId, "Individual Test Team"],
    [other, "Individual Outside Fixture"],
  ]) {
    const existing = await db.team.findUnique({ where: { id } });
    if (existing && existing.name !== name)
      throw Error("Fixture ownership mismatch");
    await db.team.upsert({ where: { id }, create: { id, name }, update: {} });
  }
  await db.survey.deleteMany({ where: { id: surveyId, teamId } });
  await db.player.upsert({
    where: { id: playerId },
    create: {
      id: playerId,
      teamId,
      firstName: "Đorđe",
      lastName: "Čović",
      password: "TEST",
    },
    update: {},
  });
  await db.player.upsert({
    where: { id: "individual-fixture-empty" },
    create: {
      id: "individual-fixture-empty",
      teamId,
      firstName: "Empty",
      lastName: "History",
      password: "TEST",
      isActive: false,
    },
    update: {},
  });
  await db.player.upsert({
    where: { id: "individual-fixture-other-player" },
    create: {
      id: "individual-fixture-other-player",
      teamId: other,
      firstName: "Other",
      lastName: "Team",
      password: "TEST",
    },
    update: {},
  });
  await db.survey.create({
    data: {
      id: surveyId,
      teamId,
      title: "Individual Wellness Fixture",
      createdBy: "individual-fixture-admin",
      timezone: "Europe/Belgrade",
      questions: { create: questions },
    },
  });
  const end = new Date("2026-10-18T12:00:00Z");
  for (let i = 0; i < 120; i++) {
    if (i === 99) continue;
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() + i - 119);
    const day = date.toISOString().slice(0, 10),
      responseId = `ind-response-${i}`,
      focusId = `ind-focus-${i}`,
      bpm = 62 + Math.round(5 * Math.sin(i / 4)) + (i % 3),
      position = i % 9 === 0 ? "seated" : "lying",
      duration = i % 11 === 0 ? 60 : 30;
    const pairs = [
      [
        "ind-hr",
        {
          kind: "RHR",
          bpm,
          position,
          rested: true,
          quality: "ACCEPTED",
          measuredAt: day + "T07:59:00Z",
          durationSeconds: 15,
          protocolVersion: "camera-rhr-v4",
          algorithmVersion: "fixture",
          fps: 30,
          receipt: "fixture-private-hr-token",
        },
      ],
      [
        "ind-focus",
        {
          kind: "PVT",
          attemptId: focusId,
          token: "fixture-private-focus-token",
        },
      ],
      ["ind-sleep", String(4 + (i % 6))],
      ["ind-bed", "23:15"],
      ["ind-wake", i % 3 ? "07:10" : "06:30"],
      ["ind-fatigue", String(4 + ((i * 3) % 7))],
      ["ind-sore", String(5 + (i % 5))],
      ["ind-mood", String(5 + ((i * 2) % 6))],
      ["ind-stress", String(4 + ((i * 5) % 7))],
      [
        "ind-pain",
        i % 8 === 0
          ? {
              "path-7": {
                rating: 3 + (i % 5),
                location: "muscle_belly",
                when: ["at_rest"],
              },
            }
          : "No",
      ],
      [
        "ind-comment",
        i === 119 ? "Slept well. Ready for training." : "Normal training day.",
      ],
      ["ind-custom", String(80 + i * 0.01)],
    ];
    await db.response.create({
      data: {
        id: responseId,
        surveyId,
        playerId,
        submittedAt: new Date(day + "T08:10:00Z"),
        matchDay: i % 6 === 0 ? "MD-1" : null,
        answers: {
          create: pairs.map(([questionId, value]) => ({
            questionId,
            value: typeof value === "string" ? value : JSON.stringify(value),
          })),
        },
      },
    });
    await db.pvtSession.create({
      data: {
        id: focusId,
        teamId,
        surveyId,
        playerId,
        questionId: "ind-focus",
        responseId,
        tokenHash: "fixture-private-hash",
        durationSeconds: duration,
        protocolVersion: "handheld-pvt-v5",
        practice: false,
        status: "COMPLETED",
        localDate: day,
        startedAt: new Date(day + "T08:00:00Z"),
        finishedAt: new Date(day + "T08:00:30Z"),
        deviceId:
          i === 115 ? "fixture-private-device-b" : "fixture-private-device-a",
        userAgent: "fixture-private-user-agent",
        context: { posture: "seated", caffeine: false, minutesAwake: 45 },
        summary: {
          medianRT: 245 + (bpm - 62) * 3 + (i % 4),
          quality: i % 13 === 0 ? "REVIEW" : "OK",
          repeatRequired: i % 13 === 0,
          responses: 8,
          falseStarts: 0,
        },
      },
    });
  }
  await db.response.create({
    data: {
      id: "ind-earlier-response",
      surveyId,
      playerId,
      submittedAt: new Date("2026-10-18T06:00:00Z"),
      answers: { create: [{ questionId: "ind-mood", value: "1" }] },
    },
  });
  await db.pvtSession.create({
    data: {
      id: "ind-unsaved-practice",
      teamId,
      surveyId,
      playerId,
      questionId: "ind-focus",
      tokenHash: "private",
      durationSeconds: 30,
      protocolVersion: "handheld-pvt-v5",
      practice: true,
      status: "COMPLETED",
      localDate: "2026-10-18",
      startedAt: new Date("2026-10-18T07:30:00Z"),
      deviceId: "practice-device",
      userAgent: "practice-UA",
      context: { posture: "seated", caffeine: false },
      summary: { medianRT: 150, quality: "OK" },
    },
  });
  await db.rhrObservation.create({
    data: {
      id: "individual-hr-attempt",
      teamId,
      surveyId,
      playerId,
      questionId: "ind-hr",
      localDate: "2026-10-18",
      startedAt: new Date("2026-10-18T07:59:00Z"),
      status: "ACCEPTED",
      source: "SERVER",
      position: "lying",
      protocolVersion: "camera-rhr-v4",
      platform: "iOS",
      browser: "Safari",
      bpm: 70,
    },
  });
  const full = `surveyId=${surveyId}&playerId=${playerId}&from=2026-09-21&to=2026-10-18`;
  check((await req(full, false)).status === 401, "authentication required");
  check(
    (await req(full.replace(surveyId, "outside-survey"))).status === 404,
    "other survey hidden",
  );
  check(
    (await req(full.replace(playerId, "individual-fixture-other-player")))
      .status === 404,
    "other player hidden",
  );
  for (const change of [
    full.replace("2026-09-21", "2026-02-30"),
    full.replace("2026-09-21", "2026-10-19"),
    full.replace("2026-09-21", "2020-01-01"),
    full.replace("2026-10-18", "2099-01-01"),
  ])
    check(
      (await req(change)).status === 400,
      "invalid, reversed, overlong, future ranges rejected",
    );
  const roster = await req(`surveyId=${surveyId}`);
  check(
    roster.status === 200 && roster.body.players.length === 2,
    "roster scoped and inactive history accessible",
  );
  check(
    !JSON.stringify(roster.body).includes("password"),
    "roster excludes password",
  );
  const x = await req(full);
  check(x.status === 200, "report available");
  check(x.cache.includes("no-store"), "private report not cached");
  check(
    x.body.days.length === 56,
    "28-day baseline fetched before selected 28 days",
  );
  check(
    x.body.days.find((d) => d.date === "2026-10-18").responseCount === 2,
    "all same-day submissions retained",
  );
  check(
    x.body.days.find((d) => d.date === "2026-10-18").values.mood !== 1,
    "latest daily answers used",
  );
  check(
    x.body.days.find((d) => d.date === "2026-09-28").submittedAt === null,
    "missing calendar day retained",
  );
  check(
    x.body.groups.filter((g) => g.kind === "rhr").length === 2,
    "HR postures separated",
  );
  check(
    x.body.groups.filter((g) => g.kind === "focus").length >= 3,
    "Focus device and durations separated",
  );
  for (const secret of [
    "fixture-private-device",
    "fixture-private-user-agent",
    "fixture-private-focus-token",
    "fixture-private-hr-token",
    "tokenHash",
    "password",
  ])
    check(
      !JSON.stringify(x.body).includes(secret),
      "private measurement fields not exposed",
    );
  check(
    x.body.attempts.some((a) => a.practice && !a.saved),
    "unsaved practice visible in audit only",
  );
  check(x.body.hrAttempts.length === 1, "HR acquisition history available");
  check(
    x.body.metrics.some((m) => m.id === "question:ind-custom"),
    "custom numeric variable supported",
  );
  const empty = await req(full.replace(playerId, "individual-fixture-empty"));
  check(
    empty.status === 200 && empty.body.days.every((d) => !d.submittedAt),
    "empty historical player supported",
  );
  fs.writeFileSync(
    "/tmp/individual-test-context.json",
    JSON.stringify({
      surveyId,
      playerId,
      admin: token,
      from: "2026-09-21",
      to: "2026-10-18",
    }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    "/tmp/individual-fixture-report.json",
    JSON.stringify(x.body),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ passed: true, checks, localFixtureOnly: true }));
} finally {
  await db.$disconnect();
}
