// Owned synthetic camera only. No OS camera, API writes or player data.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.RHR_PLAYWRIGHT_MODULE || 'playwright')
const mode = process.env.RHR_SCENARIO || 'stable'
const base = process.env.RHR_BASE || 'http://127.0.0.1:4328'
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.RHR_BROWSER
      ? { executablePath: process.env.RHR_BROWSER }
      : {}),
  })
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      ...(mode.startsWith('android')
        ? {
            userAgent:
              'Mozilla/5.0 (Linux; Android 15; HONOR) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36',
          }
        : {}),
      ...(mode === 'iphone-controls'
        ? {
            userAgent:
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
          }
        : {}),
    })
    await ctx.route('**/api/**', (r) =>
      r.request().method() === 'GET' ? r.continue() : r.abort(),
    )
    await ctx.addInitScript((mode) => {
      window.__calls = []
      window.__stops = 0
      window.__light = false
      window.__optimized = false
      window.__scanStart = null
      window.__exposureCalls = 0
      window.__holdCalls = []
      window.__releaseCalls = 0
      window.__changesInCapture = 0
      window.__gainCalls = []
      document.addEventListener(
        'click',
        (e) => {
          if (
            e.target.closest('button')?.textContent.trim() ===
            'Start measurement'
          )
            window.__scanStart = performance.now()
        },
        true,
      )
      navigator.mediaDevices.enumerateDevices = async () =>
        mode === 'flat'
          ? [{ kind: 'videoinput', deviceId: 'main', label: 'Back Camera' }]
          : [
              { kind: 'videoinput', deviceId: 'main', label: 'Back Camera' },
              {
                kind: 'videoinput',
                deviceId: 'wide',
                label: 'Back Ultra Wide Camera',
              },
            ]
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const requested = constraints.video.deviceId?.exact || 'main'
        const id = mode === 'mismatch' ? 'main' : requested
        window.__calls.push({ requested, actual: id })
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        const x = canvas.getContext('2d'),
          created = performance.now()
        let ev = 0,
          applied = {},
          iso = 100
        const controls = {
          whiteBalanceMode: 'continuous',
          focusMode: 'continuous',
          exposureMode: 'continuous',
          focusDistance: 0.11,
          exposureTime: 80,
        }
        const draw = () => {
          const t = (performance.now() - (window.__scanStart ?? created)) / 1000
          const phase = (2 * Math.PI * 55 * t) / 60
          const v =
            mode === 'flat' ||
            mode === 'android-ignored' ||
            (mode === 'switch' && id === 'main')
              ? 0
              : Math.sin(phase) + 0.3 * Math.sin(phase * 2 + 0.4)
          const redCeiling =
            mode.startsWith('exposure') && (mode !== 'exposure' || ev > -2)
          x.fillStyle = redCeiling
            ? 'rgb(253,0,0)'
            : `rgb(${Math.round(180 + 8 * v)},${Math.round(75 + 5 * v)},45)`
          if (mode === 'android' && controls.exposureMode !== 'manual')
            x.fillStyle = `rgb(180,${Math.round(40 + ((t * 10) % 40))},15)`
          if (mode === 'android-rollback' && controls.exposureMode === 'manual')
            x.fillStyle = 'rgb(5,1,0)'
          if (mode.startsWith('android-gain')) {
            const flat = [
              'android-gain-ignored',
              'android-gain-no-effect',
            ].includes(mode)
            const w = flat ? 0 : v
            if (controls.exposureMode === 'manual') {
              const gain =
                mode === 'android-gain-no-effect' ? 1 : Math.sqrt(iso / 100)
              x.fillStyle = `rgb(${Math.round((87 + 2 * w) * gain)},${Math.round((9 + 0.5 * w) * gain)},0)`
            } else
              x.fillStyle = `rgb(${Math.round(180 + 8 * w)},${Math.round(75 + 5 * w)},45)`
          }
          x.fillRect(0, 0, 128, 128)
        }
        draw()
        let timer = setInterval(
          draw,
          mode === 'slow' || mode === 'ignored' ? 67 : 33,
        )
        const stream = canvas.captureStream(30),
          track = stream.getVideoTracks()[0],
          originalStop = track.stop.bind(track)
        track.stop = () => {
          clearInterval(timer)
          window.__stops++
          window.__light = false
          originalStop()
        }
        track.getSettings = () => ({
          deviceId: id,
          facingMode: 'environment',
          frameRate: 30,
          width: 320,
          height: 240,
          torch: window.__light,
          exposureCompensation: ev,
          ...controls,
          ...(mode.startsWith('android-gain')
            ? {
                iso,
                exposureMode:
                  controls.exposureMode === 'manual'
                    ? 'none'
                    : controls.exposureMode,
              }
            : {}),
        })
        track.getConstraints = () => applied
        track.getCapabilities = () => ({
          torch: true,
          frameRate: { min: 15, max: 60 },
          ...(mode.startsWith('android-gain')
            ? {
                iso: {
                  min: 100,
                  max: mode === 'android-gain-limit' ? 100 : 203936,
                  step: 1,
                },
              }
            : {}),
          ...(mode.startsWith('android') || mode === 'iphone-controls'
            ? {
                whiteBalanceMode:
                  mode === 'android-unsupported'
                    ? ['continuous']
                    : ['continuous', 'manual'],
                focusMode:
                  mode === 'android-unsupported'
                    ? ['continuous']
                    : ['continuous', 'manual'],
                exposureMode:
                  mode === 'android-unsupported'
                    ? ['continuous']
                    : ['continuous', 'manual'],
              }
            : {}),
          ...(mode !== 'exposure-unsupported'
            ? { exposureCompensation: { min: -4, max: 4, step: 1 / 6 } }
            : {}),
        })
        track.applyConstraints = async (q) => {
          if (window.__scanStart !== null) window.__changesInCapture++
          if (mode === 'android-cancel' && q.whiteBalanceMode === 'manual')
            await new Promise((resolve) => setTimeout(resolve, 800))
          if (mode === 'android-gain-cancel' && q.iso !== undefined)
            await new Promise((resolve) => setTimeout(resolve, 800))
          if (track.readyState !== 'live') throw Error('Camera stopped')
          if (q.iso !== undefined) {
            window.__gainCalls.push(q.iso)
            if (mode !== 'android-gain-ignored') iso = q.iso
          }
          for (const k of ['whiteBalanceMode', 'focusMode', 'exposureMode']) {
            if (q[k] !== undefined && q[k] !== controls[k]) {
              window.__holdCalls.push({ mode: k, requested: q[k] })
              if (k === 'exposureMode' && q[k] === 'continuous')
                window.__releaseCalls++
              if (mode !== 'android-ignored') controls[k] = q[k]
            }
          }
          applied = q
          if (typeof q.exposureCompensation === 'number') {
            window.__exposureCalls++
            if (mode !== 'exposure-ignored') ev = q.exposureCompensation
          }
          window.__light =
            q.torch === true || !!q.advanced?.some((a) => a.torch === true)
          if (q.width?.ideal === 160 && mode !== 'ignored') {
            clearInterval(timer)
            timer = setInterval(draw, 33)
            window.__optimized = true
          }
        }
        return stream
      }
    }, mode)
    const page = await ctx.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    const setup = async () => {
      await page.goto(base + '/rhr/demo?cameraCheck=1')
      await page
        .getByRole('button', { name: 'Measure resting HR', exact: true })
        .click()
      await page.getByRole('button', { name: 'Seated', exact: true }).click()
      await page
        .getByRole('checkbox', {
          name: 'I have rested quietly for at least 5 minutes.',
        })
        .check()
      await page
        .getByRole('button', { name: 'Enable rear camera', exact: true })
        .click()
    }
    const ready = async () => {
      await page
        .getByTestId('rhr-preflight-hint')
        .filter({ hasText: 'Camera check passed' })
        .waitFor({ timeout: 12000 })
      assert.ok(
        await page
          .getByRole('button', { name: 'Start measurement', exact: true })
          .isEnabled(),
      )
    }
    const finish = async () => {
      const start = Date.now()
      await page
        .getByRole('button', { name: 'Start measurement', exact: true })
        .click()
      await page.getByTestId('rhr-done').waitFor({ timeout: 20000 })
      assert.ok(Date.now() - start >= 14900 && Date.now() - start < 19000)
      assert.ok(
        Math.abs(Number(await page.getByTestId('rhr-bpm').innerText()) - 55) <=
          3,
      )
      assert.equal(await page.evaluate(() => window.__light), false)
    }
    await setup()
    if (mode === 'android-gain-cancel') {
      await page
        .getByTestId('rhr-hold-note')
        .filter({ hasText: 'Optimizing camera lighting' })
        .waitFor({ timeout: 12000 })
      await page
        .getByRole('button', { name: 'Close resting HR', exact: true })
        .click()
      await page.waitForTimeout(1000)
      assert.equal(await page.getByRole('dialog').count(), 0)
    } else if (mode.startsWith('android-gain')) {
      await ready()
      if (['android-gain-ignored', 'android-gain-no-effect'].includes(mode)) {
        await page
          .getByRole('button', { name: 'Start measurement', exact: true })
          .click()
        await page.getByTestId('rhr-repeat').waitFor({ timeout: 20000 })
        await page.getByText('Scan details', { exact: true }).click()
        const downloading = page.waitForEvent('download')
        await page
          .getByRole('button', { name: 'Download signal diagnostics' })
          .click()
        const data = JSON.parse(
          require('node:fs').readFileSync(
            await (await downloading).path(),
            'utf8',
          ),
        )
        assert.equal(
          data.capture.acquisitionVersion,
          'android-adaptive-gain-v2',
        )
        assert.equal(data.capture.gainAdjustments.length, 1)
        assert.equal(data.capture.cameraHold.exposureReleased, true)
        assert.equal(data.analysis.bpm, null)
        assert.equal(data.record.elapsedMs, 15000)
        if (mode === 'android-gain-no-effect')
          assert.equal(
            data.capture.gainAdjustments[0].imageResponse,
            'no-response',
          )
        else assert.equal(data.capture.gainAdjustments[0].status, 'ignored')
      } else {
        await finish()
        if (mode === 'android-gain')
          assert.deepEqual(
            await page.evaluate(() => [...new Set(window.__gainCalls)]),
            [200, 400],
          )
      }
      assert.equal(await page.evaluate(() => window.__changesInCapture), 0)
      assert.equal(
        await page.evaluate(() => window.__releaseCalls),
        mode === 'android-gain' ? 0 : 1,
      )
    } else if (mode.startsWith('android')) {
      await page.getByTestId('rhr-hold-note').waitFor({ timeout: 12000 })
      if (mode === 'android-cancel') {
        await page
          .getByRole('button', { name: 'Close resting HR', exact: true })
          .click()
        await page.waitForTimeout(1000)
        assert.equal(await page.getByRole('dialog').count(), 0)
      } else {
        await ready()
        if (mode === 'android-ignored') {
          await page
            .getByRole('button', { name: 'Start measurement', exact: true })
            .click()
          await page.getByTestId('rhr-repeat').waitFor({ timeout: 20000 })
          await page.getByText('Scan details', { exact: true }).click()
          const downloading = page.waitForEvent('download')
          await page
            .getByRole('button', { name: 'Download signal diagnostics' })
            .click()
          const data = JSON.parse(
            require('node:fs').readFileSync(
              await (await downloading).path(),
              'utf8',
            ),
          )
          assert.equal(
            data.capture.acquisitionVersion,
            'android-adaptive-gain-v2',
          )
          assert.ok(
            data.capture.cameraHold.controls.some(
              (c) => c.status === 'requested',
            ),
          )
          assert.ok(data.capture.settingsTrace.length >= 10)
          assert.equal(data.analysis.bpm, null)
          assert.equal(data.record.elapsedMs, 15000)
        } else await finish()
        assert.equal(
          await page.evaluate(() => window.__releaseCalls),
          mode === 'android-rollback' ? 1 : 0,
        )
        assert.equal(await page.evaluate(() => window.__changesInCapture), 0)
      }
    } else if (mode.startsWith('exposure')) {
      await page.getByTestId('rhr-exposure-note').waitFor({ timeout: 10000 })
      if (mode === 'exposure') {
        await ready()
        assert.equal(await page.evaluate(() => window.__exposureCalls), 2)
        await finish()
      } else {
        await page
          .getByTestId('rhr-exposure-note')
          .filter({
            hasText:
              mode === 'exposure-no-effect' ? 'still almost flat' : /could not/,
          })
          .waitFor({ timeout: 15000 })
        if (mode !== 'exposure-no-effect')
          await page
            .getByTestId('rhr-preflight-hint')
            .filter({ hasText: 'fresh frames' })
            .waitFor()
        await page
          .getByTestId('rhr-preflight-hint')
          .filter({ hasText: 'red image is near' })
          .waitFor()
        assert.equal(
          await page
            .getByRole('button', { name: 'Start measurement', exact: true })
            .isEnabled(),
          false,
        )
        await page.getByText('Camera details', { exact: true }).click()
        const saving = page.waitForEvent('download')
        await page
          .getByRole('button', {
            name: 'Download camera diagnostics',
            exact: true,
          })
          .click()
        const data = JSON.parse(
          require('node:fs').readFileSync(await (await saving).path(), 'utf8'),
        )
        assert.equal(data.check.code, 'red-ceiling')
        assert.equal(data.check.stats.clipped, 0)
        assert.ok(data.check.stats.redCeilingFraction > 0.95)
        assert.equal(
          data.exposureAdjustments.length,
          mode === 'exposure-no-effect' ? 4 : 1,
        )
        assert.equal(
          data.exposureAdjustments.at(-1).status,
          mode === 'exposure-no-effect'
            ? 'requested'
            : mode === 'exposure-ignored'
              ? 'ignored'
              : 'unsupported',
        )
      }
    } else if (mode === 'slow' || mode === 'ignored') {
      await page.getByTestId('rhr-improve-stream').waitFor({ timeout: 12000 })
      assert.equal(
        await page
          .getByRole('button', { name: 'Start measurement', exact: true })
          .isEnabled(),
        false,
      )
      assert.match(
        await page.getByTestId('rhr-preflight-hint').innerText(),
        /fps/,
      )
      if (process.env.RHR_SCREENSHOT)
        await page.screenshot({
          path: process.env.RHR_SCREENSHOT,
          fullPage: true,
        })
      await page.getByText('Camera details', { exact: true }).click()
      const saving = page.waitForEvent('download')
      await page
        .getByRole('button', {
          name: 'Download camera diagnostics',
          exact: true,
        })
        .click()
      const setupFile = await (await saving).path()
      const setupData = JSON.parse(
        require('node:fs').readFileSync(setupFile, 'utf8'),
      )
      assert.equal(setupData.diagnosticKind, 'camera-setup')
      // Requested/reported rate is 30, but the real frame clock is about 15.
      assert.equal(setupData.camera.settings.frameRate, 30)
      assert.ok(setupData.check.stats.fps < 20)
      await page.getByTestId('rhr-improve-stream').click()
      if (mode === 'ignored') {
        await page.getByTestId('rhr-improve-stream').waitFor({ timeout: 12000 })
        assert.equal(
          await page
            .getByRole('button', { name: 'Start measurement', exact: true })
            .isEnabled(),
          false,
        )
      } else {
        await ready()
        await finish()
        assert.equal(
          await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('rhr-working-stream-v1')).compact,
          ),
          true,
        )
        await page.getByTestId('rhr-done').click()
        await setup()
        await ready()
        assert.equal(
          await page.evaluate(() => window.__optimized),
          true,
          'A previously successful compact stream is restored',
        )
      }
    } else {
      await ready()
      if (mode === 'mismatch') {
        await page
          .getByRole('combobox', { name: 'Rear camera' })
          .selectOption('wide')
        await page
          .getByRole('alert')
          .filter({ hasText: 'could not be verified' })
          .waitFor()
        assert.equal(
          await page
            .getByRole('button', { name: 'Start measurement', exact: true })
            .count(),
          0,
        )
      } else if (mode === 'flat' || mode === 'switch') {
        await page
          .getByRole('button', { name: 'Start measurement', exact: true })
          .click()
        await page.getByTestId('rhr-repeat').waitFor({ timeout: 20000 })
        await page.getByText('Scan details', { exact: true }).click()
        const downloading = page.waitForEvent('download')
        await page
          .getByRole('button', { name: 'Download signal diagnostics' })
          .click()
        const file = await (await downloading).path(),
          data = JSON.parse(require('node:fs').readFileSync(file, 'utf8'))
        assert.equal(data.record.protocolVersion, 'camera-rhr-v4')
        assert.equal(data.record.elapsedMs, 15000)
        assert.equal(data.capture.camera.actualId, 'main')
        assert.ok(data.deliveredFrames.fps >= 20)
        assert.equal(data.analysis.bpm, null)
        if (mode === 'flat')
          assert.equal(await page.getByTestId('rhr-next-camera').count(), 0)
        else {
          await page.getByTestId('rhr-next-camera').click()
          await ready()
          assert.equal(
            await page
              .getByRole('combobox', { name: 'Rear camera' })
              .inputValue(),
            'wide',
          )
          assert.equal(
            await page.evaluate(() => window.__calls.at(-1).actual),
            'wide',
          )
          await finish()
          assert.equal(
            await page.evaluate(() =>
              localStorage.getItem('rhr-working-camera-v1'),
            ),
            'wide',
          )
          await page.getByTestId('rhr-done').click()
          await setup()
          await ready()
          assert.equal(
            await page.evaluate(() => window.__calls.at(-1).actual),
            'wide',
          )
        }
      } else {
        await finish()
        assert.equal(await page.evaluate(() => window.__exposureCalls), 0)
        if (mode === 'iphone-controls')
          assert.equal(await page.evaluate(() => window.__holdCalls.length), 0)
      }
    }
    assert.equal(errors.length, 0, errors.join(';'))
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    if (
      await page
        .getByRole('button', { name: 'Close resting HR', exact: true })
        .count()
    )
      await page
        .getByRole('button', { name: 'Close resting HR', exact: true })
        .click()
    assert.equal(await page.evaluate(() => window.__light), false)
    assert.ok(await page.evaluate(() => window.__stops > 0))
    console.log(
      JSON.stringify({
        mode,
        pass: true,
        noApiWrites: true,
        syntheticCameraOnly: true,
      }),
    )
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
