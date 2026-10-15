const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvt-unit-'))
for (const name of ['protocol', 'engine', 'baseline', 'server']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/pvt', name + '.ts'), 'utf8')
  fs.writeFileSync(path.join(dir, name + '.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText)
}
// Only server.ts needs a package import from the repository.
fs.symlinkSync(path.join(__dirname, '../node_modules'), path.join(dir, 'node_modules'), 'dir')
const { PvtEngine } = require(path.join(dir, 'engine.js'))
const { randomWaitMs, summarizePvt, validatePvtRecord } = require(path.join(dir, 'protocol.js'))
const { baselineFor } = require(path.join(dir, 'baseline.js'))
const { surveyOpen, localDay, sameOrigin } = require(path.join(dir, 'server.js'))
after(() => fs.rmSync(dir, { recursive: true, force: true }))
function run(duration, latency = 250) {
  const engine = new PvtEngine(duration * 1000, () => .5)
  for (let now = 0; now <= duration * 1000; now += 10) {
    engine.tick(now)
    if (engine.onset !== null && now - engine.onset >= latency) engine.press(now)
  }
  return engine.result()
}
test('random waits stay in the protocol range and reject invalid randomness', () => {
  assert.equal(randomWaitMs(0), 1000); assert.equal(randomWaitMs(.999999), 4000)
  for (const x of [-1, 1, NaN]) assert.throws(() => randomWaitMs(x))
})
for (const duration of [30, 60]) test(`${duration}s produces valid timing records with a fixed latency`, () => {
  const result = run(duration)
  assert.equal(validatePvtRecord(result, duration), true)
  const summary = summarizePvt(result, duration)
  assert.equal(summary.medianRT, 250); assert.equal(summary.slowResponses, 0)
  assert.equal(summary.quality, 'OK'); assert.ok(summary.responses >= 10)
})
test('touch cannot create an unseen stimulus before a frame paints it', () => {
  const e = new PvtEngine(60000, () => 0)
  e.tick(990); e.press(1001)
  assert.equal(e.trials[0].kind, 'false-start'); assert.equal(e.onset, null)
  e.tick(1010); e.press(1260)
  assert.equal(e.trials[1].rtMs, 250)
})
test('anticipations and sub-100ms responses are counted as early taps', () => {
  const e = new PvtEngine(60000, () => 0)
  e.press(400); e.tick(1000); e.press(1050)
  assert.equal(e.trials.filter(x => x.kind === 'false-start').length, 2)
})
test('sleeping through a signal produces a timeout, not a fast result', () => {
  const e = new PvtEngine(60000, () => 0)
  for (let n = 0; n <= 31000; n += 10) e.tick(n)
  assert.equal(e.trials[0].kind, 'timeout'); assert.equal(e.trials[0].rtMs, 30000)
})
test('interruptions and frame stalls require review', () => {
  const e = new PvtEngine(60000, () => 0)
  e.tick(10); e.tick(500); e.abort(1000, 'hidden')
  assert.equal(e.phase, 'done'); assert.equal(validatePvtRecord(e.result(), 60), true)
  assert.deepEqual(summarizePvt(e.result(), 60).flags, ['hidden', 'too-short', 'frame-delay', 'few-responses'])
})
test('an unfinished long final signal is retained and requires review', () => {
  const e = new PvtEngine(60000, () => 0)
  for (let n = 0; n <= 60000; n += 10) e.tick(n)
  assert.equal(e.trials.at(-1).kind, 'censored')
  assert.ok(summarizePvt(e.result(), 60).flags.includes('unfinished-response'))
})
test('server rejects malformed, overlapping or impossible response timing', () => {
  const original = run(60)
  for (const mutate of [r => r.trials[0].rtMs = 1, r => r.trials[0].atMs = -1, r => r.trials[0].waitMs = 500, r => r.trials[1].onsetMs = 0, r => r.elapsedMs = Infinity]) {
    const r = structuredClone(original); mutate(r); assert.equal(validatePvtRecord(r, 60), false)
  }
})
function row(day, patch = {}) {
  return { id: day, playerId: 'p', surveyId: 's', localDate: day, startedAt: day + 'T08:00:00Z', finishedAt: day + 'T08:03:00Z', durationSeconds: 60, protocolVersion: 'v1', practice: false, status: 'COMPLETED', deviceId: 'device', userAgent: 'browser', context: { posture: 'seated', caffeine: false }, summary: { quality: 'OK', medianRT: 250 }, player: { firstName: 'Test', lastName: 'Player' }, ...patch }
}
test('baseline requires seven distinct prior eligible days, not seven repeats', () => {
  const current = row('2026-10-15')
  const repeated = Array.from({length: 8}, () => row('2026-10-14'))
  assert.equal(baselineFor(current, repeated).reference, null)
  const prior = Array.from({length: 7}, (_, i) => row(`2026-10-0${i + 1}`))
  assert.equal(baselineFor(current, prior).reference, 250)
  assert.equal(baselineFor(current, [...prior, current]).days, 7)
})
test('practice, wrong device/duration/posture, future or bad-quality results cannot build the reference', () => {
  const current = row('2026-10-15')
  const wrong = [row('2026-10-01', {practice:true}), row('2026-10-02', {durationSeconds:30}), row('2026-10-03', {deviceId:'other'}), row('2026-10-04', {context:{posture:'lying', caffeine:false}}), row('2026-10-05', {summary:{quality:'REVIEW', medianRT:250}}), row('2026-10-16')]
  assert.equal(baselineFor(current, wrong).days, 0)
})
test('schedule uses the survey timezone, date range and overnight windows', () => {
  const survey = {isActive: true, isRecurring: true, timezone: 'Europe/Belgrade', startDate: null, endDate: null, dailyStartTime:'06:00', dailyEndTime:'11:00'}
  assert.equal(localDay(new Date('2026-10-14T23:00:00Z'), survey.timezone), '2026-10-15')
  assert.equal(surveyOpen(survey, new Date('2026-10-15T05:00:00Z')), true)
  assert.equal(surveyOpen(survey, new Date('2026-10-15T12:00:00Z')), false)
  assert.equal(surveyOpen({...survey, dailyStartTime:'22:00', dailyEndTime:'02:00'}, new Date('2026-10-14T23:00:00Z')), true)
})

test('same-origin requests work behind Next proxy without accepting foreign origins', () => {
  const request = (origin) => new Request('http://localhost:4317/api/pvt/admin', {headers:{host:'127.0.0.1:4317',origin}})
  assert.equal(sameOrigin(request('http://127.0.0.1:4317')), true)
  assert.equal(sameOrigin(request('https://untrusted.invalid')), false)
  assert.equal(sameOrigin(request('http://127.0.0.1:9999')), false)
})

test('PVT migration is additive and atomic', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/manual-migrations/2026-10-handheld-pvt.sql'), 'utf8')
  assert.match(sql, /BEGIN;/); assert.match(sql, /COMMIT;/)
  assert.doesNotMatch(sql, /^(DROP|DELETE|UPDATE|TRUNCATE)\s/gm)
  const altered = [...sql.matchAll(/ALTER TABLE "public"\."([^"]+)"/g)].map(m=>m[1])
  assert.ok(altered.length > 0 && altered.every(name=>name.startsWith('pvt_')))
})
test('Vercel build cannot push or reset a database schema', () => {
  const command = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).scripts['vercel-build']
  assert.doesNotMatch(command, /db push|migrate|reset|accept-data-loss/)
})

test('legacy attempts may finish, while current protocol accepts only 30/60 seconds', () => {
  const result = run(90)
  assert.equal(validatePvtRecord(result, 90), false)
  assert.equal(validatePvtRecord(result, 90, 'handheld-pvt-v1'), true)
  assert.equal(validatePvtRecord(run(30), 30), true)
})
