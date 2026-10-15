const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvt-unit-'))
for (const name of ['protocol', 'engine', 'baseline', 'server', 'options', 'export', 'visual']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/pvt', name + '.ts'), 'utf8')
  fs.writeFileSync(path.join(dir, name + '.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText)
}
// Only server.ts needs a package import from the repository.
fs.symlinkSync(path.join(__dirname, '../node_modules'), path.join(dir, 'node_modules'), 'dir')
const { PvtEngine } = require(path.join(dir, 'engine.js'))
const { randomWaitMs, summarizePvt, validatePvtRecord } = require(path.join(dir, 'protocol.js'))
const { baselineFor } = require(path.join(dir, 'baseline.js'))
const { surveyOpen, localDay, sameOrigin, contextSchema } = require(path.join(dir, 'server.js'))
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

test('context accepts standing and arbitrary valid awake minutes without changing test duration', () => {
  const context = {posture: 'standing', caffeine: false, minutesAwake: 75, deviceId: '12345678-1234-4234-8234-123456789012'}
  assert.equal(contextSchema.safeParse(context).success, true)
  for (const minutesAwake of [0, 30, 60, 90, 120, 180, 240, 1440]) assert.equal(contextSchema.safeParse({...context, minutesAwake}).success, true)
  for (const minutesAwake of [-1, 1441, 3.5]) assert.equal(contextSchema.safeParse({...context, minutesAwake}).success, false)
  assert.equal(contextSchema.safeParse({...context, posture: 'unsupported'}).success, false)
})


test('personal reference excludes records more than 28 calendar days before the test', () => {
  const current = row('2026-10-15')
  assert.equal(baselineFor(current, [row('2026-09-16'), row('2026-09-17'), row('2026-10-15')]).days, 1)
})

test('unified export preserves measured zeros and leaves absent results blank', () => {
  const { pvtExportValues } = require(path.join(dir, 'export.js'))
  assert.ok(Object.values(pvtExportValues('')).every(value => value === null))
  const receipt = JSON.stringify({kind:'PVT',attemptId:'a',durationSeconds:30,medianRT:1})
  const s = {id:'a',durationSeconds:30,protocolVersion:'v3',status:'COMPLETED',practice:false,questionId:'q',localDate:'2026-10-15',startedAt:'2026-10-15T08:00:00Z',finishedAt:'2026-10-15T08:00:30Z',context:{posture:'standing',caffeine:false,minutesAwake:0},summary:{medianRT:250,responses:10,falseStarts:0,slowResponses:0,slowPercent:0,responseSpeed:4,quality:'OK',flags:[]}}
  const values = pvtExportValues(receipt, s)
  assert.equal(values['Median RT ms'], 250)
  assert.equal(values['Early taps'], 0)
  assert.equal(values['Slow responses percent (exploratory)'], 0)
  assert.equal(values['Caffeine 0 or 1'], 0)
  assert.equal(values['Minutes since waking'], 0)
  assert.equal(values.Position, 'standing')
  assert.equal(values['Completed at UTC'], '2026-10-15T08:00:30.000Z')
})

test('export joins only the explicit completed attempt for the same response, player and question', () => {
  const { linkedPvtSession } = require(path.join(dir, 'export.js'))
  const receipt = JSON.stringify({kind:'PVT',attemptId:'a'})
  const s = {id:'a',responseId:'r',playerId:'p',questionId:'q',practice:false,status:'COMPLETED'}
  const match = patch => linkedPvtSession(receipt,new Map([['a',{...s,...patch}]]),'r','p','q')
  assert.equal(match({}).id, 'a')
  for (const patch of [{responseId:'other'}, {playerId:'other'}, {questionId:'other'}, {practice:true}, {status:'INTERRUPTED'}]) assert.equal(match(patch),undefined)
  assert.equal(linkedPvtSession('',new Map([['a',s]]),'r','p','q'),undefined)
})


test('donut caps its visual fill at 500ms while keeping the full counter and raw reaction time', () => {
  const { pvtVisualFrame, pvtRingFraction } = require(path.join(dir, 'visual.js'))
  assert.equal(pvtRingFraction(355), .71)
  assert.equal(pvtRingFraction(500), 1)
  assert.equal(pvtRingFraction(720), 1)
  assert.equal(pvtRingFraction(-1), 0)
  const late = pvtVisualFrame(true, 720, '', false)
  assert.equal(late.text, '720'); assert.equal(late.fill, 1); assert.equal(late.numeric, true)
  const result = run(30, 720)
  assert.equal(validatePvtRecord(result, 30), true)
  assert.equal(summarizePvt(result, 30).medianRT, 720)
})

test('donut is stationary before a signal and freezes feedback without counting into the next wait', () => {
  const { pvtVisualFrame } = require(path.join(dir, 'visual.js'))
  assert.deepEqual(pvtVisualFrame(false, 900, '', false), {text:'WAIT',numeric:false,fill:0,status:'WAIT FOR THE SIGNAL'})
  assert.equal(pvtVisualFrame(true, 0, '', false).text, '000')
  assert.equal(pvtVisualFrame(false, 0, '720 ms', true).fill, 1)
  assert.equal(pvtVisualFrame(false, 0, '720 ms', true).text, '720')
  assert.equal(pvtVisualFrame(false, 0, '720 ms', false).fill, 0)
  assert.equal(pvtVisualFrame(false, 0, 'TOO EARLY', true).numeric, false)
})

test('old square sessions remain valid and cannot enter the new donut reference', () => {
  const current = row('2026-10-15', {protocolVersion:'handheld-pvt-v4'})
  const squareDays = Array.from({length:7}, (_,i) => row(`2026-10-0${i+1}`, {protocolVersion:'handheld-pvt-v3'}))
  assert.equal(baselineFor(current, squareDays).days, 0)
  assert.equal(validatePvtRecord(run(30), 30, 'handheld-pvt-v3'), true)
  assert.equal(validatePvtRecord(run(60), 60, 'handheld-pvt-v3'), true)
  assert.equal(validatePvtRecord(run(30), 30, 'unknown'), false)
  const {validPvtOptions}=require(path.join(dir, 'options.js'))
  assert.equal(validPvtOptions(JSON.stringify({durationSeconds:30,protocolVersion:'handheld-pvt-v3'})),true)
})
