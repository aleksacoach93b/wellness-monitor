const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript'),
  { webcrypto } = require('node:crypto')
const js = ts.transpileModule(
  fs.readFileSync(__dirname + '/../src/lib/offlineSurveyQueue.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText
function setup() {
  const store = {
    getItem(k) {
      return typeof this[k] === 'string' ? this[k] : null
    },
    setItem(k, v) {
      this[k] = v
    },
    removeItem(k) {
      delete this[k]
    },
  }
  for (const key of ['getItem', 'setItem', 'removeItem'])
    Object.defineProperty(store, key, { enumerable: false })
  const window = new EventTarget(),
    ctx = {
      exports: {},
      window,
      localStorage: store,
      navigator: { onLine: true },
      crypto: webcrypto,
      Event,
      AbortSignal,
      AbortController,
      setTimeout,
      clearTimeout,
      Date,
      console,
      fetch: async () => {
        throw Error('Network offline')
      },
    }
  vm.runInNewContext(js, ctx)
  return { q: ctx.exports, ctx, store }
}
const payload = (playerId = 'p', surveyId = 's') => ({
  surveyId,
  playerId,
  answers: [{ questionId: 'q', value: '8' }],
})
const scope = { surveyId: 's', playerId: 'p' }
const ok = (item) => ({
  ok: true,
  status: 200,
  json: async () => ({ id: 'saved-response', surveyId: item.payload.surveyId }),
})
test('persisted request identity and answers survive a lost acknowledgement', async () => {
  const { q, ctx } = setup()
  const item = q.enqueueOfflineSurveySubmission(payload())
  const sent = []
  ctx.fetch = async (_, r) => {
    sent.push(JSON.parse(r.body))
    throw TypeError('Failed to fetch')
  }
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(q.readSurveySubmission(item.id).state, 'pending')
  assert.equal(q.releaseRejectedSubmission(item.id), false)
  ctx.fetch = async (_, r) => {
    sent.push(JSON.parse(r.body))
    return ok(item)
  }
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(sent[0].submissionId, sent[1].submissionId)
  assert.deepEqual(sent[0], sent[1])
  assert.equal(q.readSurveySubmission(item.id).state, 'saved')
  assert.equal('payload' in q.readSurveySubmission(item.id), false)
})
test('parallel retry triggers share one in-flight request', async () => {
  const { q, ctx } = setup()
  const item = q.enqueueOfflineSurveySubmission(payload())
  let resolve,
    calls = 0
  ctx.fetch = () => {
    calls++
    return new Promise((r) => (resolve = r))
  }
  const a = q.flushOfflineSurveyQueue(scope, item.id),
    b = q.flushOfflineSurveyQueue(scope, item.id)
  await Promise.resolve()
  assert.equal(calls, 1)
  resolve(ok(item))
  await Promise.all([a, b])
  assert.equal(q.getOfflineQueueCount(scope), 0)
})
test('definitive validation failures remain recoverable instead of being dropped', async () => {
  const { q, ctx } = setup()
  const item = q.enqueueOfflineSurveySubmission(payload())
  ctx.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Repeat Focus', focusQuestionId: 'f' }),
  })
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(q.readSurveySubmission(item.id).state, 'attention')
  assert.equal(q.readSurveySubmission(item.id).questionId, 'f')
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(q.getOfflineQueueCount(scope), 1)
  assert.equal(q.releaseRejectedSubmission(item.id), true)
})
test('no false saved state from HTML/captive portal or malformed acknowledgement', async () => {
  const { q, ctx } = setup()
  const item = q.enqueueOfflineSurveySubmission(payload())
  ctx.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw Error('HTML')
    },
  })
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(q.readSurveySubmission(item.id).state, 'pending')
})
test('scoped retry never sends another player or survey', async () => {
  const { q, ctx } = setup()
  const own = q.enqueueOfflineSurveySubmission(payload()),
    other = q.enqueueOfflineSurveySubmission(payload('other')),
    club = q.enqueueOfflineSurveySubmission(payload('p', 'another-survey'))
  ctx.fetch = async () => ok(own)
  await q.flushOfflineSurveyQueue(scope, own.id)
  assert.equal(q.readSurveySubmission(other.id).state, 'pending')
  assert.equal(q.readSurveySubmission(club.id).state, 'pending')
})
test('storage denial keeps answers in memory without claiming durability', async () => {
  const { q, ctx, store } = setup()
  store.setItem = () => {
    throw Error('Quota')
  }
  const p = payload(),
    item = q.enqueueOfflineSurveySubmission(p)
  p.answers[0].value = '1'
  assert.equal(q.isSubmissionDurable(item.id), false)
  assert.equal(q.readSurveySubmission(item.id).payload.answers[0].value, '8')
  ctx.fetch = async () => ok(item)
  await q.flushOfflineSurveyQueue(scope, item.id)
  assert.equal(q.readSurveySubmission(item.id).state, 'saved')
})
test('offline and full queues never discard an older questionnaire', async () => {
  const { q, ctx } = setup()
  ctx.navigator.onLine = false
  for (let i = 0; i < 40; i++)
    q.enqueueOfflineSurveySubmission(payload('p' + i))
  assert.throws(() => q.enqueueOfflineSurveySubmission(payload('excess')))
  assert.equal(q.getOfflineQueueCount({ surveyId: 's' }), 40)
  const res = await q.flushOfflineSurveyQueue({ surveyId: 's' })
  assert.equal(res.synced, 0)
  assert.equal(res.remaining, 40)
})
test('legacy queued payloads gain stable IDs and retain their original answers', async () => {
  const { q, store } = setup()
  store.setItem(
    'wellness-offline-survey-queue',
    JSON.stringify([
      { id: 'offline-old', createdAt: Date.now(), payload: payload() },
    ]),
  )
  const first = q.getSurveySubmissions(scope)
  assert.equal(first.length, 1)
  assert.equal(first[0].payload.answers[0].value, '8')
  assert.equal(q.getSurveySubmissions(scope)[0].id, first[0].id)
  assert.equal(store.getItem('wellness-offline-survey-queue'), null)
})
test('rate limiting and server failures keep pending entries with retry backoff', async () => {
  for (const status of [408, 429, 500, 503]) {
    const { q, ctx } = setup(),
      item = q.enqueueOfflineSurveySubmission(payload())
    let calls = 0
    ctx.fetch = async () => {
      calls++
      return { ok: false, status, json: async () => ({ error: 'temporary' }) }
    }
    await q.flushOfflineSurveyQueue(scope, item.id)
    assert.equal(q.readSurveySubmission(item.id).state, 'pending')
    assert.ok(q.readSurveySubmission(item.id).nextAttemptAt > Date.now())
    await q.flushOfflineSurveyQueue(scope)
    assert.equal(calls, 1)
  }
})
