// Explicit loopback fixture only. Exercises the actual response endpoint and persistent receipts.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
const base = process.env.PVT_TEST_BASE_URL,
  database = process.env.PVT_TEST_DATABASE_URL
if (
  !base ||
  !database ||
  new URL(base).hostname !== '127.0.0.1' ||
  new URL(database).hostname !== '127.0.0.1'
)
  throw Error('Explicit isolated loopback URLs required')
const db = new PrismaClient({ datasourceUrl: database }),
  surveyId = 'delivery-test-survey'
let checks = 0
function check(value, message) {
  assert.ok(value, message)
  checks++
}
async function post(body) {
  const r = await fetch(base + '/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, data: await r.json() }
}
const payload = (value = 'Initial', extra = {}) => ({
  surveyId,
  playerId: 'test-player',
  submissionId: randomUUID(),
  clientCreatedAt: new Date().toISOString(),
  answers: [
    { questionId: 'delivery-text', value },
    { questionId: 'delivery-slider', value: '5' },
    { questionId: 'delivery-pain', value: 'No' },
  ],
  ...extra,
})
try {
  check(
    (await db.team.findUnique({ where: { id: 'test-team' } }))?.name ===
      'PVT Test Team',
    'synthetic team required',
  )
  await db.survey.deleteMany({ where: { id: surveyId, teamId: 'test-team' } })
  // The endpoint creates its additive ledger; remove only prior synthetic ledger entries when present.
  await db.$executeRawUnsafe(
    fs
      .readFileSync(
        new URL(
          '../prisma/manual-migrations/2026-10-survey-delivery-receipts.sql',
          import.meta.url,
        ),
        'utf8',
      )
      .split(';')[0],
  )
  await db.surveySubmissionReceipt.deleteMany({ where: { surveyId } })
  await db.survey.create({
    data: {
      id: surveyId,
      title: 'Delivery test wellness',
      teamId: 'test-team',
      createdBy: 'test-admin',
      trackSessionType: true,
      trackMatchDay: true,
      questions: {
        create: [
          {
            id: 'delivery-text',
            text: 'How are you today?',
            type: 'TEXT',
            required: true,
            order: 0,
          },
          {
            id: 'delivery-slider',
            text: 'Fatigue',
            type: 'SLIDER',
            required: true,
            order: 1,
          },
          {
            id: 'delivery-multiple',
            text: 'Recovery activities',
            type: 'MULTIPLE_SELECT',
            required: false,
            options: JSON.stringify(['Mobility', 'Pool']),
            order: 2,
          },
          {
            id: 'delivery-pain',
            text: 'Sore Areas?',
            type: 'BODY_MAP',
            required: true,
            order: 3,
          },
        ],
      },
    },
  })
  const first = payload('Complete'),
    results = await Promise.all([post(first), post(first)])
  check(
    results.every((x) => x.status === 200),
    'concurrent same-request deliveries succeed',
  )
  check(
    results[0].data.id === results[1].data.id,
    'concurrent retry returns same response ID',
  )
  check(
    (await db.response.count({ where: { surveyId } })) === 1,
    'concurrent retry leaves exactly one response',
  )
  check(
    (await db.surveySubmissionReceipt.count({ where: { surveyId } })) === 1,
    'exactly one receipt committed',
  )
  const receipt = await db.surveySubmissionReceipt.findUnique({
    where: { id: first.submissionId },
  })
  check(
    receipt.requestHash.length === 64 &&
      !JSON.stringify(receipt).includes('Complete'),
    'ledger stores hash, no questionnaire answers',
  )
  const conflict = await post({
    ...first,
    answers: [{ questionId: 'delivery-text', value: 'Altered' }],
  })
  check(
    conflict.status === 409 &&
      conflict.data.submissionIssue === 'DELIVERY_CONFLICT',
    'same ID different content rejected',
  )
  check(
    (await post({ ...first, playerId: 'other-player' })).status === 409,
    'same ID different player rejected',
  )
  const reordered = await post({
    ...first,
    answers: [...first.answers].reverse(),
  })
  check(
    reordered.status === 200 && reordered.data.id === receipt.responseId,
    'answer order does not break replay',
  )
  check(
    (
      await post(
        payload('Old', {
          clientCreatedAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      )
    ).data.submissionIssue === 'DELIVERY_NEWER',
    'older pending request cannot replace newer response',
  )
  check(
    (
      await post(
        payload('Yesterday', {
          clientCreatedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
        }),
      )
    ).data.submissionIssue === 'DELIVERY_DAY',
    'previous-day pending needs review',
  )
  check(
    (
      await post(
        payload('Future', {
          clientCreatedAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        }),
      )
    ).data.submissionIssue === 'DELIVERY_TIME',
    'incorrect future clock rejected',
  )
  check(
    (await db.response.count({ where: { surveyId } })) === 1,
    'rejected deliveries leave existing response intact',
  )
  await new Promise((r) => setTimeout(r, 30))
  const newer = await post(payload('Newer'))
  check(
    newer.status === 200 && newer.data.id !== receipt.responseId,
    'intentional new submission keeps legacy replacement behavior',
  )
  const replay = await post(first)
  check(
    replay.status === 200 &&
      replay.data.id === receipt.responseId &&
      replay.data.replayed,
    'lost ACK replays after response replacement',
  )
  check(
    (
      await db.response.findMany({
        where: { surveyId },
        include: { answers: true },
      })
    )[0].answers.some((a) => a.value === 'Newer'),
    'late retry cannot restore superseded answers',
  )
  // A successfully delivered request remains acknowledged even when the current survey shape changes.
  await db.question.update({
    where: { id: 'delivery-text' },
    data: { required: false },
  })
  check(
    (await post(first)).data.replayed,
    'receipt acknowledgement is independent of current question validation',
  )
  const legacy = {
    ...payload('Coach mode'),
    submissionId: undefined,
    clientCreatedAt: undefined,
  }
  check(
    (await post(legacy)).status === 200,
    'legacy clients without delivery IDs still submit',
  )
  check(
    (
      await post(
        payload('Stale', {
          clientCreatedAt: new Date(Date.now() - 30_000).toISOString(),
        }),
      )
    ).data.submissionIssue === 'DELIVERY_NEWER',
    'newer legacy response also protected from stale queue',
  )
  check(
    (await post(payload('Tags', { sessionType: 'Pitch', matchDay: 'MD-1' })))
      .status === 200,
    'session-specific submission remains independent',
  )
  const tagged = await db.response.findFirst({
    where: { surveyId, sessionType: 'Pitch' },
    include: { answers: true },
  })
  check(
    tagged?.matchDay === 'MD-1' &&
      tagged.answers.some(
        (a) => a.questionId === 'delivery-slider' && a.value === '5',
      ) &&
      tagged.answers.some(
        (a) => a.questionId === 'delivery-pain' && a.value === 'No',
      ),
    'tags, slider default, bodymap No stored unchanged',
  )
  const csv = await fetch(base + `/api/surveys/${surveyId}/export/csv`).then(
    (r) => r.text(),
  )
  check(
    csv.includes('How are you today?') &&
      csv.includes('Pitch') &&
      !csv.includes('submissionId') &&
      !csv.includes('requestHash'),
    'existing main CSV contains answers with no receipt metadata columns',
  )
  // Failed measurement verification must not create receipt or delete the accepted response.
  const invalid = payload('Wrong', {
    answers: [{ questionId: 'nonexistent', value: 'x' }],
  })
  check((await post(invalid)).status === 400, 'invalid question rejected')
  check(
    !(await db.surveySubmissionReceipt.findUnique({
      where: { id: invalid.submissionId },
    })),
    'rejected request has no receipt',
  )
  // A device clock slightly behind the server must still allow its next intentional submission.
  const driftOne = await post(
    payload('Clock one', {
      sessionType: 'Clock drift',
      clientCreatedAt: new Date(Date.now() - 600_000).toISOString(),
    }),
  )
  check(driftOne.status === 200, 'first slow-clock questionnaire accepted')
  const driftTwo = await post(
    payload('Clock two', {
      sessionType: 'Clock drift',
      clientCreatedAt: new Date(Date.now() - 590_000).toISOString(),
    }),
  )
  check(
    driftTwo.status === 200 && driftTwo.data.id !== driftOne.data.id,
    'newer device request is not rejected against its previous server commit time',
  )
  check(
    (
      await post(
        payload('Clock stale', {
          sessionType: 'Clock drift',
          clientCreatedAt: new Date(Date.now() - 610_000).toISOString(),
        }),
      )
    ).data.submissionIssue === 'DELIVERY_NEWER',
    'slow-clock older delivery still cannot overwrite newer data',
  )
  // Shared browser fixture starts clean after API assertions.
  await db.response.deleteMany({ where: { surveyId } })
  await db.surveySubmissionReceipt.deleteMany({ where: { surveyId } })
  await db.question.update({
    where: { id: 'delivery-text' },
    data: { required: true },
  })
  for (const [name, category] of [
    ['Pitch', 'SESSION'],
    ['MD-1', 'MATCHDAY'],
  ])
    if (
      !(await db.tag.findFirst({
        where: { name, category, teamId: 'test-team' },
      }))
    )
      await db.tag.create({ data: { name, category, teamId: 'test-team' } })
  console.log(
    `PASS: ${checks} survey delivery API assertions against isolated loopback fixture`,
  )
} finally {
  await db.$disconnect()
}
