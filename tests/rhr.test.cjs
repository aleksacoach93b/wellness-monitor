const { test, after } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rhr-test-'))
for (const name of [
  'protocol',
  'options',
  'server',
  'camera',
  'sampling',
  'session',
])
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
  for (const r of [bad, gaps, signal(60, { fps: 10 })])
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
  const { RHR_LEGACY_VERSION: RHR_VERSION } = require(
    path.join(dir, 'protocol.js'),
  )
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

test('legacy v1 measurement cannot silently extend beyond 15 seconds', () => {
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

test('15/24/60 fps streams retain agreement and do not bypass short/gapped-record rejection', () => {
  for (const fps of [15, 24, 60])
    for (const bpm of [40, 65, 120, 170]) {
      const a = analyzeRhr(signal(bpm, { fps }))
      assert.equal(a.quality, 'ACCEPTED', JSON.stringify({ fps, bpm, a }))
      assert.ok(Math.abs(a.bpm - bpm) <= 3, JSON.stringify(a))
    }
})
test('clipped red and green channels can use a real usable blue pulse', () => {
  const r = signal(65)
  r.samples.forEach((s) => {
    s.r = 255
    s.g = 255
    s.b = 50 + 2 * Math.sin((((2 * Math.PI * 65) / 60) * s.t) / 1000)
    s.redClipped = 1
    s.greenClipped = 1
    s.blueClipped = 0
  })
  const a = analyzeRhr(r)
  assert.equal(a.quality, 'ACCEPTED', JSON.stringify(a))
  assert.equal(a.channel, 'blue')
  assert.ok(Math.abs(a.bpm - 65) <= 3)
})
test('a low-amplitude green pulse survives red saturation/exposure changes; random low-amplitude noise does not', () => {
  const r = signal(55)
  r.samples.forEach((s, i) => {
    s.r = i % 3 ? 255 : 230
    s.g = 70 + 0.08 * Math.sin((((2 * Math.PI * 55) / 60) * s.t) / 1000)
    s.redClipped = i % 3 ? 1 : 0
    s.greenClipped = 0
  })
  const a = analyzeRhr(r)
  assert.equal(a.quality, 'ACCEPTED', JSON.stringify(a))
  assert.equal(a.channel, 'green')
  assert.ok(Math.abs(a.bpm - 55) <= 3)
  let seed = 7
  r.samples.forEach((s) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    s.g = 70 + (seed / 4294967296 - 0.5) * 0.16
  })
  assert.equal(analyzeRhr(r).bpm, null)
})
test('warm color balance and isolated extreme pixels do not veto a stable optical pulse', () => {
  const { samplePixels } = require(path.join(dir, 'sampling.js'))
  const pixels = new Uint8ClampedArray(32 * 32 * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 180
    pixels[i + 1] = 160
    pixels[i + 2] = 65
    pixels[i + 3] = 255
  }
  pixels[0] = 0
  pixels[4] = 255
  const s = samplePixels(pixels, 0)
  assert.ok(s.spread < 0.05)
  const r = signal(65)
  r.samples.forEach((s) => {
    s.g = 170 + 2 * Math.sin((((2 * Math.PI * 65) / 60) * s.t) / 1000)
  })
  assert.equal(analyzeRhr(r).quality, 'ACCEPTED')
})
test('per-channel clipping is bounded by both validation and the server schema', () => {
  const { rhrRecordSchema } = require(path.join(dir, 'server.js'))
  const r = signal(65)
  r.samples[0].redClipped = 2
  assert.equal(validateRhrRecord(r), false)
  assert.equal(rhrRecordSchema.safeParse(r).success, false)
  r.samples[0].redClipped = 0.2
  assert.equal(rhrRecordSchema.parse(r).samples[0].redClipped, 0.2)
})
test('exposure adjustments respect the reported EV range, preserve torch and are optional', async () => {
  const { adjustPulseExposure, configurePulseCamera } = require(
    path.join(dir, 'camera.js'),
  )
  const calls = []
  let ev = 0
  const track = {
    readyState: 'live',
    getCapabilities: () => ({
      exposureCompensation: { min: -1, max: 1, step: 0.5 },
      frameRate: { min: 15, max: 60 },
    }),
    getSettings: () => ({ exposureCompensation: ev }),
    applyConstraints: async (q) => {
      calls.push(q)
      if (q.advanced?.[0]?.exposureCompensation !== undefined)
        ev = q.advanced[0].exposureCompensation
    },
  }
  await configurePulseCamera(track)
  assert.equal(calls[0].frameRate.ideal, 30)
  assert.equal(calls[0].advanced[0].torch, true)
  for (let i = 0; i < 4; i++)
    await adjustPulseExposure(track, { r: 255, g: 255, clipped: 1 })
  assert.equal(ev, -1)
  assert.equal(calls.length, 3)
  assert.ok(calls.every((q) => q.advanced[0].torch))
  assert.equal(
    await adjustPulseExposure(
      { ...track, getCapabilities: () => ({}) },
      { r: 255, g: 255, clipped: 1 },
    ),
    false,
  )
})

function qualitySignal({
  bpm = 65,
  changeAt = Infinity,
  nextBpm = 80,
  dropout = false,
  flat = false,
  fps = 30,
} = {}) {
  const { RHR_VERSION } = require(path.join(dir, 'protocol.js'))
  const samples = []
  let phase = 0
  for (let t = 0; t <= 60000; t += 1000 / fps) {
    const rate = t < changeAt ? bpm : nextBpm
    phase += (2 * Math.PI * rate) / 60 / fps
    const v = flat ? 0 : Math.sin(phase) + 0.3 * Math.sin(phase * 2 + 0.4)
    const lost = dropout && t >= 8000 && t < 8500
    samples.push({
      t,
      r: lost ? 25 : 180 + 3 * v,
      g: lost ? 25 : 75 + 2 * v,
      b: 45,
      clipped: 0,
      spread: 0.05,
    })
  }
  return {
    protocolVersion: RHR_VERSION,
    samples,
    elapsedMs: 60000,
    interruption: null,
    torch: true,
  }
}
function finishQuality(record) {
  const { RhrSession } = require(path.join(dir, 'session.js'))
  const session = new RhrSession(),
    samples = []
  for (const sample of record.samples) {
    samples.push(sample)
    const view = session.push(sample)
    if (view.stage === 'complete')
      return {
        record: {
          ...record,
          samples,
          elapsedMs: Math.max(sample.t, view.analysis.completeAtMs),
        },
        view,
      }
  }
  return { record, view: session.advanceTo(record.elapsedMs) }
}
for (const bpm of [30, 40, 55, 80, 110, 170])
  test(`quality session detects then verifies 10s at ${bpm} bpm`, () => {
    const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
    const { record, view } = finishQuality(qualitySignal({ bpm }))
    assert.equal(view.stage, 'complete', JSON.stringify(view))
    assert.ok(record.elapsedMs >= 15000 && record.elapsedMs < 22000)
    assert.ok(view.analysis.windowStartMs >= 5000)
    assert.ok(view.analysis.completeAtMs - view.analysis.windowStartMs >= 10000)
    const a = analyzeRhrRecord(record)
    assert.equal(a.quality, 'ACCEPTED', JSON.stringify(a))
    assert.ok(Math.abs(a.bpm - bpm) <= 3)
  })
test('110 to 80 change restarts the stable countdown and discards the old window', () => {
  const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
  const { record, view } = finishQuality(
    qualitySignal({ bpm: 110, changeAt: 10000, nextBpm: 80 }),
  )
  assert.equal(view.stage, 'complete', JSON.stringify(view))
  assert.ok(view.restarts >= 1)
  assert.ok(view.analysis.windowStartMs >= 10000)
  assert.ok(record.elapsedMs > 20000)
  assert.ok(Math.abs(analyzeRhrRecord(record).bpm - 80) <= 3)
})
test('lost contact restarts acquisition and continuous noise/flat signals stop at 60s without a result', () => {
  const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
  const good = finishQuality(qualitySignal({ dropout: true }))
  assert.equal(good.view.stage, 'complete')
  assert.ok(good.view.restarts >= 1)
  assert.ok(good.record.elapsedMs > 20000)
  const flat = finishQuality(qualitySignal({ flat: true }))
  assert.equal(flat.view.stage, 'timeout')
  assert.equal(analyzeRhrRecord(flat.record).bpm, null)
  assert.ok(Math.abs(analyzeRhrRecord(flat.record).fps - 30) < 1)
  assert.ok(analyzeRhrRecord(flat.record).reasons.includes('signal-timeout'))
})
test('v2 replay rejects stale, interrupted, oversized, missing-tail and forged display metadata', () => {
  const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
  const finished = finishQuality(qualitySignal())
  assert.equal(
    analyzeRhrRecord({ ...finished.record, elapsedMs: 40000 }).bpm,
    null,
  )
  assert.equal(
    analyzeRhrRecord({ ...finished.record, interruption: 'hidden' }).bpm,
    null,
  )
  assert.equal(
    analyzeRhrRecord({ ...finished.record, elapsedMs: 60001 }).bpm,
    null,
  )
  assert.equal(
    analyzeRhrRecord({
      ...finished.record,
      samples: finished.record.samples.filter((s) => s.t < 13000),
    }).bpm,
    null,
  )
  assert.equal(
    analyzeRhrRecord({ ...finished.record, bpm: 110, restarts: 0 }).bpm,
    65,
  )
})
test('both widget generations remain valid and v2 receipts bind actual duration and restarts', async () => {
  process.env.ADMIN_JWT_SECRET = 'rhr-unit-test-only'
  const { validRhrOptions, rhrExportValues } = require(
    path.join(dir, 'options.js'),
  )
  const { signRhrResult, verifyRhrAnswer } = require(
    path.join(dir, 'server.js'),
  )
  for (const protocolVersion of ['camera-rhr-v1', 'camera-rhr-v2'])
    assert.ok(
      validRhrOptions(
        JSON.stringify({
          widget: 'RHR_CAMERA',
          protocolVersion,
          durationSeconds: 15,
        }),
      ),
    )
  const a = {
    kind: 'RHR',
    bpm: 80,
    position: 'seated',
    rested: true,
    durationSeconds: 26,
    targetDurationSeconds: 15,
    detectionSeconds: 5,
    stableWindowSeconds: 10,
    restarts: 2,
    protocolVersion: 'camera-rhr-v2',
    algorithmVersion: 'quality-window-v3',
    measuredAt: new Date().toISOString(),
    quality: 'ACCEPTED',
    torch: true,
    fps: 30,
    beats: 12,
    correlation: 0.9,
  }
  const scope = { surveyId: 's', playerId: 'p', questionId: 'q' },
    receipt = await signRhrResult(a, scope)
  const saved = await verifyRhrAnswer(
    JSON.stringify({
      ...a,
      durationSeconds: 15,
      restarts: 0,
      bpm: 110,
      receipt,
    }),
    scope,
  )
  assert.equal(saved.bpm, 80)
  assert.equal(saved.durationSeconds, 26)
  assert.equal(saved.restarts, 2)
  assert.equal(rhrExportValues(JSON.stringify(saved))['Duration s'], 26)
  const invalidReceipt = await signRhrResult(
    { ...a, stableWindowSeconds: 2 },
    scope,
  )
  assert.equal(
    await verifyRhrAnswer(
      JSON.stringify({ ...a, receipt: invalidReceipt }),
      scope,
    ),
    null,
  )
})

test('quality capture tolerates 15/24/60fps but rejects low-rate, gapped and random signals', () => {
  const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
  for (const fps of [15, 24, 60]) {
    const r = finishQuality(qualitySignal({ bpm: 65, fps }))
    assert.equal(r.view.stage, 'complete')
    assert.ok(Math.abs(analyzeRhrRecord(r.record).bpm - 65) <= 3)
  }
  const slow = finishQuality(qualitySignal({ fps: 10 }))
  assert.equal(slow.view.stage, 'timeout')
  const noise = qualitySignal()
  let seed = 9
  noise.samples.forEach((s) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    s.r = 180 + (seed / 4294967296 - 0.5) * 5
    seed = (seed * 1664525 + 1013904223) >>> 0
    s.g = 75 + (seed / 4294967296 - 0.5) * 4
  })
  assert.equal(finishQuality(noise).view.stage, 'timeout')
})

test('discrete camera levels do not discard a stable pulse solely because of flat-topped peaks', () => {
  const { analyzeRhrRecord } = require(path.join(dir, 'session.js'))
  const record = qualitySignal({ bpm: 55 })
  record.samples.forEach((s) => {
    s.r = Math.round(s.r)
    s.g = Math.round(s.g)
  })
  const finished = finishQuality(record)
  assert.equal(finished.view.stage, 'complete', JSON.stringify(finished.view))
  assert.ok(Math.abs(analyzeRhrRecord(finished.record).bpm - 55) <= 3)
})
