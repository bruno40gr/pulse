/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser; intercepted providers, no real sends. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []
      const reads = []
      let sends = 0
      let failHistory = true
      page.on('pageerror', error => errors.push(error.message))
      const person = { id: 'person:one', name: 'Alex Example', email: 'alex@example.com', phone: '', student: '', stage: '', profileType: 'contact', profileId: 'one', smsContactId: 'one' }
      await page.route('**/api/**', async route => {
        const request = route.request()
        const url = new URL(request.url())
        const fulfill = (json, status = 200) => route.fulfill({ json, status })
        if (url.pathname === '/api/conversations') return fulfill({ people: [person] })
        if (url.pathname === '/api/communications/senders') return fulfill({ senders: [{ id: 'office@example.com', email: 'office@example.com', name: 'Headliner', mine: false }] })
        if (url.pathname === '/api/conversations/signature') return fulfill({ company: 'Headliner' })
        if (url.pathname === '/api/conversations/templates') return fulfill({ templates: [] })
        if (url.pathname === '/api/inbox') return fulfill([])
        if (url.pathname === '/api/conversations/email') {
          if (request.method() === 'POST') { sends++; return fulfill({ error: 'No sending in this test' }, 503) }
          if (!url.searchParams.has('mailbox')) return fulfill({ mailboxes: [{ id: 'box', email: 'office@example.com', canSend: true }] })
          reads.push(url.search)
          if (url.searchParams.has('person') && failHistory) return fulfill({ error: 'Email history is temporarily busy. Please try again shortly.', code: 'history_threads_403_userRateLimitExceeded' }, 503)
          return fulfill({ threads: [], nextCursor: url.searchParams.has('summary') ? 'older-page' : null })
        }
        return fulfill([])
      })
      const base = process.env.HISTORY_REVIEW_URL || 'http://127.0.0.1:3111'
      await page.goto(`${base}/?recipient=person%3Aone&channel=email&compose=1`)
      const body = page.getByRole('textbox', { name: 'Email body', exact: true })
      await body.fill('Keep this draft safe')
      await page.getByRole('textbox', { name: 'Email subject' }).fill('Lesson availability')
      await page.waitForTimeout(500)
      assert.equal(reads.filter(query => query.includes('person=')).length, 0, 'New drafts must not request recipient history')
      assert.ok(reads.filter(query => query.includes('summary=')).length <= 1, 'Initial background work must be bounded')
      assert.equal(await page.getByRole('button', { name: 'Send email', exact: true }).isEnabled(), true)
      assert.doesNotMatch(await page.locator('body').innerText(), /history_threads|403|temporarily busy/)
      await page.getByRole('button', { name: 'Back to Conversations', exact: true }).click()
      await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).click()
      await page.getByRole('button', { name: 'Email', exact: true }).click()
      const retry = page.getByRole('button', { name: 'Retry history', exact: true })
      await retry.waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(), /history_threads|403|reconnect/i)
      failHistory = false
      await retry.click()
      await retry.waitFor({ state: 'hidden' })
      assert.equal(sends, 0)
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width}: compose independent of history, bounded summaries, readable failure, in-place recovery, no sends`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })