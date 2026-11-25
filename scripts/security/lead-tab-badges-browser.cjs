/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic UI counters; every API request is intercepted. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/api/leads' && url.searchParams.get('summary_only') === '1') return route.fulfill({ json: {
          counts: { lesson_inquiry: 22, service_inquiry: 27, job_application: 0, winback: 0, enrolled: 0, lost: 0 },
          newCounts: { lesson_inquiry: 2, service_inquiry: 3 }, pipelineValue: 0, closedSinceOct1: 0,
        } })
        if (url.pathname === '/api/leads') return route.fulfill({ json: [] })
        return route.fulfill({ json: {} })
      })
      await page.goto(process.env.LEAD_BADGES_REVIEW_URL || 'http://127.0.0.1:3264/leads')
      const service = page.getByRole('button', { name: /^Service inquiries/ })
      await service.getByLabel('3 new service inquiries', { exact: true }).waitFor()
      assert.equal((await service.innerText()).replace(/\s+/g, ' ').trim(), 'Service inquiries 3 27', 'Opportunity total is separate from the net-new notification')
      const lesson = page.getByRole('button', { name: /^Lesson requests/ })
      assert.equal((await lesson.innerText()).replace(/\s+/g, ' ').trim(), 'Lesson requests 2 22')
      await service.click()
      assert.equal(await service.getAttribute('aria-pressed'), 'true')
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: service total 27/new 3, lesson total 22/new 2`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })