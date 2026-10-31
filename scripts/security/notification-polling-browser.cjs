/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic browser fixture; no production traffic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors = []
    let calls = 0
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install()
    await page.addInitScript(() => {
      window.reviewHidden = false
      Object.defineProperty(document, 'visibilityState', { get: () => window.reviewHidden ? 'hidden' : 'visible' })
    })
    await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname === '/api/notifications') calls++
      return route.fulfill({ json: { notifications: [], unread_count: 0 } })
    })
    await page.goto(process.env.NOTIFICATION_REVIEW_URL || 'http://localhost:3199/notification-review')
    const settle = () => new Promise(resolve => setTimeout(resolve, 150))
    for (let attempt = 0; calls === 0 && attempt < 30; attempt++) await settle()
    await settle()
    const initial = calls
    assert.ok(initial > 0)
    await page.clock.runFor(59000); await settle()
    assert.equal(calls, initial)
    await page.clock.runFor(1000); await settle()
    assert.equal(calls, initial + 1)
    await page.evaluate(() => { window.reviewHidden = true; document.dispatchEvent(new Event('visibilitychange')) })
    const hidden = calls
    await page.clock.runFor(600000); await settle()
    assert.equal(calls, hidden, 'Ten hidden minutes cause zero notification requests')
    await page.evaluate(() => { window.reviewHidden = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
    await settle()
    assert.equal(calls, hidden + 1, 'One refresh on resume; focus does not duplicate it')
    assert.deepEqual(errors, [])
    console.log('PASS: notifications poll once per visible minute, make zero requests across ten hidden minutes, and resume without duplicate focus requests')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })