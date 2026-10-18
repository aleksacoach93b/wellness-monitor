// Export QA against the owned loopback fixture only; no production data or writes.
const assert = require('node:assert/strict'), fs = require('node:fs')
const { chromium, webkit } = require(process.env.RHR_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PVT_TEST_BASE_URL
if (!base || new URL(base).hostname !== '127.0.0.1') throw Error('Loopback fixture required')
const fixture = JSON.parse(fs.readFileSync('/tmp/ops-test-context.json', 'utf8'))
const engine = process.env.OPS_PDF_ENGINE || 'chromium'
;(async () => {
 const seed = await fetch(base + '/api/ops/today?surveyId=' + fixture.surveyId + '&date=2026-10-17', { headers: { Cookie: 'wm_admin_session=' + fixture.admin } }).then(r => r.json())
 assert.equal(seed.team.name, 'PVT Test Team')
 const prefs = await fetch(base + '/api/ops/table-preferences?surveyId=' + fixture.surveyId, { headers: { Cookie: 'wm_admin_session=' + fixture.admin } }).then(r => r.json())
 const prototype = seed.players.find(p => p.status === 'done')
 const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#398acf"/><circle cx="18" cy="12" r="7" fill="#ffe0bd"/><path d="M4 36Q4 20 18 20Q32 20 32 36" fill="#142c64"/></svg>').toString('base64')
 seed.players = Array.from({ length: 25 }, (_, i) => {
  const p = structuredClone(prototype)
  p.id = 'pdf-fixture-' + i; p.firstName = i === 0 ? 'Đorđe' : 'Player'; p.lastName = i === 0 ? 'Čović-Đurić' : 'Fixture ' + String(i + 1).padStart(2, '0'); p.rank = i + 1
  p.image = i === 0 ? svg : i === 1 ? base + '/fixture-missing-avatar.png' : null
  p.status = i >= 21 ? 'pending' : 'done'; if (p.status === 'pending') p.wellness = null
  else {
   p.wellness.readiness = 10 - i / 4; p.wellness.statusText = i % 3 === 0 ? 'WATCH' : i % 3 === 1 ? 'ALERT' : 'READY'
   p.wellness.sleepBedtime = '23:30'; p.wellness.sleepWake = '07:30'; p.wellness.sleepDuration = i % 2 ? '8h' : '6h 55m'
   for (const [j, key] of ['fatigue','soreness','sleepQuality','mood','stress'].entries()) p.wellness[key].value = 1 + (i + j) % 10
  }
  p.focus = i % 5 ? { medianRT: 245 + i, quality: 'OK', duration: 30, baselineDays: 7, deltaPercent: 1, count: 1, linked: true, surveyId: fixture.surveyId, questionId: 'f' } : null
  p.restingHr = i % 6 ? [{ questionId: 'h', label: 'Resting HR', bpm: 60 + i, position: 'lying', measuredAt: seed.generatedAt }, ...(i === 1 ? [{ questionId: 'h2', label: 'Second HR', bpm: 72, position: 'seated', measuredAt: seed.generatedAt }] : [])] : []
  p.derived = [{ key: 'pdf-custom', metricId: 'pdf-metric', name: 'Custom metric čć', value: i / 7, color: '#facc15' }]
  return p
 })
 seed.stats = { total:25, done:21, pending:4 }
 seed.metrics = [{ id:'pdf-metric', key:'pdf-custom', name:'Custom metric čć', kind:'FORMULA', config:{ formula:'fatigue' }, formatting:[], showInTable:true, enabled:true, sortOrder:0 }]
 prefs.columns.find(c => c.id === 'fatigue').label = 'Energy rating čć'
 prefs.columns.find(c => c.id === 'wake').enabled = false
 const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless:true, ...(engine === 'chromium' ? { executablePath:process.env.RHR_BROWSER } : {}) })
 const errors = [], writes = [], files = [], captures = []
 let downloads = 0
 try {
  const ctx = await browser.newContext({ viewport:{width:1440,height:1000}, timezoneId:'Europe/Belgrade', acceptDownloads:true })
  await ctx.addCookies([{name:'wm_admin_session',value:fixture.admin,url:base}])
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('download', () => { downloads++ })
  await page.route('**/api/ops/**', async route => {
   const req = route.request(), url = new URL(req.url()), path = url.pathname
   if (req.method() !== 'GET') { writes.push(path); return route.abort() }
   const reply = body => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
   if (path.endsWith('/today')) return reply({...seed, selectedDate:url.searchParams.get('date')})
   if (path.endsWith('/table-preferences')) return reply(prefs)
   if (path.endsWith('/rules')) return reply({rules:[]})
   if (path.endsWith('/month-data')) return reply({surveyId:fixture.surveyId,month:'2026-10',days:{}})
   return route.continue()
  })
  await page.goto(base + '/admin/ops?surveyId=' + fixture.surveyId + '&date=2026-10-17')
  const launch = page.getByRole('button',{name:'Export PDF',exact:true})
  await page.waitForFunction(() => document.querySelectorAll('table.ops-classic tbody tr').length === 25)
  await launch.waitFor()
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Export PDF')?.disabled)
  // Record the exact snapshot passed to the rasterizer, including every continuation page.
  const recordSnapshots = () => {
   window.__pdfPages = []
   new MutationObserver(() => {
    const root = document.querySelector('.ops-pdf-capture'), footer = root?.querySelector('footer')?.textContent || ''
    if (!/Page \d+\/\d+/.test(footer)) return
    const table = root.querySelector('table')
    const key = footer
    const item = { footer, theme:root.dataset.theme, columns:Array.from(table.tHead.rows[1].cells).map(c => c.dataset.opsColumn), names:Array.from(table.querySelectorAll('.ops-cell-name')).map(c => c.textContent), text:table.textContent }
    const index = window.__pdfPages.findIndex(p => p.footer === key)
    if (index >= 0) window.__pdfPages[index] = item; else window.__pdfPages.push(item)
   }).observe(document.body,{childList:true,subtree:true})
  }
  await page.evaluate(recordSnapshots)
  const original = await page.locator('table.ops-classic').evaluate(el => el.outerHTML)
  const exportPdf = async (theme, paper, content, suffix) => {
   await page.evaluate(() => {window.__pdfPages=[]})
   await launch.click()
   const dialog = page.getByRole('dialog',{name:'Export PDF'})
   await dialog.waitFor()
   await dialog.getByRole('radio',{name:theme === 'dark' ? /Dark Same style/ : /Light White background/}).check()
   await dialog.locator('select').selectOption(paper)
   await dialog.getByRole('radio',{name:content === 'table' ? /Current table All visible/ : /Daily summary Key/}).check()
   const download = page.waitForEvent('download',{timeout:90000})
   const beforeDownloads = downloads
   await dialog.getByRole('button',{name:'Download PDF'}).evaluate(el => {el.click(); el.click()})
   const d = await download
   assert.equal(d.suggestedFilename(), `live-ops-2026-10-17-${content}-${theme}.pdf`)
   const file = `/tmp/ops-pdf-${engine}-${suffix}.pdf`
   await d.saveAs(file); assert.ok(fs.statSync(file).size > 10000)
   await dialog.waitFor({state:'hidden'})
   assert.equal(downloads, beforeDownloads + 1, 'single-flight export')
   const pages = await page.evaluate(() => window.__pdfPages)
   assert.ok(pages.length, 'capture pages')
   assert.ok(pages.every(p => p.theme === theme && p.columns[0] === 'athlete' && !p.columns.includes('wake')))
   const names = [...new Set(pages.flatMap(p => p.names))]
   const currentNames = await page.locator('table.ops-classic .ops-cell-name').allTextContents()
   assert.deepEqual(names.sort(),currentNames.sort(), 'all filtered players exported')
   const actualColumns = [...new Set(pages.flatMap(p => p.columns))]
   const expected = await page.locator('table.ops-classic thead tr:nth-child(2) th').evaluateAll(els => els.map(el => el.dataset.opsColumn))
   assert.deepEqual(actualColumns,content === 'table' ? expected : expected.filter(id => !['bed','sleepRisk','metric:pdf-custom'].includes(id)))
   assert.ok(!pages.some(p => /reference days|In wellness CSV/.test(p.text)))
   files.push(file); captures.push({suffix,pages:pages.length,players:names.length,columns:actualColumns.length})
   assert.equal(await page.locator('.ops-pdf-host').count(),0)
  }
  await launch.click()
  assert.equal(await page.getByRole('radio',{name:/Light White background/}).isChecked(),true)
  await page.getByRole('dialog').screenshot({path:`/tmp/ops-pdf-${engine}-modal.png`})
  await page.keyboard.press('Escape')
  assert.equal(await launch.evaluate(el => document.activeElement === el),true)
  await exportPdf('dark','a3','table','dark-a3')
  await exportPdf('light','a4','table','light-a4')
  assert.equal(await page.locator('table.ops-classic').evaluate(el => el.outerHTML),original)
  if (engine === 'chromium') {
   await page.getByRole('button',{name:'Full screen',exact:true}).click()
   await page.getByRole('textbox',{name:'Search players'}).fill('Čović')
   await page.waitForFunction(() => document.querySelectorAll('table.ops-classic tbody tr').length === 1)
   await exportPdf('light','a3','summary','filtered-summary')
   await page.getByRole('textbox',{name:'Search players'}).fill('no-such-player')
   assert.equal(await launch.isDisabled(),true)
   await page.getByRole('textbox',{name:'Search players'}).fill('')
   await page.getByRole('button',{name:'Exit full screen'}).click()
   await page.setViewportSize({width:390,height:844})
   await launch.click()
   const dialog = page.getByRole('dialog')
   const bounds = await dialog.boundingBox()
   assert.ok(bounds.x >=0 && bounds.x + bounds.width <=390)
   const downloadBounds = await dialog.getByRole('button',{name:'Download PDF'}).boundingBox()
   assert.ok(downloadBounds.y + downloadBounds.height <=844)
   await dialog.screenshot({path:'/tmp/ops-pdf-mobile-modal.png'})
   await page.keyboard.press('Escape')
   await page.setViewportSize({width:1440,height:1000})
   // Missing identity fails cleanly, preserves the table, and permits a retry.
   const identity = page.locator('table.ops-classic [data-ops-column="athlete"]')
   await identity.evaluate(el => el.dataset.opsColumn = 'invalid')
   await launch.click()
   await page.getByRole('dialog').getByRole('button',{name:'Download PDF'}).click()
   await page.getByRole('alert').filter({hasText:'athlete column is required'}).waitFor()
   assert.equal(await page.locator('.ops-pdf-host').count(),0)
   await page.locator('table.ops-classic [data-ops-column="invalid"]').evaluate(el => el.dataset.opsColumn = 'athlete')
   await page.getByRole('button',{name:'Close PDF export'}).click()
   await page.getByRole('button',{name:'Pending (4)',exact:true}).click()
   await page.waitForFunction(() => document.querySelectorAll('table.ops-classic tbody tr').length === 4)
   await exportPdf('dark','a4','table','pending-retry')
   await page.getByRole('button',{name:'All (25)',exact:true}).click()
   // A minimal saved layout remains exportable without oversized text or clipping.
   for (const col of prefs.columns) col.enabled = col.id === 'athlete'
   seed.metrics = []
   await page.reload()
   await page.waitForFunction(() => document.querySelectorAll('table.ops-classic thead tr:nth-child(2) th').length === 1)
   await page.evaluate(recordSnapshots)
   await exportPdf('light','a3','table','identity-only')
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(writes,[])
  console.log(JSON.stringify({passed:true,engine,files,captures,noWrites:true,noLiveTableChanges:true}))
 } finally {await browser.close()}
})().catch(e => {console.error(e);process.exitCode=1})
