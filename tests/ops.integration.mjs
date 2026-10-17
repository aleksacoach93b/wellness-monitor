import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { SignJWT, decodeJwt } from 'jose'
const base = process.env.PVT_TEST_BASE_URL,
  database = process.env.PVT_TEST_DATABASE_URL
if (
  !base ||
  !database ||
  new URL(base).hostname !== '127.0.0.1' ||
  new URL(database).hostname !== '127.0.0.1'
)
  throw Error('Explicit loopback fixture URLs required')
const db = new PrismaClient({ datasourceUrl: database }),
  key = new TextEncoder().encode('pvt-local-test-only'),
  sid = 'ops-test-survey',
  qid = 'ops-test-hr',
  fid = 'ops-test-focus'
const jwt = await new SignJWT({
  email: 'test@example.invalid',
  role: 'TEAM_ADMIN',
  teamId: 'test-team',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('test-admin')
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(key)
let checks = 0
const check = (value, msg) => {
  assert.ok(value, msg)
  checks++
}
async function req(path, body, admin = false, extra = {}) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Cookie: 'wm_admin_session=' + jwt } : {}),
      'User-Agent': 'Fixture Android Chrome/1 SamsungBrowser/30',
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: r.status, body: await r.json() }
}
async function waitRow(id) {
  for (let i = 0; i < 30; i++) {
    const r = await db.rhrObservation.findUnique({ where: { id } })
    if (r) return r
    await new Promise((r) => setTimeout(r, 100))
  }
  throw Error('Observation not recorded')
}
try {
  check(
    (await db.team.findUnique({ where: { id: 'test-team' } }))?.name ===
      'PVT Test Team',
    'owned fixture required',
  )
  await db.survey.deleteMany({ where: { id: sid, teamId: 'test-team' } })
  await db.survey.create({
    data: {
      id: sid,
      title: 'Wellness Live Ops fixture',
      teamId: 'test-team',
      createdBy: 'test-admin',
      timezone: 'Europe/Belgrade',
      questions: {
        create: [
          {
            id: qid,
            text: 'Resting HR',
            type: 'NUMBER',
            required: false,
            createdAt: new Date('2026-01-01'),
            options: JSON.stringify({
              widget: 'RHR_CAMERA',
              protocolVersion: 'camera-rhr-v4',
              durationSeconds: 15,
            }),
          },
          {
            id: fid,
            text: 'Focus test',
            type: 'PVT',
            required: false,
            createdAt: new Date('2026-01-01'),
            options: JSON.stringify({
              durationSeconds: 30,
              protocolVersion: 'handheld-pvt-v5',
            }),
          },
          {
            id: 'ops-test-fatigue',
            text: 'Fatigue',
            type: 'SLIDER',
            required: false,
          },
          {
            id: 'ops-test-mood',
            text: 'Mood',
            type: 'SLIDER',
            required: false,
          },
        ],
      },
    },
  })
  const rosterSize = await db.player.count({
    where: { teamId: 'test-team', isActive: true },
  })
  await db.player.createMany({
    data: Array.from({ length: Math.max(0, 25 - rosterSize) }, (_, i) => ({
      id: 'ops-test-extra-' + i,
      teamId: 'test-team',
      firstName: 'Squad',
      lastName: 'Fixture ' + String(i + 1).padStart(2, '0'),
      password: 'SF',
    })),
    skipDuplicates: true,
  })
  const insight = `/api/ops/insights?surveyId=${sid}&date=2026-10-17`,
    path = `/api/kiosk/${sid}/rhr`
  check((await req(insight)).status === 401, 'insights admin only')
  check(
    (await req(insight.replace(sid, 'other-survey'), null, true)).status ===
      404,
    'cross-team survey hidden',
  )
  check(
    (await req(insight.replace('2026-10-17', '2026-02-30'), null, true))
      .status === 400,
    'overflow date rejected',
  )
  let x = await req(insight, null, true)
  check(
    x.status === 200 && x.body.available.hrTracking,
    'new additive tracking schema ready',
  )
  const report = {
    action: 'report',
    eventId: randomUUID(),
    playerId: 'test-player',
    questionId: qid,
    password: 'TP',
    position: 'lying',
    status: 'CAMERA_ERROR',
    reason: 'camera-light',
    protocolVersion: 'camera-rhr-v4',
    acquisitionVersion: 'android-metering-compat-v3',
  }
  check(
    (await req(path, { ...report, password: 'wrong' })).status === 401,
    'report requires player authentication',
  )
  check(
    (await req(path, { ...report, playerId: 'other-player', password: 'OP' }))
      .status === 401,
    'report rejects cross-team player',
  )
  check(
    (await req(path, { ...report, status: 'ACCEPTED' })).status === 400,
    'client cannot create accepted result',
  )
  check(
    (await req(path, { ...report, bpm: 70 })).status === 400,
    'client cannot invent BPM',
  )
  check(
    (await req(path, { ...report, samples: [{}] })).status === 400,
    'reports cannot store optical samples',
  )
  check(
    (await req(path, report, false, { Origin: 'https://evil.invalid' }))
      .status === 403,
    'origin scope enforced',
  )
  check(
    (await req(path, report)).body.recorded,
    'authenticated camera failure recorded',
  )
  check(
    (await req(path, report)).body.recorded,
    'duplicate status report is idempotent',
  )
  check(
    (await db.rhrObservation.count({ where: { id: report.eventId } })) === 1,
    'one row per measurement attempt',
  )
  const row = await waitRow(report.eventId)
  check(
    row.platform === 'Android' &&
      row.browser === 'Samsung Internet' &&
      row.source === 'CLIENT',
    'coarse browser group and source recorded',
  )
  check(
    !Object.keys(row).some((k) => /userAgent|samples|cameraId|video/.test(k)),
    'no camera/video/raw UA fields in tracking',
  )
  const grantResponse = await fetch(base + `/api/kiosk/${sid}/pvt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'authorize',
      playerId: 'test-player',
      password: 'TP',
    }),
  })
  const cookie = grantResponse.headers.get('set-cookie')?.split(';')[0]
  check(grantResponse.ok && cookie, 'kiosk grant fixture issued')
  check(
    (
      await req(
        path,
        { ...report, eventId: randomUUID(), password: undefined },
        false,
        { Cookie: cookie },
      )
    ).body.recorded,
    'existing kiosk grant authenticates tracking without a second code',
  )
  const id = randomUUID(),
    start = {
      action: 'start',
      playerId: 'test-player',
      questionId: qid,
      password: 'TP',
      context: { position: 'lying', rested: true },
      protocolVersion: 'camera-rhr-v4',
      observation: { id, acquisitionVersion: 'android-metering-compat-v3' },
    }
  const opened = await req(path, start)
  check(
    opened.status === 200 && opened.body.ticket,
    'existing start contract preserved',
  )
  const started = await waitRow(id)
  check(started.status === 'STARTED', 'start recorded after response')
  const token = await new SignJWT({ ...decodeJwt(opened.body.ticket) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 16)
    .setExpirationTime('10m')
    .sign(key)
  const samples = []
  for (let t = 0; t <= 15000; t += 1000 / 30) {
    const v =
      Math.sin((((2 * Math.PI * 70) / 60) * t) / 1000) +
      0.3 * Math.sin((((4 * Math.PI * 70) / 60) * t) / 1000 + 0.4)
    samples.push({
      t,
      r: 180 + 3 * v,
      g: 75 + 2 * v,
      b: 45,
      clipped: 0,
      spread: 0.05,
    })
  }
  const finish = {
    action: 'finish',
    ticket: token,
    record: {
      protocolVersion: 'camera-rhr-v4',
      samples,
      elapsedMs: 15000,
      interruption: null,
      torch: true,
    },
  }
  const accepted = await req(path, finish)
  check(
    accepted.status === 200 &&
      accepted.body.accepted &&
      Math.abs(accepted.body.result.bpm - 70) <= 2,
    'server still independently computes original estimator result',
  )
  for (let i = 0; i < 30 && (await waitRow(id)).status !== 'ACCEPTED'; i++)
    await new Promise((r) => setTimeout(r, 100))
  check(
    (await waitRow(id)).status === 'ACCEPTED',
    'accepted outcome stored by server',
  )
  await req(path, {
    ...report,
    eventId: id,
    status: 'REPEAT',
    reason: 'signal-quality',
  })
  check(
    (await waitRow(id)).status === 'ACCEPTED',
    'late client reports cannot downgrade accepted result',
  )
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  x = await req(`/api/ops/insights?surveyId=${sid}&date=${date}`, null, true)
  check(
    x.body.today.find((p) => p.id === 'test-player').hr.state ===
      'awaiting-submission',
    'accepted test distinct from submitted wellness',
  )
  const csvPath = `/api/surveys/${sid}/export/csv`,
    before = (await (await fetch(base + csvPath)).text()).split('\n')[0]
  await db.response.create({
    data: {
      id: 'ops-test-response',
      surveyId: sid,
      playerId: 'test-player',
      submittedAt: new Date('2026-10-16T22:30:00Z'),
      answers: {
        create: [
          {
            questionId: qid,
            value: JSON.stringify({ ...accepted.body.result, bpm: 70 }),
          },
          {
            questionId: fid,
            value: JSON.stringify({
              kind: 'PVT',
              attemptId: 'ops-test-pvt',
              durationSeconds: 30,
            }),
          },
          { questionId: 'ops-test-fatigue', value: '8' },
          { questionId: 'ops-test-mood', value: '8' },
        ],
      },
    },
  })
  await db.pvtSession.create({
    data: {
      id: 'ops-test-pvt',
      teamId: 'test-team',
      surveyId: sid,
      playerId: 'test-player',
      questionId: fid,
      responseId: 'ops-test-response',
      tokenHash: 'fixture',
      durationSeconds: 30,
      protocolVersion: 'handheld-pvt-v5',
      practice: false,
      status: 'COMPLETED',
      localDate: '2026-10-17',
      startedAt: new Date('2026-10-16T22:20:00Z'),
      finishedAt: new Date('2026-10-16T22:20:30Z'),
      deviceId: 'fixture-device',
      userAgent: 'Fixture iPhone Safari/1',
      context: { posture: 'seated', caffeine: false },
      summary: { medianRT: 250, quality: 'OK', repeatRequired: false },
    },
  })
  x = await req(insight, null, true)
  const player = x.body.today.find((p) => p.id === 'test-player')
  check(
    player.hr.state === 'saved' && player.focus.state === 'saved',
    'submitted HR and exact Focus receipt shown together',
  )
  check(
    x.body.weekly.totalCheckins === 1 &&
      x.body.weekly.hrSaved === 1 &&
      x.body.weekly.focusSaved === 1,
    'weekly counts use local survey day and exact saved results',
  )
  check(
    !JSON.stringify(x.body).includes('fixture-device') &&
      !JSON.stringify(x.body).includes('Fixture iPhone'),
    'private device fingerprints are not exposed in reports',
  )
  const daily = await req(
    `/api/ops/today?surveyId=${sid}&date=2026-10-17`,
    null,
    true,
  )
  check(
    daily.status === 200 &&
      daily.body.players.find((p) => p.id === 'test-player').status === 'done',
    'legacy daily board uses same survey timezone',
  )
  const month = await req(
    `/api/ops/month-data?surveyId=${sid}&month=2026-10`,
    null,
    true,
  )
  check(
    month.status === 200 && month.body.days['2026-10-17'].stats.done === 1,
    'month cache uses same survey timezone',
  )
  const calendar = await req(
    `/api/ops/calendar?surveyId=${sid}&month=2026-10`,
    null,
    true,
  )
  check(
    calendar.status === 200 && calendar.body.days['2026-10-17']?.done === 1,
    'calendar dots match local report day',
  )
  const after = (await (await fetch(base + csvPath)).text()).split('\n')[0]
  check(before === after, 'main CSV headers unchanged by tracking')
  check(
    after.includes('HR bpm') && after.includes('Median RT'),
    'unified CSV retains HR and Focus columns',
  )
  // Storage failure must not affect the measuring endpoint. Only this isolated fixture DB is mutated.
  await db.$executeRawUnsafe(
    'ALTER TABLE "rhr_observations" RENAME TO "rhr_observations_fixture_hidden"',
  )
  try {
    const openedWithoutTracking = await req(path, {
      ...start,
      observation: { ...start.observation, id: randomUUID() },
    })
    check(
      openedWithoutTracking.status === 200 && openedWithoutTracking.body.ticket,
      'optional tracking storage failure cannot block starting measurement',
    )
    let unavailable = await req(insight, null, true)
    for (let i = 0; i < 5 && unavailable.status === 503; i++) {
      await new Promise((r) => setTimeout(r, 150))
      unavailable = await req(insight, null, true)
    }
    check(
      unavailable.status === 200 &&
        !unavailable.body.available.hrTracking &&
        unavailable.body.weekly.hrSaved === 1,
      'saved results survive optional tracking outage',
    )
  } finally {
    await db.$executeRawUnsafe(
      'ALTER TABLE "rhr_observations_fixture_hidden" RENAME TO "rhr_observations"',
    )
  }
  fs.writeFileSync(
    '/tmp/ops-test-context.json',
    JSON.stringify({ surveyId: sid, admin: jwt, date: '2026-10-17' }),
    { mode: 0o600 },
  )
  console.log(
    JSON.stringify({ checks, passed: true, fixtureRetainedForBrowser: true }),
  )
} finally {
  await db.$disconnect()
}
