/* eslint-disable @typescript-eslint/no-require-imports -- Intercepted browser lab; no live service calls. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.SIDEBAR_POLLING_REVIEW_URL || 'http://127.0.0.1:3191/polling-review'
;(async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const requests = { leads: 0, inbox: 0 }, errors = []
    let holdLead, holdNext = false, failNext = false
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install()
    await page.addInitScript(() => {
      window.reviewHidden = false
      Object.defineProperty(document, 'visibilityState', { get: () => window.reviewHidden ? 'hidden' : 'visible' })
    })
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url())
      if (url.pathname === '/api/leads' || url.pathname === '/api/inbox') {
        assert.equal(url.searchParams.get('count_only'), '1')
        const key = url.pathname === '/api/leads' ? 'leads' : 'inbox'
        requests[key]++
        if (key === 'leads' && holdNext) { holdNext = false; await new Promise(resolve => { holdLead = resolve }) }
        if (key === 'leads' && failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Synthetic outage' } }) }
        return route.fulfill({ json: { count: key === 'leads' ? 3 : 5 } })
      }
      if (url.pathname === '/api/account/identity') return route.fulfill({ json: { fullName: 'Synthetic Staff', firstName: 'Synthetic', isDemo: false } })
      if (url.pathname === '/api/notifications') return route.fulfill({ json: { notifications: [], unread_count: 0 } })
      return route.fulfill({ json: { show: false } })
    })
    await page.goto(base)
    await page.getByLabel('3 new leads', { exact: true }).waitFor()
    const initial = { ...requests }
    await page.clock.runFor(59_000)
    assert.deepEqual(requests, initial, 'No five-second badge polling')
    await page.clock.runFor(1000)
    await new Promise(resolve => setTimeout(resolve, 150))
    assert.equal(requests.leads, initial.leads + 1)
    assert.equal(requests.inbox, initial.inbox + 1)
    await page.evaluate(() => { window.reviewHidden = true; document.dispatchEvent(new Event('visibilitychange')) })
    const beforeHidden = { ...requests }
    await page.clock.runFor(300_000)
    assert.deepEqual(requests, beforeHidden, 'Hidden tabs do not poll badges')
    await page.evaluate(() => { window.reviewHidden = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
    await new Promise(resolve => setTimeout(resolve, 150))
    assert.equal(requests.leads, beforeHidden.leads + 1)
    assert.equal(requests.inbox, beforeHidden.inbox + 1)
    holdNext = true
    await page.evaluate(() => window.dispatchEvent(new Event('pulse:lead-count-changed')))
    await page.waitForFunction(() => true)
    while (!holdLead) await new Promise(resolve => setTimeout(resolve, 10))
    const whileRunning = requests.leads
    await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('pulse:lead-count-changed')) })
    assert.equal(requests.leads, whileRunning, 'Action storms do not overlap requests')
    const heldResponse = page.waitForResponse(r => r.url().includes('/api/leads?'))
    holdLead()
    await heldResponse
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(requests.leads, whileRunning + 1, 'One queued refresh after actions')
    failNext = true
    const failedResponse = page.waitForResponse(r => r.status() === 503)
    await page.evaluate(() => window.dispatchEvent(new Event('pulse:lead-count-changed')))
    await failedResponse
    await page.getByLabel('3 new leads', { exact: true }).waitFor()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('pulse:conversation-count-changed', { detail: { threadKey: 'thread', pending: true, delta: -1 } })))
    await page.getByLabel('4 unread messages', { exact: true }).waitFor()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('pulse:conversation-count-changed', { detail: { threadKey: 'thread', pending: false } })))
    await page.getByLabel('5 unread messages', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log('PASS: 60-second badge polling, hidden-tab pause, coalesced focus/actions, no overlaps, failed-fetch badge retention, optimistic message-read count')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })