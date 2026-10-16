const { test, after } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rhr-test-'))
for (const name of ['protocol', 'options', 'server', 'camera'])
  fs.writeFileSync(
    path.join(dir, name + '.js'),
    ts.transpileModule(
      fs.readFileSync(
        path.join(__dirname, '../src/lib/rhr', name + '.ts'),
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText,
  )
fs.symlinkSync(
  path.join(__dirname, '../node_modules'),
  path.join(dir, 'node_modules'),
  'dir',
)
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const { analyzeRhr, validateRhrRecord } = require(path.join(dir, 'protocol.js'))
function signal(bpm, opts = {}) {
  const samples = []
  for (let t = 0; t <= 15000; t += 1000 / (opts.fps || 30)) {
    const wave = Math.sin((((2 * Math.PI * bpm) / 60) * t) / 1000),
      harm = 0.3 * Math.sin((((4 * Math.PI * bpm) / 60) * t) / 1000 + 0.4)
    samples.push({
      t,
      r: 180 + 3 * (wave + harm) + 0.7 * Math.sin(t / 1800),
      g: 75 + 2 * (wave + harm),
      b: 45,
      clipped: 0,
      spread: 0.05,
    })
  }
  return { samples, elapsedMs: 15000, interruption: null, torch: true }
}
for (const bpm of [30, 35, 40, 48, 60, 72, 90, 110, 140, 170])
  test(`15s optical signal at ${bpm} bpm`, () => {
    const a = analyzeRhr(signal(bpm))
    assert.equal(a.quality, 'ACCEPTED', JSON.stringify(a))
    assert.ok(Math.abs(a.bpm - bpm) <= 3, JSON.stringify(a))
  })
test('blank, flat, clipped, uncovered and interrupted scans have no result', () => {
  const noLight = { ...signal(60), torch: false }
  const flat = signal(60)
  flat.samples.forEach((s) => {
    s.r = 180
    s.g = 75
  })
  const clipped = signal(60)
  clipped.samples.forEach((s) => (s.clipped = 0.9))
  const uncovered = signal(60)
  uncovered.samples.forEach((s) => {
    s.r = 75
    s.g = 100
  })
  for (const record of [
    { ...signal(60), samples: [] },
    flat,
    noLight,
    clipped,
    uncovered,
    { ...signal(60), interruption: 'hidden' },
    {
      ...signal(60),
      elapsedMs: 14000,
      samples: signal(60).samples.filter((s) => s.t <= 14000),
    },
  ]) {
    const a = analyzeRhr(record)
    assert.equal(a.quality, 'REPEAT')
    assert.equal(a.bpm, null)
  }
})
test('gaps, low FPS and malformed timestamps are rejected', () => {
  const bad = signal(60)
  bad.samples[20].t = bad.samples[19].t
  assert.equal(validateRhrRecord(bad), false)
  const gaps = signal(60)
  gaps.samples = gaps.samples.filter((s) => s.t < 6000 || s.t > 6500)
  for (const r of [bad, gaps, signal(60, { fps: 15 })])
    assert.equal(analyzeRhr(r).bpm, null)
})
test('only the configured number widget is a camera HR question', () => {
  const { isRhrQuestion, rhrOptions, validRhrOptions } = require(
    path.join(dir, 'options.js'),
  )
  assert.ok(isRhrQuestion({ type: 'NUMBER', options: rhrOptions() }))
  assert.ok(validRhrOptions(rhrOptions()))
  assert.ok(!isRhrQuestion({ type: 'NUMBER', options: '[]' }))
  assert.ok(!isRhrQuestion({ type: 'TEXT', options: rhrOptions() }))
})
test('deterministic frame jitter, variable exposure drift and noise retain rate accuracy', () => {
  let seed = 123
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (const bpm of [38, 55, 80, 125]) {
    const r = signal(bpm)
    r.samples.forEach((s, i) => {
      s.t += i ? random() * 5 : 0
      s.r += (random() - 0.5) * 0.4
      s.g += (random() - 0.5) * 0.3
    })
    const a = analyzeRhr(r)
    assert.equal(a.quality, 'ACCEPTED', JSON.stringify(a))
    assert.ok(Math.abs(a.bpm - bpm) <= 3)
  }
})
test('random noise and a pulse changing sharply mid-scan are not accepted', () => {
  let seed = 5
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const noise = signal(60)
  noise.samples.forEach((s) => {
    s.r = 180 + random() * 4
    s.g = 75 + random() * 4
  })
  const unstable = signal(60)
  unstable.samples.forEach((s) => {
    if (s.t > 7500) {
      s.r = 180 + 3 * Math.sin((((2 * Math.PI * 110) / 60) * s.t) / 1000)
      s.g = 75 + 2 * Math.sin((((2 * Math.PI * 110) / 60) * s.t) / 1000)
    }
  })
  for (const r of [noise, unstable]) assert.equal(analyzeRhr(r).bpm, null)
})
test('signed results bind player, question and survey and ignore forged displayed bpm', async () => {
  process.env.ADMIN_JWT_SECRET = 'rhr-unit-test-only'
  const { signRhrResult, verifyRhrAnswer } = require(
    path.join(dir, 'server.js'),
  )
  const { RHR_VERSION } = require(path.join(dir, 'protocol.js'))
  const scope = { surveyId: 's', playerId: 'p', questionId: 'q' },
    a = {
      kind: 'RHR',
      bpm: 55,
      position: 'seated',
      rested: true,
      durationSeconds: 15,
      protocolVersion: RHR_VERSION,
      measuredAt: new Date().toISOString(),
      quality: 'ACCEPTED',
      torch: true,
      fps: 30,
      beats: 11,
      correlation: 0.95,
    }
  const receipt = await signRhrResult(a, scope),
    raw = JSON.stringify({ ...a, bpm: 1, receipt })
  assert.equal((await verifyRhrAnswer(raw, scope)).bpm, 55)
  for (const other of [
    { ...scope, playerId: 'other' },
    { ...scope, questionId: 'other' },
    { ...scope, surveyId: 'other' },
  ])
    assert.equal(await verifyRhrAnswer(raw, other), null)
  assert.equal(await verifyRhrAnswer(JSON.stringify(a), scope), null)
})

test('a measurement cannot silently extend beyond 15 seconds', () => {
  assert.equal(validateRhrRecord({ ...signal(60), elapsedMs: 15001 }), false)
})

test('camera light accepts Safari boolean and standard array capabilities', async () => {
  const { enableCameraLight, torchCapability } = require(
    path.join(dir, 'camera.js'),
  )
  for (const capability of [true, [true], [false, true]]) {
    let enabled = false
    const track = {
      readyState: 'live',
      getCapabilities: () => ({ torch: capability }),
      getSettings: () => ({ torch: enabled }),
      applyConstraints: async (q) => {
        enabled = q.torch === true || q.advanced?.some((x) => x.torch === true)
      },
    }
    assert.equal(await enableCameraLight(track), 'on')
    assert.equal(enabled, true)
  }
  for (const value of [false, [false]])
    assert.equal(torchCapability(value), 'unsupported')
  for (const value of [undefined, null, {}, [], 1, 'true'])
    assert.equal(torchCapability(value), 'unknown')
})
test('resolved constraints without positive settings require physical light confirmation', async () => {
  const { enableCameraLight } = require(path.join(dir, 'camera.js'))
  for (const reported of [false, undefined])
    assert.equal(
      await enableCameraLight({
        readyState: 'live',
        getCapabilities: () => ({ torch: true }),
        getSettings: () => ({ torch: reported }),
        applyConstraints: async () => {},
      }),
      'unconfirmed',
    )
})
test('camera light rejects unsupported/failed/stopped tracks and supports alternate constraint forms', async () => {
  const { enableCameraLight } = require(path.join(dir, 'camera.js'))
  const base = {
    readyState: 'live',
    getSettings: () => ({ torch: true }),
    getCapabilities: () => ({ torch: false }),
    applyConstraints: async () => {
      throw Error('must not apply')
    },
  }
  await assert.rejects(() => enableCameraLight(base), /does not support/)
  await assert.rejects(
    () => enableCameraLight({ ...base, readyState: 'ended' }),
    /stopped/,
  )
  await assert.rejects(
    () =>
      enableCameraLight({ ...base, getCapabilities: () => ({ torch: true }) }),
    /could not be switched on/,
  )
  let calls = 0
  const directOnly = {
    ...base,
    getCapabilities: () => ({ torch: true }),
    applyConstraints: async (q) => {
      calls++
      if (q.advanced) throw Error('unsupported advanced')
    },
  }
  assert.equal(await enableCameraLight(directOnly), 'on')
  assert.equal(calls, 3)
})

test('automatic rear selection prefers the main lens and never a named front/ultrawide lens', () => {
  const { primaryRearCamera } = require(path.join(dir, 'camera.js'))
  assert.equal(
    primaryRearCamera([
      { deviceId: 'front', label: 'Front Camera' },
      { deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
      { deviceId: 'back', label: 'Back Camera' },
    ]),
    'back',
  )
  assert.equal(
    primaryRearCamera([
      { deviceId: 'front', label: 'Front Camera' },
      { deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
    ]),
    null,
  )
})
