/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Use an isolated review host only')

const destinations = [
  ['Contacts', 'Contacts'],
  ['Opportunities', 'Leads'],
  ['Enroll & Book', 'Enroll & Book'],
  ['Bands & ensembles', 'Bands & ensembles'],
  ['Events', 'Events'],
  ['Staff', 'Staff'],
]

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(`${request.method()} ${request.url()}`)
      })
      await page.goto(`${base}/odeon-demo`)
      await page.getByRole('heading', { name: 'Contacts', exact: true }).waitFor()
      // Reproduce the unavailable-school recovery without touching a school account.
      const saved = await page.evaluate(() => localStorage.getItem('odeon:app-sample:v2'))
      assert.ok(saved, 'Browser workspace is saved before recovery')
      await page.route('**/api/academy/workspace?*', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<html>Not found</html>' }))
      await page.goto(`${base}/odeon-demo?screen=calendar&tenant=unavailable-school`)
      await page.getByText('Shared school storage is not available on this preview.', { exact: false }).waitFor()
      assert.equal(await page.evaluate(() => localStorage.getItem('odeon:app-sample:v2')), saved, 'Failed school load leaves browser workspace untouched')
      await page.getByRole('link', { name: 'Open sample calendar', exact: true }).click()
      await page.getByRole('heading', { name: 'Academy calendar', exact: true }).waitFor()
      assert.equal(new URL(page.url()).searchParams.has('tenant'), false)
      requests.length = 0
      for (const [label, heading] of destinations) {
        if (width === 390) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        const link = page.getByRole('link', { name: label, exact: true })
        assert.equal(new URL(await link.getAttribute('href'), base).searchParams.has('tenant'), false, `${label} must stay in browser sample mode`)
        await link.click()
        if (heading) await page.getByRole('heading', { name: heading, exact: true }).first().waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${label} overflows at ${width}px`)
      }
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [])
      assert.ok(await page.evaluate(() => localStorage.getItem('odeon:app-sample:v2')), 'Browser workspace remains saved after navigation')
      console.log(`PASS ${width}: all six Beta destinations; no API requests/errors/overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })