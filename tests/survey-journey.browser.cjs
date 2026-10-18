// Run after survey-delivery.integration.mjs against its owned loopback fixture.
const assert = require('node:assert/strict'),
  { PrismaClient } = require('@prisma/client')
const base = process.env.PVT_TEST_BASE_URL,
  database = process.env.PVT_TEST_DATABASE_URL
if (
  !base ||
  !database ||
  new URL(base).hostname !== '127.0.0.1' ||
  new URL(database).hostname !== '127.0.0.1'
)
  throw Error('Explicit isolated loopback URLs required')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const db = new PrismaClient({ datasourceUrl: database }),
  surveyId = 'delivery-test-survey',
  url =
    base + '/survey/' + surveyId + '?playerId=test-player&lang=en&surveyTheme='
let checks = 0
const check = (v, msg) => {
    assert.ok(v, msg)
    checks++
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const queued = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('wm-survey-delivery-v2:'))
      .map((k) => JSON.parse(localStorage.getItem(k)))
      .filter((x) => x.state !== 'saved'),
  )
const text = (page) => page.locator('#survey-q-delivery-text input')
async function fill(page, value) {
  await text(page).fill(value)
  await page.locator('.sj-submit-footer button').click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
}
async function clean() {
  await db.response.deleteMany({ where: { surveyId } })
  await db.surveySubmissionReceipt.deleteMany({ where: { surveyId } })
}
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })
  try {
    await clean()
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: 'Europe/Belgrade',
      }),
      page = await ctx.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    let calls = []
    page.on('request', (r) => {
      if (r.url().endsWith('/api/responses'))
        calls.push(JSON.parse(r.postData()))
    })
    await page.goto(url + 'dark')
    await page.locator('.sj-draft').waitFor()
    await sleep(500)
    check(
      (await page.getByRole('progressbar').count()) === 0,
      'automatic defaults are not shown as completed questions',
    )
    check(
      (await page
        .locator('#survey-q-delivery-slider input[type=range]')
        .inputValue()) === '5',
      'untouched default five remains a valid answer',
    )
    await page.locator('.sj-submit-footer button').click()
    check(
      !(await page.getByRole('dialog').isVisible()),
      'required validation remains before review',
    )
    await text(page).fill('Recovered draft')
    await page.locator('.sj-questions select').nth(0).selectOption('Pitch')
    await page.locator('.sj-questions select').nth(1).selectOption('MD-1')
    await page
      .locator('#survey-q-delivery-multiple')
      .getByText('Mobility', { exact: true })
      .click()
    await sleep(500)
    await page.reload()
    await text(page).waitFor()
    check(
      (await text(page).inputValue()) === 'Recovered draft',
      'draft answers restored after reload',
    )
    check(
      (await page.locator('.sj-questions select').nth(0).inputValue()) ===
        'Pitch',
      'session tag restored',
    )
    check(
      (await page.locator('.sj-questions select').nth(1).inputValue()) ===
        'MD-1',
      'match day restored',
    )
    await page.locator('.sj-submit-footer button').click()
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    check(calls.length === 0, 'review does not send before confirmation')
    check(
      (await page.locator('.sj-review ol').innerText()).includes('Mobility') &&
        !(await page.locator('.sj-review ol').innerText()).includes(
          '["Mobility"]',
        ),
      'review formats multiple selections readably',
    )
    await page
      .locator('.sj-review')
      .getByRole('button', { name: 'Edit: How are you today?', exact: true })
      .click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    check(
      (await text(page).inputValue()) === 'Recovered draft',
      'edit keeps entered answers',
    )
    await page.goto(base + '/survey/' + surveyId + '?lang=en')
    await text(page).waitFor()
    check(
      (await text(page).inputValue()) === '',
      'player draft not exposed to anonymous questionnaire',
    )
    await page.goto(url + 'dark')
    await text(page).waitFor()
    check(
      (await text(page).inputValue()) === 'Recovered draft',
      'own draft survives navigating back',
    )
    // Network failure with no server acceptance: immutable pending item survives reload and remains visibly unconfirmed.
    await page.route('**/api/responses', (r) => r.abort('failed'))
    await fill(page, 'Offline answers')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit Survey', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Couldn’t send yet', exact: true })
      .waitFor()
    check(
      (await db.response.count({ where: { surveyId } })) === 0,
      'offline failure never marked accepted',
    )
    let q = await queued(page)
    const offlineId = q[0].id
    check(
      q.length === 1 &&
        q[0].payload.answers.some((a) => a.value === 'Offline answers'),
      'pending payload persists on device',
    )
    await page.screenshot({ path: '/tmp/survey-journey-pending-mobile.png' })
    await page.reload()
    await page
      .getByRole('heading', { name: 'Couldn’t send yet', exact: true })
      .waitFor()
    check(
      (await queued(page))[0].id === offlineId,
      'reload retains exact pending ID',
    )
    check(await text(page).isDisabled(), 'uncertain pending answers are frozen')
    await page.unroute('**/api/responses')
    await page
      .locator('.sj-delivery-dialog')
      .getByRole('button', { name: 'Try again', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Questionnaire saved', exact: true })
      .waitFor()
    check(
      (await db.response.count({ where: { surveyId } })) === 1,
      'retry saves exactly one questionnaire',
    )
    check(
      await page.evaluate(
        () =>
          !Object.keys(sessionStorage).some((k) =>
            k.startsWith('wm-survey-draft-v1-delivery-test-survey-test-player'),
          ),
      ),
      'accepted submission clears its draft',
    )
    check(
      calls.filter((x) => x.submissionId === offlineId).length >= 2,
      'retry uses the same submission ID',
    )
    await ctx.close()
    await clean()
    // Actual server commit followed by lost ACK, reload, retry: acknowledge the same row.
    const ctx2 = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      p = await ctx2.newPage()
    let lostBody, storedId
    await p.route('**/api/responses', async (r) => {
      lostBody = JSON.parse(r.request().postData())
      const response = await r.fetch()
      check(response.ok(), 'lost ACK fixture accepted by real endpoint')
      storedId = (await response.json()).id
      await r.abort('failed')
    })
    await p.goto(url + 'green')
    await fill(p, 'Lost acknowledgement')
    await p
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit Survey', exact: true })
      .click()
    await p
      .getByRole('heading', { name: 'Couldn’t send yet', exact: true })
      .waitFor()
    check(
      (await db.response.count({ where: { surveyId } })) === 1,
      'server really committed before simulated lost ACK',
    )
    await p.reload()
    await p
      .getByRole('heading', { name: 'Couldn’t send yet', exact: true })
      .waitFor()
    await p.unroute('**/api/responses')
    await p
      .locator('.sj-delivery-dialog')
      .getByRole('button', { name: 'Try again', exact: true })
      .click()
    await p
      .getByRole('heading', { name: 'Questionnaire saved', exact: true })
      .waitFor()
    check(
      (await db.response.findFirst({ where: { surveyId } })).id === storedId,
      'lost ACK retry returns existing response, no replacement',
    )
    check(
      (await db.surveySubmissionReceipt.count({ where: { surveyId } })) === 1,
      'lost ACK retry leaves one receipt',
    )
    await ctx2.close()
    await clean()
    // A definitive rejection is retained and can be corrected without losing other answers.
    const ctx3 = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p3 = await ctx3.newPage()
    await p3.route('**/api/responses', (r) =>
      r.fulfill({ status: 400, json: { error: 'Please review this answer.' } }),
    )
    await p3.goto(url + 'rose')
    await fill(p3, 'Validation retained')
    await p3
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit Survey', exact: true })
      .click()
    await p3
      .getByRole('heading', {
        name: 'Please review your response',
        exact: true,
      })
      .waitFor()
    check(
      (await queued(p3))[0].state === 'attention',
      'rejected payload retained',
    )
    await p3
      .locator('.sj-delivery-dialog')
      .getByRole('button', { name: 'Review your answers', exact: true })
      .click()
    check(
      (await text(p3).inputValue()) === 'Validation retained' &&
        !(await text(p3).isDisabled()),
      'rejected answers restored for correction',
    )
    await p3.unroute('**/api/responses')
    await fill(p3, 'Corrected')
    await p3
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit Survey', exact: true })
      .click()
    await p3
      .getByRole('heading', { name: 'Questionnaire saved', exact: true })
      .waitFor()
    await ctx3.close()
    await clean()
    // Layout/theme matrix, native dialog, readable summaries and bounded mobile widths.
    for (const [theme, width] of [
      ['dark', 390],
      ['green', 768],
      ['rose', 1440],
      ['high', 390],
    ]) {
      const c = await browser.newContext({ viewport: { width, height: 900 } }),
        p = await c.newPage()
      await p.goto(url + theme)
      await fill(p, 'Layout check')
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        'page width contained ' + theme,
      )
      const box = await p.getByRole('dialog').boundingBox()
      check(
        box.width <= width && box.height <= 810,
        'review fits viewport ' + theme,
      )
      await p.screenshot({
        path: '/tmp/survey-journey-review-' + theme + '.png',
      })
      await p
        .getByRole('button', { name: 'Back to questions', exact: true })
        .click()
      await p.locator('.sj-draft').scrollIntoViewIfNeeded()
      await p.screenshot({ path: '/tmp/survey-journey-form-' + theme + '.png' })
      await c.close()
    }
    // No storage: honest warning, memory still retains answers for retry.
    const denied = await browser.newContext({
      viewport: { width: 390, height: 844 },
    })
    await denied.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('Storage disabled', 'QuotaExceededError')
      }
    })
    const pd = await denied.newPage()
    await pd.route('**/api/responses', (r) => r.abort('failed'))
    await pd.goto(url + 'dark')
    await fill(pd, 'Memory retained')
    await pd
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit Survey', exact: true })
      .click()
    await pd
      .getByRole('heading', { name: 'Couldn’t send yet', exact: true })
      .waitFor()
    check(
      (await pd.locator('.sj-delivery-dialog').innerText()).includes(
        'Keep this page open',
      ),
      'storage denial never claims durable saved',
    )
    await pd.unroute('**/api/responses')
    await pd
      .locator('.sj-delivery-dialog')
      .getByRole('button', { name: 'Try again', exact: true })
      .click()
    await pd
      .getByRole('heading', { name: 'Questionnaire saved', exact: true })
      .waitFor()
    await denied.close()
    check(errors.length === 0, 'no browser exceptions')
    console.log(`PASS: ${checks} survey journey browser assertions`)
  } finally {
    await browser.close()
    await db.$disconnect()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
