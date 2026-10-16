import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { SignJWT, decodeJwt } from 'jose'
import fs from 'node:fs'
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
  surveyId = 'rhr-test-survey',
  questionId = 'rhr-test-question'
let checks = 0
const check = (value, msg) => {
  assert.ok(value, msg)
  checks++
}
const admin = await new SignJWT({
  email: 'test@example.invalid',
  role: 'TEAM_ADMIN',
  teamId: 'test-team',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('test-admin')
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(key)
async function request(url, body, auth = false) {
  const r = await fetch(base + url, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Cookie: 'wm_admin_session=' + admin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: r.status, data: await r.json() }
}
function signal(bpm) {
  const samples = []
  for (let t = 0; t <= 15000; t += 1000 / 30) {
    const wave =
      Math.sin((((2 * Math.PI * bpm) / 60) * t) / 1000) +
      0.3 * Math.sin((((4 * Math.PI * bpm) / 60) * t) / 1000 + 0.4)
    samples.push({
      t,
      r: 180 + 3 * wave,
      g: 75 + 2 * wave,
      b: 45,
      clipped: 0,
      spread: 0.05,
    })
  }
  return { samples, elapsedMs: 15000, interruption: null, torch: true }
}
try {
  check(
    (await db.team.findUnique({ where: { id: 'test-team' } }))?.name ===
      'PVT Test Team',
    'isolated fixture exists',
  )
  await db.survey.deleteMany({ where: { id: surveyId, teamId: 'test-team' } })
  await db.survey.create({
    data: {
      id: surveyId,
      title: 'RHR fixture',
      teamId: 'test-team',
      createdBy: 'test-admin',
      questions: {
        create: [
          {
            id: questionId,
            text: 'Resting HR',
            type: 'NUMBER',
            required: true,
            options: JSON.stringify({
              widget: 'RHR_CAMERA',
              protocolVersion: 'camera-rhr-v1',
              durationSeconds: 15,
            }),
          },
          {
            id: 'rhr-number',
            text: 'Duration',
            type: 'NUMBER',
            required: false,
          },
        ],
      },
    },
  })
  const path = `/api/kiosk/${surveyId}/rhr`,
    start = {
      action: 'start',
      playerId: 'test-player',
      questionId,
      password: 'TP',
      context: { position: 'lying', rested: true },
    }
  check(
    (await request(path, { ...start, password: 'wrong' })).status === 401,
    'wrong code rejected',
  )
  check(
    (
      await request(path, {
        ...start,
        playerId: 'other-player',
        password: 'OP',
      })
    ).status === 401,
    'cross-team identity rejected',
  )
  check(
    (
      await request(path, {
        ...start,
        context: { position: 'lying', rested: false },
      })
    ).status === 400,
    'rest confirmation required',
  )
  check(
    (
      await request(path, {
        ...start,
        context: { position: 'other', rested: true },
      })
    ).status === 400,
    'position must be explicit and valid',
  )
  check(
    (await request(path, { ...start, questionId: 'rhr-number' })).status ===
      403,
    'ordinary NUMBER question is not a camera widget',
  )
  const opened = await request(path, start)
  check(
    opened.status === 200 && opened.data.ticket,
    'start returns a scoped ticket',
  )
  const record = signal(55)
  check(
    (
      await request(path, {
        action: 'finish',
        ticket: opened.data.ticket,
        record,
      })
    ).status === 400,
    'cannot claim a full scan immediately',
  )
  const payload = decodeJwt(opened.data.ticket)
  const ticket = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 16)
    .setExpirationTime('10m')
    .sign(key)
  const flat = {
    ...record,
    samples: record.samples.map((s) => ({ ...s, r: 180, g: 75 })),
  }
  const bad = await request(path, { action: 'finish', ticket, record: flat })
  check(
    bad.status === 200 && !bad.data.accepted && bad.data.analysis.bpm === null,
    'flat signal produces Repeat, not a number',
  )
  const alternate = {
    ...record,
    samples: record.samples
      .filter((_, i) => i % 2 === 0)
      .map((s) => ({
        ...s,
        r: 255,
        g: 255,
        b: 50 + 2 * Math.sin((((2 * Math.PI * 55) / 60) * s.t) / 1000),
        redClipped: 1,
        greenClipped: 1,
        blueClipped: 0,
      })),
  }
  const adapted = await request(path, {
    action: 'finish',
    ticket,
    record: alternate,
  })
  check(
    adapted.status === 200 &&
      adapted.data.accepted &&
      Math.abs(adapted.data.result.bpm - 55) <= 2,
    'server preserves per-channel clipping and accepts a stable blue signal at 15fps',
  )
  check(
    adapted.data.result.algorithmVersion === 'adaptive-rgb-v2',
    'algorithm revision is signed and auditable',
  )
  const malformed = structuredClone(alternate)
  malformed.samples[0].greenClipped = 2
  check(
    (await request(path, { action: 'finish', ticket, record: malformed }))
      .status === 400,
    'invalid clipping metrics cannot bypass validation',
  )
  const good = await request(path, { action: 'finish', ticket, record, bpm: 1 })
  check(
    good.status === 200 &&
      good.data.accepted &&
      Math.abs(good.data.result.bpm - 55) <= 1,
    'server calculates bpm from samples independently',
  )
  check(
    good.data.result.position === 'lying' &&
      good.data.result.durationSeconds === 15,
    'position and fixed duration signed into result',
  )
  const wellness = {
    surveyId,
    playerId: 'test-player',
    answers: [
      {
        questionId,
        value: JSON.stringify({
          ...good.data.result,
          bpm: 1,
          algorithmVersion: 'FORGED',
        }),
      },
      { questionId: 'rhr-number', value: '30' },
    ],
  }
  check(
    (await request('/api/responses', { ...wellness, answers: [] })).status ===
      400,
    'required measurement cannot be skipped',
  )
  check(
    (
      await request('/api/responses', {
        ...wellness,
        answers: [{ questionId, value: '55' }],
      })
    ).status === 400,
    'manual numeric value cannot impersonate camera result',
  )
  const submitted = await request('/api/responses', wellness)
  check(
    submitted.status === 200,
    'native RHR and ordinary number submit together',
  )
  const saved = JSON.parse(
    submitted.data.answers.find((a) => a.questionId === questionId).value,
  )
  check(
    saved.bpm === 55 &&
      saved.position === 'lying' &&
      !saved.receipt &&
      saved.algorithmVersion === 'adaptive-rgb-v2',
    'answer uses signed server value and strips credentials',
  )
  const csv = await fetch(base + `/api/surveys/${surveyId}/export/csv`).then(
    (r) => r.text(),
  )
  check(
    csv.includes('Resting HR - HR bpm') &&
      csv.includes('Resting HR - Position') &&
      csv.includes('lying'),
    'main CSV includes numeric HR and posture',
  )
  check(
    !csv.includes(good.data.result.receipt) && !csv.includes('samples'),
    'CSV has no receipt or optical samples',
  )
  const powerbi = await request(
    `/api/surveys/${surveyId}/export/powerbi`,
    null,
    true,
  )
  check(
    powerbi.data.some(
      (x) => x.questionText === 'Resting HR - HR bpm' && x.answerValue === 55,
    ),
    'Power BI provides numeric bpm',
  )
  const ops = await request(`/api/ops/today?surveyId=${surveyId}`, null, true)
  check(
    ops.status === 200 &&
      ops.data.rhrAvailable &&
      ops.data.players.find((p) => p.id === 'test-player').restingHr[0].bpm ===
        55,
    'Live Ops carries submitted pulse and position',
  )
  const rejected = await request('/api/responses', {
    ...wellness,
    answers: [
      {
        questionId,
        value: JSON.stringify({
          ...good.data.result,
          receipt: good.data.result.receipt.slice(0, -4) + 'xxxx',
        }),
      },
    ],
  })
  check(
    rejected.status === 400 &&
      (await db.response.count({ where: { id: submitted.data.id } })) === 1,
    'invalid receipt cannot replace existing wellness',
  )
  // Explicit v2 start keeps the old question definition and exercises server replay.
  const v2Start = await request(path, {
    ...start,
    protocolVersion: 'camera-rhr-v2',
  })
  check(
    v2Start.status === 200,
    'v2 start accepts an existing v1 widget definition',
  )
  const v2Payload = decodeJwt(v2Start.data.ticket)
  const v2Ticket = await new SignJWT({ ...v2Payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 40)
    .setExpirationTime('10m')
    .sign(key)
  const v2Samples = []
  let phase = 0
  for (let t = 0; t <= 30000; t += 1000 / 30) {
    const bpm = t < 10000 ? 110 : 80
    phase += (2 * Math.PI * bpm) / 60 / 30
    const v = Math.sin(phase) + 0.3 * Math.sin(phase * 2 + 0.4)
    v2Samples.push({
      t,
      r: 180 + 3 * v,
      g: 75 + 2 * v,
      b: 45,
      clipped: 0,
      spread: 0.05,
    })
  }
  // Find the deterministic completion using the same independently transpiled source as the unit harness.
  const ts = await import('typescript'),
    os = await import('node:os'),
    p = await import('node:path')
  const temporary = fs.mkdtempSync(p.join(os.tmpdir(), 'rhr-native-replay-'))
  let v2Record, localAnalysis
  try {
    for (const name of ['protocol', 'session', 'fixed'])
      fs.writeFileSync(
        p.join(temporary, name + '.cjs'),
        ts.default
          .transpileModule(
            fs.readFileSync(
              new URL('../src/lib/rhr/' + name + '.ts', import.meta.url),
              'utf8',
            ),
            {
              compilerOptions: {
                module: ts.default.ModuleKind.CommonJS,
                target: ts.default.ScriptTarget.ES2022,
              },
            },
          )
          .outputText.replace(
            'require("./protocol")',
            'require("./protocol.cjs")',
          )
          .replace('require("./fixed")', 'require("./fixed.cjs")'),
      )
    const { default: sessionModule } = await import(
      'file://' + p.join(temporary, 'session.cjs')
    )
    const engine = new sessionModule.RhrSession(),
      used = []
    for (const sample of v2Samples) {
      used.push(sample)
      const v = engine.push(sample)
      if (v.stage === 'complete') {
        v2Record = {
          protocolVersion: 'camera-rhr-v2',
          samples: used,
          elapsedMs: sample.t,
          torch: true,
          interruption: null,
        }
        localAnalysis = v.analysis
        break
      }
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
  check(
    v2Record && localAnalysis.restarts >= 1 && v2Record.elapsedMs > 20000,
    'changed signal requires a fresh complete stable window',
  )
  check(
    (await request(path, { action: 'finish', ticket, record: v2Record }))
      .status === 401,
    'legacy ticket cannot authorize the longer protocol',
  )
  const v2Good = await request(path, {
    action: 'finish',
    ticket: v2Ticket,
    record: v2Record,
    bpm: 110,
    restarts: 0,
  })
  check(
    v2Good.status === 200 &&
      v2Good.data.accepted &&
      Math.abs(v2Good.data.result.bpm - 80) <= 2,
    'server independently accepts the new stable 80 BPM window',
  )
  check(
    v2Good.data.result.restarts === localAnalysis.restarts &&
      v2Good.data.result.stableWindowSeconds === 10 &&
      v2Good.data.result.durationSeconds > 20,
    'server signs actual elapsed duration, stable window and restarts',
  )
  const v2Saved = await request('/api/responses', {
    ...wellness,
    answers: [
      {
        questionId,
        value: JSON.stringify({
          ...v2Good.data.result,
          bpm: 110,
          durationSeconds: 15,
          restarts: 0,
        }),
      },
      { questionId: 'rhr-number', value: '30' },
    ],
  })
  check(
    v2Saved.status === 200,
    'v2 result submits through the existing wellness questionnaire',
  )
  const v2Answer = JSON.parse(
    v2Saved.data.answers.find((a) => a.questionId === questionId).value,
  )
  check(
    v2Answer.bpm === 80 &&
      v2Answer.durationSeconds > 20 &&
      v2Answer.restarts >= 1 &&
      !v2Answer.receipt,
    'tampered displayed values cannot replace signed quality metadata',
  )
  const v2Csv = await fetch(base + `/api/surveys/${surveyId}/export/csv`).then(
    (r) => r.text(),
  )
  check(
    v2Csv.includes('camera-rhr-v2/quality-window-v3') &&
      v2Csv.includes(String(v2Answer.durationSeconds)),
    'main CSV exports the current protocol and actual duration',
  )
  const v3Start = await request(path, {
    ...start,
    protocolVersion: 'camera-rhr-v3',
  })
  check(
    v3Start.status === 200,
    'fixed v3 starts on an existing question without schema changes',
  )
  const fixedPayload = decodeJwt(v3Start.data.ticket)
  const fixedTicket = await new SignJWT({ ...fixedPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
    .setExpirationTime('10m')
    .sign(key)
  const fixedRecord = { ...signal(72), protocolVersion: 'camera-rhr-v3' }
  const fixedGood = await request(path, {
    action: 'finish',
    ticket: fixedTicket,
    record: fixedRecord,
    bpm: 150,
  })
  check(
    fixedGood.data.accepted &&
      Math.abs(fixedGood.data.result.bpm - 72) <= 2 &&
      fixedGood.data.result.durationSeconds === 15 &&
      fixedGood.data.result.restarts === 0,
    'server derives a fixed 15s result independently of supplied BPM',
  )
  check(
    (
      await request(path, {
        action: 'finish',
        ticket: v2Ticket,
        record: fixedRecord,
      })
    ).status === 401,
    'fixed and rolling-window tickets cannot be interchanged',
  )
  const fixedFlatRecord = {
    ...fixedRecord,
    samples: fixedRecord.samples.map((s) => ({ ...s, r: 180, g: 75, b: 45 })),
  }
  const fixedFlat = await request(path, {
    action: 'finish',
    ticket: fixedTicket,
    record: fixedFlatRecord,
  })
  check(
    fixedFlat.status === 200 &&
      !fixedFlat.data.accepted &&
      fixedFlat.data.analysis.bpm === null,
    'fixed deadline does not create BPM from flat signal',
  )
  const fixedSaved = await request('/api/responses', {
    ...wellness,
    answers: [
      {
        questionId,
        value: JSON.stringify({
          ...fixedGood.data.result,
          bpm: 150,
          durationSeconds: 60,
          restarts: 99,
        }),
      },
      { questionId: 'rhr-number', value: '30' },
    ],
  })
  const fixedAnswer = JSON.parse(
    fixedSaved.data.answers.find((a) => a.questionId === questionId).value,
  )
  check(
    fixedSaved.status === 200 &&
      fixedAnswer.bpm === 72 &&
      fixedAnswer.durationSeconds === 15 &&
      fixedAnswer.restarts === 0 &&
      !fixedAnswer.receipt,
    'wellness preserves signed fixed duration/BPM and strips receipt',
  )
  const fixedCsv = await fetch(
    base + `/api/surveys/${surveyId}/export/csv`,
  ).then((r) => r.text())
  check(
    fixedCsv.includes('camera-rhr-v3/fixed-rgb-v4'),
    'main CSV carries the fixed-capture algorithm revision',
  )
  const fixedOps = await request(
    `/api/ops/today?surveyId=${surveyId}`,
    null,
    true,
  )
  check(
    fixedOps.data.players.find((p) => p.id === 'test-player').restingHr[0]
      .bpm === 72,
    'Live Ops receives the fixed capture through normal wellness submission',
  )
  fs.writeFileSync('/tmp/rhr-test-admin-cookie', 'wm_admin_session=' + admin, {
    mode: 0o600,
  })
  console.log(
    `PASS: ${checks} RHR native integration checks against isolated loopback fixture`,
  )
} finally {
  await db.$disconnect()
}
