/** Real HTTP + isolated synthetic PostgreSQL only. No production credentials or writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
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
  throw Error("Explicit loopback fixture URLs required");
const db = new PrismaClient({ datasourceUrl: database }),
  teamId = "individual-fixture-team",
  otherTeam = "other-team";
const password = "Synthetic-staff-only-2026",
  nextPassword = "Synthetic-changed-only-2026";
const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36",
  ip = "198.51.100.10";
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
};
async function token(sub, teamId) {
  return new SignJWT({
    email: sub + "@example.invalid",
    role: "TEAM_ADMIN",
    teamId,
  })
    .setSubject(sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode("pvt-local-test-only"));
}
const adminToken = await token("share-fixture-admin", teamId),
  otherToken = await token("share-other-admin", otherTeam);
async function req(
  path,
  {
    admin,
    cookie,
    method = "GET",
    body,
    address = ip,
    agent = ua,
    origin = base,
    extra = {},
  } = {},
) {
  const headers = { "user-agent": agent, "x-forwarded-for": address, ...extra };
  if (admin)
    headers.Cookie =
      "wm_admin_session=" + (admin === "other" ? otherToken : adminToken);
  if (cookie)
    headers.Cookie = (headers.Cookie ? headers.Cookie + "; " : "") + cookie;
  if (method !== "GET") {
    if (origin) headers.Origin = origin;
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(base + path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return {
    status: r.status,
    body: data,
    text,
    headers: r.headers,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const config = (body, options = {}) =>
  req("/api/ops/sharing", { admin: true, method: "POST", body, ...options });
const login = (link, pwd = password, options = {}) =>
  req(`/api/live-ops-share/${link.token}/login`, {
    method: "POST",
    body: { password: pwd },
    ...options,
  });
const read = (link, action, cookie, options = {}) =>
  req(`/api/live-ops-share/${link.token}/${action}`, { cookie, ...options });
const settings = (pwd = password, enabled = true) =>
  config({ action: "settings", password: pwd, enabled, sessionHours: 4 });
async function newLink(label = "Synthetic head coach") {
  const r = await config({ action: "create-link", label, days: 7 });
  check(r.status === 200, "create named link");
  return (await req("/api/ops/sharing", { admin: true })).body.links.find(
    (x) => x.label === label,
  );
}
async function snapshot() {
  return Promise.all(
    [
      "response",
      "answer",
      "pvtSession",
      "rhrObservation",
      "opsRule",
      "opsIntervention",
      "opsMetric",
      "kioskSettings",
      "adminAccessSettings",
    ].map((name) => db[name].count()),
  );
}
try {
  for (const [id, team] of [
    ["share-fixture-admin", teamId],
    ["share-other-admin", otherTeam],
  ]) {
    await db.adminUser.upsert({
      where: { id },
      create: {
        id,
        email: id + "@example.invalid",
        passwordHash: "not-used-in-this-fixture",
        memberships: { create: { teamId: team, role: "OWNER" } },
      },
      update: { isActive: true },
    });
  }
  await db.question.updateMany({
    where: { surveyId: "individual-fixture-survey" },
    data: { createdAt: new Date("2026-01-01T00:00:00Z") },
  });
  await db.opsShareSettings.deleteMany({ where: { teamId } }).catch(() => {});
  await db.opsShareEvent.deleteMany({ where: { teamId } }).catch(() => {});
  await db.opsShareBlockedIp.deleteMany({ where: { teamId } }).catch(() => {});
  await db.opsShareAuthWindow.deleteMany().catch(() => {});
  check(
    (await req("/api/ops/sharing")).status === 401,
    "settings require administrator",
  );
  const initial = await req("/api/ops/sharing", { admin: true });
  check(
    initial.status === 200 && !initial.body.settings.enabled,
    "sharing defaults disabled and additive schema works",
  );
  check(
    (await config({ action: "settings", enabled: true, sessionHours: 4 }))
      .status === 400,
    "cannot enable without password",
  );
  check(
    (
      await config({
        action: "settings",
        password: "short",
        enabled: true,
        sessionHours: 4,
      })
    ).status === 400,
    "weak password rejected",
  );
  check((await settings()).status === 200, "enable protected sharing");
  const stored = await db.opsShareSettings.findUnique({ where: { teamId } });
  check(
    stored.passwordHash.startsWith("$2") && stored.passwordHash !== password,
    "bcrypt hash stored instead of password",
  );
  const link = await newLink();
  check(link.token.length === 43, "unpredictable random link");
  check(
    (await read(link, "today")).status === 401,
    "link alone cannot read data",
  );
  check(
    (await read(link, "today", undefined, { admin: true })).status === 401,
    "admin cookie alone does not bypass viewer gate",
  );
  check(
    (await login(link, password, { origin: "https://attacker.invalid" }))
      .status === 403,
    "cross-origin login denied",
  );
  check(
    (await login(link, password, { origin: null })).status === 403,
    "missing-origin mutation denied",
  );
  check(
    (
      await config(
        { action: "disconnect-all" },
        { origin: "https://attacker.invalid" },
      )
    ).status === 403,
    "cross-origin admin mutation denied",
  );
  check(
    (await login(link, "wrong-password")).status === 401,
    "wrong password denied",
  );
  const signed = await login(link),
    cookie = signed.cookie;
  check(signed.status === 200 && cookie, "correct password signs in");
  check(
    /HttpOnly/i.test(signed.headers.get("set-cookie")) &&
      /SameSite=strict/i.test(signed.headers.get("set-cookie")),
    "viewer cookie httponly and strict",
  );
  check(
    signed.headers
      .get("set-cookie")
      .includes("/api/live-ops-share/" + link.token),
    "cookie restricted to this share API",
  );
  const persisted = await db.opsShareSession.findFirst({
    where: { linkId: link.id },
  });
  check(
    persisted.tokenHash !== cookie.split("=")[1] &&
      persisted.tokenHash.length === 64,
    "only session token hash stored",
  );
  check(
    persisted.platform === "Windows" &&
      persisted.device === "Computer" &&
      persisted.ip === ip,
    "server logs IP and coarse device",
  );
  check(
    (await req("/api/auth/me", { cookie })).status === 401,
    "viewer cannot become administrator",
  );
  check(
    (await req("/api/ops/today", { cookie })).status === 401,
    "viewer cannot access original admin API",
  );
  check(
    (await req("/api/players", { method: "POST", cookie, body: {} })).status ===
      401,
    "viewer cannot modify players",
  );
  const before = await snapshot();
  for (const action of [
    "today?date=2026-10-18&surveyId=individual-fixture-survey",
    "calendar?month=2026-10&surveyId=individual-fixture-survey",
    "insights?date=2026-10-18&surveyId=individual-fixture-survey",
    "individual?surveyId=individual-fixture-survey",
    "individual?surveyId=individual-fixture-survey&playerId=individual-fixture-player&from=2026-09-21&to=2026-10-18",
    "table-preferences?surveyId=individual-fixture-survey",
  ]) {
    const r = await read(link, action, cookie);
    check(
      r.status === 200,
      "authorised read " + action.split("?")[0] + ": " + r.text.slice(0, 150),
    );
    check(
      r.headers.get("cache-control").includes("no-store") &&
        r.headers.get("referrer-policy") === "no-referrer",
      "no browser caching or referrer leakage",
    );
    for (const secret of [
      "fixture-private-hr-token",
      "fixture-private-focus-token",
      "fixture-private-hash",
      "fixture-private-user-agent",
      "fixture-private-device-a",
      password,
    ])
      check(!r.text.includes(secret), "player private identifiers not exposed");
  }
  await db.$executeRawUnsafe(
    "ALTER TABLE ops_share_events RENAME TO ops_share_events_outage_fixture",
  );
  try {
    check(
      (await read(link, "today", cookie)).status === 503,
      "audit storage failure never releases wellness data",
    );
  } finally {
    await db.$executeRawUnsafe(
      "ALTER TABLE ops_share_events_outage_fixture RENAME TO ops_share_events",
    );
  }
  check(
    (await req("/api/surveys/individual-fixture-survey/export/csv")).status ===
      200,
    "existing public CSV URL preserved by explicit user choice",
  );
  check(
    (await req("/api/surveys/individual-fixture-survey/export/powerbi"))
      .status === 200,
    "existing public Power BI URL preserved",
  );
  check(
    JSON.stringify(before) === JSON.stringify(await snapshot()),
    "all staff reads leave wellness/camera/focus/rules/preferences unchanged",
  );
  check(
    (await read(link, "today?surveyId=other-survey", cookie)).status === 404,
    "cross-team survey denied",
  );
  check(
    (
      await read(
        link,
        "individual?surveyId=individual-fixture-survey&playerId=other-player",
        cookie,
      )
    ).status === 404,
    "cross-team player denied",
  );
  check(
    (await read(link, "table-preferences?surveyId=other-survey", cookie))
      .status === 404,
    "cross-team preferences denied",
  );
  const scoped = await read(
    link,
    "today?surveyId=individual-fixture-survey&teamId=other-team",
    cookie,
  );
  check(
    scoped.status === 200 && scoped.body.team.id === teamId,
    "client-supplied team cannot change scope",
  );
  check(
    (await read(link, "today", cookie, { agent: "another-browser" })).status ===
      401,
    "copied session rejected for different user agent",
  );
  check(
    (
      await read(link, "today", cookie, {
        extra: { "sec-fetch-site": "cross-site" },
      })
    ).status === 403,
    "cross-site browser read denied",
  );
  for (const action of [
    "today",
    "individual",
    "table-preferences",
    "rules",
    "export",
  ])
    check(
      (await read(link, action, cookie, { method: "POST", body: {} })).status >=
        400,
      "share API cannot mutate " + action,
    );
  const otherLink = await newLink("Synthetic assistant coach");
  check(
    (await read(otherLink, "today", cookie)).status === 401,
    "cookie cannot move between links",
  );
  check(
    (await config({ action: "revoke-link", id: link.id }, { admin: "other" }))
      .status >= 400 &&
      (await db.opsShareLink.findUnique({ where: { id: link.id } })).enabled,
    "other club cannot revoke link",
  );
  const journal = (await req("/api/ops/sharing", { admin: true })).body;
  check(
    journal.events.some((e) => e.kind === "LOGIN_FAILED") &&
      journal.events.some((e) => e.kind === "LOGIN_SUCCESS") &&
      journal.events.some((e) => e.kind === "VIEW"),
    "journal records attempts and actual views",
  );
  check(
    !JSON.stringify(journal).includes(stored.passwordHash) &&
      !JSON.stringify(journal).includes(password) &&
      !JSON.stringify(journal).includes(persisted.tokenHash),
    "admin response never returns password or session hashes",
  );
  check(
    !(await req("/api/ops/sharing", { admin: "other" })).body.links.some(
      (l) => l.id === link.id,
    ),
    "admin link list club scoped",
  );
  await settings(nextPassword);
  check(
    (await read(link, "status", cookie)).status === 401,
    "password change revokes open session",
  );
  check((await login(link)).status === 401, "old password rejected");
  let current = await login(link, nextPassword);
  check(current.status === 200, "new password accepted");
  await config({ action: "block-ip", ip });
  check(
    (await read(link, "today", current.cookie)).status === 401 &&
      (await login(link, nextPassword)).status === 401,
    "blocked IP cannot read or log in",
  );
  await config({ action: "unblock-ip", ip });
  await db.opsShareAuthWindow.deleteMany();
  current = await login(link, nextPassword);
  const session = (
    await req("/api/ops/sharing", { admin: true })
  ).body.sessions.find((s) => s.active && s.label === link.label);
  await config({ action: "revoke-session", id: session.id });
  check(
    (await read(link, "status", current.cookie)).status === 401,
    "individual session revoked",
  );
  current = await login(link, nextPassword);
  await config({ action: "disconnect-all" });
  check(
    (await read(link, "today", current.cookie)).status === 401,
    "disconnect all revokes sessions",
  );
  current = await login(link, nextPassword);
  const currentRow = await db.opsShareSession.findUnique({
    where: {
      tokenHash: (await import("node:crypto"))
        .createHash("sha256")
        .update(current.cookie.split("=")[1])
        .digest("hex"),
    },
  });
  await db.opsShareSession.update({
    where: { id: currentRow.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  check(
    (await read(link, "status", current.cookie)).status === 401,
    "expired session rejected",
  );
  await db.opsShareAuthWindow.deleteMany();
  current = await login(link, nextPassword);
  await config({ action: "rotate-link", id: link.id });
  check(
    (await read(link, "today", current.cookie)).status === 401 &&
      (await login(link, nextPassword)).status === 401,
    "replacing URL kills old URL and sessions",
  );
  const replaced = (
    await req("/api/ops/sharing", { admin: true })
  ).body.links.find((l) => l.id === link.id);
  check(
    replaced.token !== link.token &&
      (await login(replaced, nextPassword)).status === 200,
    "new URL works with current password",
  );
  await config({ action: "revoke-link", id: replaced.id });
  check(
    (await login(replaced, nextPassword)).status === 401,
    "revoked link cannot sign in",
  );
  await db.opsShareLink.update({
    where: { id: otherLink.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  check(
    (await login(otherLink, nextPassword)).status === 401,
    "expired link cannot sign in",
  );
  await db.opsShareAuthWindow.deleteMany();
  const testing = await newLink("Synthetic medical staff");
  current = await login(testing, nextPassword);
  await settings(nextPassword, false);
  check(
    (await read(testing, "today", current.cookie)).status === 401 &&
      (await login(testing, nextPassword)).status === 401,
    "disable all sharing stops access",
  );
  await settings(nextPassword);
  await db.opsShareAuthWindow.deleteMany();
  for (let i = 0; i < 12; i++)
    check(
      (await login(testing, nextPassword)).status === 200,
      "successful logins on a shared network do not consume failure slots",
    );
  await db.opsShareAuthWindow.deleteMany();
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () => login(testing, "wrong-password")),
  );
  check(
    attempts.filter((r) => r.status === 401).length === 10 &&
      attempts.filter((r) => r.status === 429).length === 2,
    "concurrent attempts limited atomically across instances",
  );
  check(
    (await login(testing, nextPassword, { address: "203.0.113.90" })).status ===
      200,
    "rate limiting does not lock unrelated networks",
  );
  await db.opsShareAuthWindow.deleteMany();
  current = await login(testing, nextPassword);
  await db.adminUser.update({
    where: { id: "share-fixture-admin" },
    data: { isActive: false },
  });
  check(
    (await read(testing, "today", current.cookie)).status === 401,
    "disabled granting admin cannot leave active access",
  );
  await db.adminUser.update({
    where: { id: "share-fixture-admin" },
    data: { isActive: true },
  });
  await db.teamMembership.deleteMany({
    where: { adminUserId: "share-fixture-admin", teamId },
  });
  check(
    (await read(testing, "status", current.cookie)).status === 401,
    "removed team membership stops shares",
  );
  await db.teamMembership.create({
    data: { adminUserId: "share-fixture-admin", teamId },
  });
  const loggedOut = await read(testing, "logout", current.cookie, {
    method: "POST",
  });
  check(
    loggedOut.status === 200 &&
      /Max-Age=0/.test(loggedOut.headers.get("set-cookie")),
    "logout expires cookie",
  );
  check(
    (await read(testing, "today", current.cookie)).status === 401,
    "logout revokes server session",
  );
  // Retain a working synthetic context for browser tests only.
  await db.opsShareAuthWindow.deleteMany();
  await settings(password);
  fs.writeFileSync(
    "/tmp/ops-sharing-test-context.json",
    JSON.stringify({
      base,
      teamId,
      link: testing,
      password,
      adminToken,
      ip,
      ua,
    }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ passed: true, checks, fixtureOnly: true }));
} finally {
  await db.$disconnect();
}
