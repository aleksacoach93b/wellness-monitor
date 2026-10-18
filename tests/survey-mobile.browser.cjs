// Owned loopback fixture only; mobile viewport and concise delivery UI regressions.
const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
const { chromium, webkit, devices } = require(
  process.env.PLAYWRIGHT_MODULE || 'playwright',
)
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
  surveyId = 'mobile-ui-test-survey'
let checks = 0
function check(value, message) {
  assert.ok(value, message)
  checks++
}
async function viewport(page, height, top = 0) {
  await page.evaluate(
    ({ height, top }) => {
      Object.assign(window.testViewport, { height, offsetTop: top })
      window.testViewport.dispatchEvent(new Event('resize'))
    },
    { height, top },
  )
  await page.waitForFunction(
    ({ height, top }) => {
      const root = document.querySelector('.survey-journey')
      return (
        root &&
        parseFloat(root.style.getPropertyValue('--sj-viewport-height')) ===
          height &&
        parseFloat(root.style.getPropertyValue('--sj-viewport-top')) === top
      )
    },
    { height, top },
  )
}
async function visibleAction(page, selector, bottom, top = 0) {
  const b = await page.locator(selector).boundingBox()
  check(
    b && b.y >= top && b.y + b.height <= bottom + 1 && b.height >= 44,
    selector +
      ' inside visible viewport ' +
      JSON.stringify({
        box: b,
        top,
        bottom,
        viewport: await page.evaluate(() => ({
          style: document.querySelector('.survey-journey').style.cssText,
          root: document
            .querySelector('.survey-journey')
            .getBoundingClientRect()
            .toJSON(),
          pageY: scrollY,
          visual: window.testViewport.height,
        })),
      }),
  )
  check(
    await page.locator(selector).evaluate((e) => {
      const r = e.getBoundingClientRect()
      return e.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      )
    }),
    selector + ' unobstructed',
  )
}
;(async () => {
  check(
    (await db.team.findUnique({ where: { id: 'test-team' } }))?.name ===
      'PVT Test Team',
    'synthetic fixture required',
  )
  await db.survey.deleteMany({ where: { id: surveyId, teamId: 'test-team' } })
  await db.survey.create({
    data: {
      id: surveyId,
      title: 'Mobile wellness fixture',
      teamId: 'test-team',
      createdBy: 'test-admin',
      questions: {
        create: [
          ...Array.from({ length: 6 }, (_, i) => ({
            id: 'mobile-slider-' + i,
            text: 'Wellness rating ' + (i + 1),
            type: 'SLIDER',
            required: true,
            order: i,
          })),
          {
            id: 'mobile-bed',
            text: 'Bedtime',
            type: 'TIME',
            required: true,
            order: 6,
          },
          {
            id: 'mobile-wake',
            text: 'Wake time',
            type: 'TIME',
            required: true,
            order: 7,
          },
          {
            id: 'mobile-pain',
            text: 'Sore areas?',
            type: 'BODY_MAP',
            required: true,
            order: 8,
          },
          {
            id: 'mobile-focus',
            text: 'Focus test',
            type: 'PVT',
            required: false,
            options: JSON.stringify({
              durationSeconds: 30,
              protocolVersion: 'handheld-pvt-v5',
            }),
            order: 9,
          },
          {
            id: 'mobile-rhr',
            text: 'Resting HR',
            type: 'NUMBER',
            required: false,
            options: JSON.stringify({
              widget: 'RHR_CAMERA',
              durationSeconds: 15,
              protocolVersion: 'camera-rhr-v4',
            }),
            order: 10,
          },
        ],
      },
    },
  })
  for (const engine of ['chromium', 'webkit']) {
    const browser = await (engine === 'webkit' ? webkit : chromium).launch({
      headless: true,
      ...(engine === 'chromium'
        ? {
            executablePath:
              process.env.CHROME_PATH ||
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          }
        : {}),
    })
    try {
      const context = await browser.newContext({
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        timezoneId: 'Europe/Belgrade',
      })
      await context.addInitScript(() => {
        const viewport = new EventTarget()
        Object.assign(viewport, { height: 650, offsetTop: 0, scale: 1 })
        Object.defineProperty(window, 'visualViewport', {
          value: viewport,
          configurable: true,
        })
        window.testViewport = viewport
      })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(
        base +
          '/survey/' +
          surveyId +
          '?playerId=test-player&lang=en&surveyTheme=green',
      )
      await page.locator('.sj-draft').waitFor()
      await page.waitForTimeout(650)
      check(
        (await page.getByRole('progressbar').count()) === 0,
        'no misleading progress for six automatic fives',
      )
      check(
        !(await page.locator('.sj-draft').innerText()).includes('7 / 11'),
        'no initial seven answered claim',
      )
      for (let i = 0; i < 6; i++)
        check(
          (await page
            .locator('#survey-q-mobile-slider-' + i + ' input[type=range]')
            .inputValue()) === '5',
          'untouched slider stays five',
        )
      await visibleAction(page, '.sj-submit-footer button', 650)
      for (const fraction of [0, 0.5, 1]) {
        await page
          .locator('.sj-scroll')
          .evaluate((e, f) => (e.scrollTop = f * e.scrollHeight), fraction)
        await visibleAction(page, '.sj-submit-footer button', 650)
      }
      await viewport(page, 350, 100)
      await visibleAction(page, '.sj-submit-footer button', 450, 100)
      await viewport(page, 650)
      await page.locator('#survey-q-mobile-bed input').fill('23:00')
      await page.locator('#survey-q-mobile-wake input').fill('07:00')
      await page.locator('.sj-submit-footer button').click()
      await page.locator('.sj-review').waitFor({ state: 'visible' })
      check(
        (await page.locator('.sj-review ol').innerText()).includes('5'),
        'default five is valid in review without touching slider',
      )
      await visibleAction(page, '.sj-review footer .sj-primary', 650)
      await page
        .locator('.sj-review-content')
        .evaluate((e) => (e.scrollTop = e.scrollHeight))
      await visibleAction(page, '.sj-review footer .sj-primary', 650)
      await viewport(page, 350, 100)
      await visibleAction(page, '.sj-review footer .sj-primary', 450, 100)
      const review = await page.locator('.sj-review').boundingBox()
      check(
        review.y >= 100 && review.y + review.height <= 450,
        'entire review fits shortened visual viewport',
      )
      await viewport(page, 650)
      await page.screenshot({
        path: '/tmp/survey-mobile-review-' + engine + '.png',
      })
      await page
        .getByRole('button', { name: 'Back to questions', exact: true })
        .click()
      await page.locator('.sj-scroll').evaluate((e) => (e.scrollTop = 0))
      await page.screenshot({
        path: '/tmp/survey-mobile-form-' + engine + '.png',
      })
      await page.setViewportSize({ width: 844, height: 390 })
      await viewport(page, 290)
      await visibleAction(page, '.sj-submit-footer button', 290)
      await page.locator('.sj-submit-footer button').click()
      await page.locator('.sj-review').waitFor({ state: 'visible' })
      await visibleAction(page, '.sj-review footer .sj-primary', 290)
      await page
        .getByRole('button', { name: 'Back to questions', exact: true })
        .click()
      await page.setViewportSize({ width: 390, height: 844 })
      await viewport(page, 650)
      // Keep one real request in flight, observe the short modal, then let it reach the actual fixture endpoint.
      let release, requestBody
      const gate = new Promise((resolve) => (release = resolve))
      await page.route('**/api/responses', async (route) => {
        requestBody = JSON.parse(route.request().postData())
        await gate
        await route.continue()
      })
      await page.locator('.sj-submit-footer button').click()
      await page.locator('.sj-review .sj-primary').click()
      await page
        .getByRole('heading', { name: 'Sending your response…', exact: true })
        .waitFor()
      const popup = page.locator('.sj-delivery-dialog')
      check(
        (await popup.innerText()).trim() === 'Sending your response…',
        'sending popup contains only a short message',
      )
      check(
        (await popup.locator('button').count()) === 0,
        'no retry button while a request is sending',
      )
      check(
        (await popup.locator('.animate-spin').count()) === 1,
        'sending spinner visible',
      )
      await page.keyboard.press('Escape')
      check(
        await popup.isVisible(),
        'cannot dismiss the bounded in-flight delivery',
      )
      await page.screenshot({
        path: '/tmp/survey-mobile-sending-' + engine + '.png',
      })
      release()
      await page
        .getByRole('heading', { name: 'Questionnaire saved', exact: true })
        .waitFor()
      check(
        requestBody.answers
          .filter((a) => a.questionId.startsWith('mobile-slider-'))
          .every((a) => a.value === '5'),
        'all untouched fives submitted unchanged',
      )
      const stored = await db.response.findFirst({
        where: { surveyId, playerId: 'test-player' },
        include: { answers: true },
      })
      check(
        stored.answers
          .filter((a) => a.questionId.startsWith('mobile-slider-'))
          .every((a) => a.value === '5'),
        'server stores fives unchanged',
      )
      check(errors.length === 0, 'no ' + engine + ' page errors')
      await context.close()
    } finally {
      await browser.close()
    }
  }
  console.log(`PASS: ${checks} Chromium and WebKit mobile UI assertions`)
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
