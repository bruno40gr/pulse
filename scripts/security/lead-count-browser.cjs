/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser review with intercepted APIs. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.LEAD_TABLE_REVIEW_URL || 'http://127.0.0.1:3177'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(8000)
      await page.clock.install()
      let count = 2
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/api/leads') {
          assert.equal(url.searchParams.get('count_only'), '1')
          assert.ok(url.searchParams.get('tenant'))
          return route.fulfill({ json: { count } })
        }
        if (url.pathname === '/api/inbox') return route.fulfill({ json: { count: 2 } })
        if (url.pathname === '/api/account/identity') return route.fulfill({ json: { fullName: 'Test Staff', firstName: 'Test', avatarUrl: null, isDemo: false } })
        return route.fulfill({ json: {} })
      })
      await page.goto(`${base}/dashboard`)
      if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      const link = page.getByRole('link', { name: /^Leads/ })
      const badge = link.getByLabel('2 new leads', { exact: true })
      await badge.waitFor()
      assert.equal(await badge.innerText(), '2')
      const style = locator => locator.evaluate(node => {
        const s = getComputedStyle(node)
        return [s.backgroundColor, s.color, s.height, s.borderRadius, s.fontSize]
      })
      assert.deepEqual(await style(badge), await style(page.getByLabel('2 unread messages', { exact: true })))
      count = 0
      const refreshed = page.waitForResponse(response => response.url().includes('/api/leads?'))
      await page.evaluate(() => window.dispatchEvent(new Event('pulse:lead-count-changed')))
      await refreshed
      await badge.waitFor({ state: 'hidden' })
      count = 3
      const polled = page.waitForResponse(response => response.url().includes('/api/leads?'))
      await page.clock.runFor(5100)
      await polled
      await link.getByLabel('3 new leads', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width}px: Leads badge matches Conversations; zero hides; updates on changes and polling`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })