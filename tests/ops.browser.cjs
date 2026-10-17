// Isolated fixture only. Does not access production data or a physical camera.
const assert = require('node:assert/strict'),
  fs = require('node:fs')
const { chromium } = require(process.env.RHR_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PVT_TEST_BASE_URL
if (!base || new URL(base).hostname !== '127.0.0.1')
  throw Error('Loopback fixture required')
const fixture = JSON.parse(
  fs.readFileSync('/tmp/ops-test-context.json', 'utf8'),
)
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RHR_BROWSER,
  })
  let checks = 0
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'Europe/Belgrade',
    })
    await ctx.addCookies([
      { name: 'wm_admin_session', value: fixture.admin, url: base },
    ])
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base + '/admin/ops')
    await page.locator('#ops-survey').selectOption(fixture.surveyId)
    await page
      .locator('.ops-cal-day:not(.is-out)')
      .filter({ has: page.locator('span', { hasText: /^17$/ }) })
      .click()
    await page
      .getByRole('button', { name: 'Measurements', exact: true })
      .click()
    await page.getByRole('heading', { name: 'Measurement board' }).waitFor()
    await page
      .getByText('Saved with wellness', { exact: true })
      .first()
      .waitFor()
    assert.ok(
      (await page.locator('.opsm-stats').innerText()).includes(
        'Focus completed',
      ),
    )
    checks++
    await page
      .locator('.opsm-hub')
      .screenshot({ path: '/tmp/ops-measurements-desktop.png' })
    await page
      .getByRole('textbox', { name: 'Search players' })
      .fill('no-such-fixture')
    await page.getByText('No players match this filter.').waitFor()
    checks++
    await page.getByRole('textbox', { name: 'Search players' }).fill('')
    await page
      .getByRole('combobox', { name: 'Measurement filter' })
      .selectOption('awaiting')
    assert.equal(
      (await page.locator('.opsm-scroll tbody tr').count()) > 0,
      true,
    )
    checks++
    await page
      .getByRole('combobox', { name: 'Measurement filter' })
      .selectOption('all')
    await page.getByRole('button', { name: 'Reliability', exact: true }).click()
    await page
      .getByRole('heading', { name: 'Measurement reliability', exact: true })
      .waitFor()
    await page
      .getByRole('combobox', { name: 'Reliability test' })
      .selectOption('HR')
    assert.ok(
      (await page.locator('.opsm-hub').innerText()).includes(
        'Samsung Internet',
      ),
    )
    checks++
    await page
      .locator('.opsm-hub')
      .screenshot({ path: '/tmp/ops-reliability-desktop.png' })
    await page
      .getByRole('button', { name: 'Weekly report', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Weekly monitoring report' })
      .waitFor()
    assert.ok(
      (await page.locator('#ops-weekly-report').innerText()).includes(
        '250.0 ms',
      ),
    )
    assert.equal(await page.locator('.opsm-daily-chart>div').count(), 7)
    checks++
    await page
      .locator('.opsm-hub')
      .screenshot({ path: '/tmp/ops-weekly-desktop.png' })
    await page.emulateMedia({ media: 'print' })
    assert.equal(await page.locator('.opsm-print').isVisible(), false)
    await page.pdf({
      path: '/tmp/ops-weekly-fixture.pdf',
      format: 'A4',
      landscape: true,
      printBackground: true,
    })
    checks++
    await page.emulateMedia({ media: 'screen' })
    await page
      .getByRole('button', { name: 'CSV (Power BI)', exact: true })
      .click()
    await page.getByRole('dialog').waitFor()
    assert.ok(
      (
        await page
          .getByRole('textbox', { name: 'Permanent CSV link' })
          .inputValue()
      ).endsWith(`/api/surveys/${fixture.surveyId}/export/csv`),
    )
    checks++
    await page.getByRole('button', { name: 'Close CSV export' }).click()
    await page
      .getByRole('button', { name: 'Rules & metrics', exact: true })
      .click()
    assert.ok(
      (await page.getByText('Custom metrics', { exact: false }).count()) > 0,
    )
    checks++
    await page.getByRole('button', { name: 'Full screen', exact: true }).click()
    assert.equal(await page.locator('.ops-fullscreen').count(), 1)
    await page.getByRole('button', { name: 'Exit full screen' }).click()
    checks++
    await page
      .getByRole('button', { name: 'Daily overview', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Search players' })
      .fill('no-such-fixture')
    await page.getByText('No players found.').waitFor()
    checks++
    await page.getByRole('textbox', { name: 'Search players' }).fill('')
    // A failed optional report must leave the wellness board and retry button usable.
    await page.route('**/api/ops/insights?**', (r) =>
      r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic report outage' }),
      }),
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await page.getByText('Synthetic report outage', { exact: false }).waitFor()
    assert.ok(
      await page
        .getByRole('heading', { name: 'Daily monitoring', exact: true })
        .isVisible(),
    )
    checks++
    await page.unroute('**/api/ops/insights?**')
    await page.getByRole('button', { name: 'Retry monitoring' }).click()
    await page
      .getByText('Synthetic report outage', { exact: false })
      .waitFor({ state: 'hidden' })
    checks++
    // Slow old-day response must not replace a newer selection.
    await page.route('**/api/ops/insights?**', async (r) => {
      if (r.request().url().includes('date=2026-10-16'))
        await new Promise((resolve) => setTimeout(resolve, 1200))
      try {
        await r.continue()
      } catch {}
    })
    const day = (n) =>
      page
        .locator('.ops-cal-day:not(.is-out)')
        .filter({
          has: page.locator('span', { hasText: new RegExp('^' + n + '$') }),
        })
    await day(16).click()
    await day(17).click()
    await page
      .getByRole('button', { name: 'Weekly report', exact: true })
      .click()
    await page.waitForTimeout(1400)
    assert.ok(
      (await page.locator('#ops-weekly-report').innerText()).includes(
        '2026-10-11 — 2026-10-17',
      ),
    )
    checks++
    await page.unroute('**/api/ops/insights?**')
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const tab of ['Measurements', 'Reliability', 'Weekly report']) {
        await page.getByRole('button', { name: tab, exact: true }).click()
        await page.locator('.opsm-panel').waitFor()
        const bounds = await page.locator('.opsm-hub').boundingBox()
        assert.ok(
          bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
          `hub fits ${width}`,
        )
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `page fits ${width}`,
        )
        checks++
      }
      if (width === 390)
        await page
          .locator('.opsm-hub')
          .screenshot({ path: '/tmp/ops-weekly-mobile.png' })
    }
    assert.deepEqual(errors, [])
    checks++
    console.log(
      JSON.stringify({
        checks,
        passed: true,
        widths: [390, 768, 1280, 1440],
        physicalCameraUsed: false,
      }),
    )
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
