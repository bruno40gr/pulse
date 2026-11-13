/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { createHarness } = require('./synthetic-harness.cjs')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Use an isolated review host only')

;(async () => {
  const h = createHarness()
  const model = h.load('beta-source/lib/academy-portal-queue.ts')
  const actions = h.load('beta-source/lib/academy-portal-actions.ts')
  let queue = model.createPortalQueue()
  queue.inquiries = [{ id: 'browser-lesson', personId: 'sophie', accountId: 'kim', interest: 'Private · Guitar', category: 'Lesson requests', stage: 'Contacted' }]
  queue = actions.sendLessonEnrollment(queue, 'browser-lesson')
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        if (route.request().method() !== 'GET') writes.push(route.request().url())
        return route.fulfill({ json: { roleKey: 'owner' } })
      })
      await page.addInitScript(({ key, value }) => { if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, value) }, { key: model.portalQueueKey, value: JSON.stringify(queue) })
      await page.goto(`${base}/odeon-demo?view=parent&account=kim`)
      const requests = page.getByRole('region', { name: 'Enrollment requests', exact: true })
      await requests.getByRole('button', { name: 'Complete enrollment', exact: true }).click()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByRole('heading', { name: 'Set up lessons', exact: true }).waitFor()
      await page.getByLabel('Instrument', { exact: true }).selectOption('Piano')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await requests.getByRole('button', { name: 'Continue enrollment', exact: true }).waitFor()
      const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), model.portalQueueKey)
      assert.equal(saved.drafts.length, 1)
      assert.equal(saved.drafts[0].data.sourceLeadId, 'browser-lesson')
      await requests.getByRole('button', { name: 'Continue enrollment', exact: true }).click()
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      assert.equal(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).drafts.length, model.portalQueueKey), 1)
      await page.screenshot({ path: `/tmp/beta-parent-enrollment-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      console.log(`PASS ${width}: family request opens, saves, resumes one draft; no operational writes/errors/overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })