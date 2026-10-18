// Explicit loopback fixture: delayed authentication and delayed real Next navigation.
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
  throw Error('Explicit loopback URLs required')
const db = new PrismaClient({ datasourceUrl: database }),
  teamId = 'kiosk-loading-team',
  surveyId = 'kiosk-loading-survey',
  playerId = 'loading-player'
let checks = 0
function check(v, msg) {
  assert.ok(v, msg)
  checks++
}
const card = (p) =>
  p.locator('#kiosk-player-grid button').filter({ hasText: 'Loading' }).first()
const modal = (p) => p.locator('.kiosk-player-access')
async function open(p) {
  await p.goto(base + '/kiosk/' + surveyId)
  await card(p).click()
  await modal(p).waitFor({ state: 'visible' })
}
;(async () => {
  await db.team.deleteMany({ where: { id: teamId } })
  await db.team.create({
    data: {
      id: teamId,
      name: 'Kiosk loading test team',
      players: {
        create: [
          {
            id: playerId,
            firstName: 'Loading',
            lastName: 'Player',
            password: 'LP',
            image:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh1sAAAAASUVORK5CYII=',
          },
          {
            id: 'loading-other',
            firstName: 'Other',
            lastName: 'Tester',
            password: 'OT',
          },
        ],
      },
      kioskSettings: { create: { theme: 'green', locale: 'en' } },
      surveys: {
        create: {
          id: surveyId,
          title: 'Kiosk loading fixture',
          createdBy: 'test-admin',
          questions: {
            create: {
              id: 'loading-text',
              text: 'How are you?',
              type: 'TEXT',
              required: false,
            },
          },
        },
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
      const context = await browser.newContext({ ...devices['iPhone 13'] })
      await context.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', {configurable:true,value:()=>new Promise(()=>{})})
      })
      const p = await context.newPage(),
        errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      let authCalls = 0,
        navCalls = 0,
        releaseAuth,
        releaseNav
      const authGate = new Promise((r) => (releaseAuth = r)),
        navGate = new Promise((r) => (releaseNav = r))
      await p.route('**/api/kiosk/' + surveyId + '/pvt', async (r) => {
        if (r.request().method() === 'POST') {
          authCalls++
          await authGate
        }
        await r.continue()
      })
      await p.route('**/survey/' + surveyId + '?**', async (r) => {
        navCalls++
        await navGate
        await r.continue()
      })
      await open(p)
      await modal(p).locator('input').fill('XX')
      await modal(p)
        .getByRole('button', { name: 'Continue', exact: true })
        .click()
      check(
        (await modal(p).innerText()).includes('Incorrect password'),
        'wrong initials stay in same popup',
      )
      check(authCalls === 0, 'local wrong initials do not authorize')
      await p.evaluate(() => {
        window.originalModal = document.querySelector('.kiosk-player-access')
        window.kioskGap = false
        window.loadingObserver = new MutationObserver(() => {
          if (
            document.querySelector('#kiosk-player-grid') &&
            !document.querySelector('.kiosk-player-access[open]') &&
            !document.querySelector('.survey-journey')
          )
            window.kioskGap = true
        })
        window.loadingObserver.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['open'],
        })
      })
      await modal(p).locator('input').fill('LP')
      await modal(p)
        .locator('input')
        .evaluate((e) => {
          e.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
          )
          e.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
          )
        })
      await modal(p).getByText('Loading your survey', { exact: true }).waitFor()
      await p.waitForTimeout(150)
      check(authCalls === 1, 'rapid Enter sends only one authorization')
      check(
        (await modal(p).locator('input').count()) === 0,
        'input replaced by loading state',
      )
      check(
        await modal(p).getByText('Loading Player', { exact: true }).isVisible(),
        'player identity remains visible',
      )
      check(
        (await modal(p).locator('img').count()) === 1,
        'player photo remains visible',
      )
      check(
        await p.evaluate(
          () =>
            window.originalModal ===
            document.querySelector('.kiosk-player-access'),
        ),
        'loading reuses the exact popup element',
      )
      await p.keyboard.press('Escape')
      check(
        await modal(p).isVisible(),
        'Escape cannot expose roster while authorizing',
      )
      releaseAuth()
      await p.waitForFunction(() =>
        document.querySelector('.kiosk-player-access[aria-busy=true]'),
      )
      await p.waitForTimeout(250)
      check(
        navCalls === 1,
        'navigation begins without waiting for a stalled fullscreen promise',
      )
      await p
        .locator('#kiosk-player-grid button')
        .filter({ hasText: 'Other' })
        .evaluate((e) => e.click())
      await p.keyboard.press('Enter')
      await p.waitForTimeout(150)
      check(
        authCalls === 1 && navCalls === 1,
        'extra actions cannot start another player or navigation',
      )
      check(
        await p.evaluate(
          () =>
            document
              .querySelector('#kiosk-player-grid button')
              .closest('body')
              .querySelector('.kiosk-player-access').open,
        ),
        'roster stays behind open native modal',
      )
      await p.waitForTimeout(2000)
      check(
        await modal(p)
          .getByText('Loading your survey', { exact: true })
          .isVisible(),
        'loading remains throughout delayed route',
      )
      check(
        !(await p.evaluate(() => window.kioskGap)),
        'no exposed-roster frame before route is ready',
      )
      await p.screenshot({ path: '/tmp/kiosk-loading-' + engine + '.png' })
      releaseNav()
      await p.locator('.survey-journey .sj-draft').waitFor()
      check(
        new URL(p.url()).searchParams.get('playerId') === playerId,
        'correct player opens',
      )
      check(
        (await modal(p).count()) === 0,
        'popup disappears when questionnaire is rendered',
      )
      check(
        !(await p.evaluate(() => window.kioskGap)),
        'no roster gap during committed navigation',
      )
      check(errors.length === 0, engine + ' has no page exceptions: '+JSON.stringify(errors))
      await context.close()
      // A server rejection unlocks the same player popup for correction.
      for (const status of [401, 429]) {
        const c = await browser.newContext({ ...devices['iPhone 13'] }),
          q = await c.newPage()
        let routes = 0
        await q.route('**/api/kiosk/' + surveyId + '/pvt', (r) =>
          r.request().method() === 'POST'
            ? r.fulfill({ status, json: { error: 'Rejected' } })
            : r.continue(),
        )
        q.on('request', (r) => {
          if (r.url().includes('/survey/' + surveyId)) routes++
        })
        await open(q)
        await modal(q).locator('input').fill('LP')
        await modal(q)
          .getByRole('button', { name: 'Continue', exact: true })
          .click()
        await modal(q).getByRole('alert').waitFor()
        check(
          (await modal(q).locator('input').isVisible()) && routes === 0,
          'server rejection restores entry without navigation ' + status,
        )
        await modal(q)
          .getByRole('button', { name: 'Cancel', exact: true })
          .click()
        check(!(await modal(q).count()), 'cancel works again after rejection')
        await c.close()
      }
      // Existing offline authorization fallback remains available for locally valid initials.
      const c = await browser.newContext({ ...devices['iPhone 13'] }),
        q = await c.newPage()
      await q.route('**/api/kiosk/' + surveyId + '/pvt', (r) =>
        r.request().method() === 'POST' ? r.abort('failed') : r.continue(),
      )
      await open(q)
      await modal(q).locator('input').fill('LP')
      await modal(q)
        .getByRole('button', { name: 'Continue', exact: true })
        .click()
      await q.locator('.sj-draft').waitFor()
      check(
        new URL(q.url()).searchParams.get('playerId') === playerId,
        'existing offline entry behavior preserved',
      )
      await c.close()
    } finally {
      await browser.close()
    }
  }
  // Existing already-submitted confirmation remains before loading the next survey.
  await db.response.create({ data: { surveyId, playerId } })
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })
  try {
    const p = await browser.newPage()
    await p.goto(base + '/kiosk/' + surveyId)
    await p.getByRole('button', { name: /^All \d/ }).click()
    await card(p).click()
    await modal(p).locator('input').fill('LP')
    await modal(p)
      .getByRole('button', { name: 'Continue', exact: true })
      .click()
    await modal(p).getByText('Already submitted', { exact: true }).waitFor()
    check(
      !p.url().includes('/survey/'),
      'resubmit requires explicit confirmation',
    )
    await modal(p)
      .getByRole('button', { name: 'Submit again', exact: true })
      .click()
    await p.locator('.sj-draft').waitFor()
    check(
      new URL(p.url()).searchParams.get('playerId') === playerId,
      'confirmed resubmit opens correct survey',
    )
  } finally {
    await browser.close()
  }
  console.log(`PASS: ${checks} kiosk loading browser assertions`)
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
