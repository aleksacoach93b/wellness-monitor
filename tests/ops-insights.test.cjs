const { test, after } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-insights-'))
for (const name of [
  'opsInsights',
  'opsDates',
  'measurementEnvironment',
  'rhr/options',
  'rhr/protocol',
  'rhr/observationProtocol',
  'pvt/options',
  'pvt/protocol',
  'pvt/analysis',
]) {
  const out = path.join(dir, name + '.js')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(
    out,
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
  )
}
fs.symlinkSync(
  path.join(__dirname, '../node_modules'),
  path.join(dir, 'node_modules'),
  'dir',
)
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const { buildOpsInsights, aggregateReliability } = require(
    path.join(dir, 'opsInsights.js'),
  ),
  { validDay, shiftDay, zonedDay, dayWindow } = require(
    path.join(dir, 'opsDates.js'),
  ),
  { measurementEnvironment } = require(
    path.join(dir, 'measurementEnvironment.js'),
  ),
  { observationReport } = require(path.join(dir, 'rhr/observationProtocol.js'))
const p = { id: 'p', firstName: 'Fixture', lastName: 'One' },
  qf = { id: 'f', text: 'Focus', type: 'PVT' },
  qh = {
    id: 'h',
    text: 'HR',
    type: 'NUMBER',
    options: '{"widget":"RHR_CAMERA"}',
  }
const base = () => ({
  players: [p, { id: 'p2', firstName: 'Fixture', lastName: 'Two' }],
  questions: [qf, qh],
  responses: [],
  focus: [],
  hr: [],
  date: '2026-10-17',
  timezone: 'Europe/Belgrade',
  now: new Date('2026-10-17T12:00:00Z'),
  hrTrackingAvailable: true,
  focusAvailable: true,
  wellnessDays: {},
})
const focus = (id, day, over = {}) => ({
  id,
  playerId: 'p',
  questionId: 'f',
  responseId: 'r' + day,
  localDate: day,
  startedAt: new Date(day + 'T07:00:00Z'),
  finishedAt: new Date(day + 'T07:00:30Z'),
  status: 'COMPLETED',
  practice: false,
  durationSeconds: 30,
  protocolVersion: 'handheld-pvt-v5',
  deviceId: 'device-one',
  userAgent: 'iPhone Safari/1',
  context: { posture: 'seated', caffeine: false },
  summary: { medianRT: 250, quality: 'OK' },
  ...over,
})
const answer = (question, value) => ({
  questionId: question.id,
  question,
  value: JSON.stringify(value),
})
const response = (day, answers = [], over = {}) => ({
  id: 'r' + day,
  playerId: 'p',
  submittedAt: new Date(day + 'T08:00:00Z'),
  answers,
  ...over,
})
const hr = (over = {}) => ({
  id: 'hr',
  playerId: 'p',
  questionId: 'h',
  localDate: '2026-10-17',
  startedAt: new Date('2026-10-17T08:00:00Z'),
  finishedAt: null,
  status: 'ACCEPTED',
  source: 'SERVER',
  position: 'lying',
  protocolVersion: 'camera-rhr-v4',
  acquisitionVersion: 'android-metering-compat-v3',
  platform: 'Android',
  browser: 'Chrome',
  reason: null,
  bpm: 70,
  fps: 30,
  ...over,
})
const hrAnswer = (bpm = 70, position = 'lying') => ({
  kind: 'RHR',
  bpm,
  position,
  quality: 'ACCEPTED',
  protocolVersion: 'camera-rhr-v4',
  algorithmVersion: 'original-ppg-v1',
})
test('calendar validation rejects overflow and preserves leap days', () => {
  for (const d of ['2026-02-30', '2026-13-01', '2026-2-01', 'bad'])
    assert.equal(validDay(d), false)
  assert.equal(validDay('2024-02-29'), true)
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30')
})
for (const [date, hours] of [
  ['2026-03-29', 23],
  ['2026-10-25', 25],
  ['2026-10-17', 24],
])
  test('survey day boundaries respect DST ' + date, () => {
    const w = dayWindow(date, 'Europe/Belgrade')
    assert.equal((w.dayEnd - w.dayStart) / 3600000, hours)
    assert.equal(zonedDay(w.dayStart, 'Europe/Belgrade'), date)
    assert.equal(zonedDay(new Date(+w.dayEnd - 1), 'Europe/Belgrade'), date)
  })
test('coarse grouping identifies Samsung Internet and iOS Chrome without model guesses', () => {
  assert.deepEqual(
    measurementEnvironment('Android K Chrome/1 SamsungBrowser/30'),
    { platform: 'Android', browser: 'Samsung Internet' },
  )
  assert.deepEqual(measurementEnvironment('iPhone CriOS/1 Safari/1'), {
    platform: 'iOS',
    browser: 'Chrome',
  })
})
test('no data is pending rather than a fabricated zero or rate', () => {
  const x = buildOpsInsights(base())
  assert.equal(x.today[0].hr.state, 'pending')
  assert.equal(x.today[0].hr.items[0].value, null)
  assert.equal(x.weekly.players[0].wellness, null)
  assert.equal(x.weekly.reportingDays, 0)
  assert.equal(x.reliability.groups.length, 0)
})
test('questions created after selected day are not assigned retrospectively', () => {
  const x = buildOpsInsights({
    ...base(),
    questions: [{ ...qh, createdAt: new Date('2026-10-18T00:00:00Z') }],
  })
  assert.equal(x.today[0].hr.state, 'not-assigned')
})
test('accepted but unsubmitted results stay outside weekly saved totals', () => {
  const x = buildOpsInsights({
    ...base(),
    hr: [hr()],
    focus: [focus('f1', '2026-10-17', { responseId: null })],
  })
  assert.equal(x.today[0].hr.state, 'awaiting-submission')
  assert.equal(x.today[0].focus.state, 'awaiting-submission')
  assert.equal(x.weekly.hrSaved, 0)
  assert.equal(x.weekly.focusSaved, 0)
})
test('submitted receipt wins over other attempts and must match response/player/question', () => {
  const a = base()
  a.focus = [
    focus('first', '2026-10-17', {
      responseId: null,
      summary: { medianRT: 120, quality: 'OK' },
    }),
    focus('saved', '2026-10-17'),
  ]
  a.responses = [
    response('2026-10-17', [answer(qf, { kind: 'PVT', attemptId: 'saved' })]),
  ]
  let x = buildOpsInsights(a)
  assert.equal(x.today[0].focus.items[0].value, 250)
  assert.equal(x.today[0].focus.state, 'saved')
  a.focus[1].responseId = 'other-response'
  x = buildOpsInsights(a)
  assert.notEqual(x.today[0].focus.state, 'saved')
  assert.equal(x.weekly.focusSaved, 0)
})
test('practice and repeat-required sessions never become saved Focus results', () => {
  for (const patch of [
    { practice: true },
    { summary: { quality: 'OK', medianRT: 120, repeatRequired: true } },
    { status: 'INVALID' },
  ]) {
    const x = buildOpsInsights({
      ...base(),
      focus: [focus('a', '2026-10-17', patch)],
      responses: [
        response('2026-10-17', [answer(qf, { kind: 'PVT', attemptId: 'a' })]),
      ],
    })
    assert.equal(x.weekly.focusSaved, 0)
    assert.equal(x.today[0].focus.submitted, 0)
    if (!patch.practice) assert.equal(x.today[0].focus.items[0].value, null)
  }
})
test('latest questionnaire per local day prevents duplicate counting and uses survey timezone', () => {
  const x = buildOpsInsights({
    ...base(),
    responses: [
      response('2026-10-16', [answer(qh, hrAnswer(80))], {
        id: 'older',
        submittedAt: new Date('2026-10-16T22:10:00Z'),
      }),
      response('2026-10-17', [answer(qh, hrAnswer(70))], {
        submittedAt: new Date('2026-10-16T23:00:00Z'),
      }),
    ],
  })
  assert.equal(x.weekly.totalCheckins, 1)
  assert.equal(x.today[0].hr.items[0].value, 70)
  assert.equal(x.weekly.players[0].hr[0].median, 70)
  assert.equal(x.weekly.players[1].reportingDays, 1)
})
test('HR posture and Focus device/duration/caffeine contexts never mix', () => {
  const a = base()
  for (let n = 11; n <= 16; n++) {
    const day = '2026-10-' + n,
      id = 'f' + n
    a.focus.push(
      focus(id, day, {
        durationSeconds: n === 16 ? 60 : 30,
        deviceId: n === 15 ? 'other' : 'device-one',
        context: { posture: 'seated', caffeine: n === 14 },
      }),
    )
    a.responses.push(
      response(day, [
        answer(qf, { kind: 'PVT', attemptId: id }),
        answer(
          qh,
          hrAnswer(n === 16 ? 100 : 70, n === 16 ? 'standing' : 'lying'),
        ),
      ]),
    )
  }
  const x = buildOpsInsights(a).weekly.players[0]
  assert.equal(x.focus.length, 4)
  assert.equal(x.hr.length, 2)
  assert.equal(x.hr.find((m) => m.label.includes('standing')).median, 100)
})
test('week comparisons need three distinct days in both periods; repeated scans add no days', () => {
  const a = base()
  for (const n of [5, 6, 7, 12, 13, 14]) {
    const day = '2026-10-' + String(n).padStart(2, '0'),
      id = 'f' + n
    a.focus.push(
      focus(id, day, {
        summary: { quality: 'OK', medianRT: n < 10 ? 250 : 280 },
      }),
    )
    a.responses.push(
      response(day, [answer(qf, { kind: 'PVT', attemptId: id })]),
    )
  }
  const x = buildOpsInsights(a).weekly.players[0].focus[0]
  assert.equal(x.days, 3)
  assert.equal(x.previousDays, 3)
  assert.equal(x.delta, 30)
  a.responses.pop()
  assert.equal(buildOpsInsights(a).weekly.players[0].focus[0].delta, null)
})
test('Focus review is visible but excluded from weekly descriptive median', () => {
  const x = buildOpsInsights({
    ...base(),
    focus: [
      focus('a', '2026-10-17', {
        summary: { medianRT: 240, quality: 'REVIEW' },
      }),
    ],
    responses: [
      response('2026-10-17', [answer(qf, { kind: 'PVT', attemptId: 'a' })]),
    ],
  })
  assert.equal(x.today[0].focus.review, true)
  assert.equal(x.weekly.players[0].focus.length, 0)
})
test('inactive/out-of-team player rows cannot affect roster report', () => {
  const x = buildOpsInsights({
    ...base(),
    responses: [response('2026-10-17', [], { playerId: 'other' })],
    hr: [hr({ playerId: 'other' })],
  })
  assert.equal(x.weekly.totalCheckins, 0)
  assert.equal(x.reliability.attempts, 0)
})
test('stale starts are unfinished, active starts excluded from completion denominator', () => {
  const attempts = [
    'ACCEPTED',
    'REPEAT',
    'CAMERA_ERROR',
    'INTERRUPTED',
    'INCOMPLETE',
    'STARTED',
  ].map((status, i) => ({
    id: '' + i,
    playerId: 'p',
    test: 'HR',
    status,
    platform: 'Android',
    browser: 'Chrome',
    startedAt: new Date('2026-10-17T08:00:00Z'),
    reason: null,
    review: false,
    source: 'SERVER',
  }))
  attempts.push({
    ...attempts[5],
    id: 'active',
    startedAt: new Date('2026-10-17T11:59:00Z'),
  })
  const g = aggregateReliability(attempts, new Date('2026-10-17T12:00:00Z'))[0]
  assert.equal(g.inProgress, 1)
  assert.equal(g.unfinished, 2)
  assert.equal(g.rate, 100 / 6)
  assert.equal(
    buildOpsInsights({ ...base(), hr: [hr({ status: 'STARTED' })] }).today[0].hr
      .state,
    'repeat',
  )
})
test('client outcome schema cannot invent BPM, accepted results or raw diagnostic storage', () => {
  const report = {
    action: 'report',
    eventId: 'e24a765e-a61a-4629-80f4-a788b861d207',
    playerId: 'p',
    questionId: 'h',
    status: 'REPEAT',
    reason: 'signal-quality',
    protocolVersion: 'camera-rhr-v4',
    acquisitionVersion: 'android-metering-compat-v3',
  }
  assert.equal(observationReport.safeParse(report).success, true)
  for (const patch of [
    { status: 'ACCEPTED' },
    { bpm: 70 },
    { samples: [] },
    { cameraId: 'private' },
    { protocolVersion: 'invented' },
  ])
    assert.equal(
      observationReport.safeParse({ ...report, ...patch }).success,
      false,
    )
})

test('missing optional history is disclosed instead of marking an athlete as failed', () => {
  const x = buildOpsInsights({
    ...base(),
    hrTrackingAvailable: false,
    focusAvailable: false,
  })
  assert.equal(x.today[0].hr.state, 'unavailable')
  assert.equal(x.today[0].focus.state, 'unavailable')
})
