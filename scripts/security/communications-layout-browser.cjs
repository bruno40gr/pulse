/* eslint-disable @typescript-eslint/no-require-imports -- Intercepted UI lab, no live mailbox. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let release
      const gate = new Promise(resolve => { release = resolve })
      const person = { id: 'lead:one', name: 'Alex Example', email: 'alex@example.com', phone: '', student: '', stage: '', profileType: 'lead', profileId: 'one', smsContactId: 'one' }
      const thread = { ...person, contactId: person.id, id: 'email:box:thread:lead:one', mailboxId: 'box', providerThreadId: 'thread', channel: 'email', messages: [{ id: 'saved', channel: 'email', direction: 'inbound', timestamp: new Date().toISOString(), time: 'Today', body: 'Saved message', unread: false }] }
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url())
        const fulfill = json => route.fulfill({ json })
        if (url.pathname === '/api/conversations') { await gate; return fulfill({ people: [person] }) }
        if (url.pathname === '/api/conversations/email') return fulfill(url.searchParams.has('mailbox') ? { threads: [thread], nextCursor: null, sync: { state: 'complete' } } : { mailboxes: [{ id: 'box', email: 'office@example.com', canSend: false }] })
        if (url.pathname === '/api/conversations/templates') return fulfill({ templates: [] })
        if (url.pathname === '/api/conversations/signature') return fulfill({ company: 'Headliner' })
        if (url.pathname === '/api/communications/senders') return fulfill({ senders: [] })
        return fulfill([])
      })
      await page.goto(process.env.STORED_EMAIL_REVIEW_URL || 'http://127.0.0.1:3167', { waitUntil: 'domcontentloaded' })
      await page.getByRole('status', { name: 'Loading communications' }).waitFor()
      assert.equal(await page.getByRole('table', { name: 'Communications', exact: true }).getByRole('row').count(), 9)
      assert.equal(await page.getByRole('status', { name: 'Loading profile' }).count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Loading rows must fit the viewport')
      await page.screenshot({ path: `/tmp/pulse-communications-skeleton-${width}.png` })
      release()
      await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).waitFor()
      assert.equal(await page.getByRole('heading', { name: 'Communications', exact: true }).count(), 1)
      assert.equal(await page.getByRole('heading', { name: 'Conversations', exact: true }).count(), 0)
      const toggles = page.getByRole('group', { name: 'Filter conversation channel' })
      for (const channel of ['Email', 'SMS', 'All']) {
        const button = toggles.getByRole('button', { name: channel, exact: true })
        await button.click()
        assert.equal(await button.getAttribute('aria-pressed'), 'true')
        assert.equal(await button.getAttribute('data-kind'), 'toggle')
        assert.equal(await toggles.locator('[aria-pressed="true"]').count(), 1)
      }
      await page.screenshot({ path: `/tmp/pulse-communications-layout-${width}.png` })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: horizontal skeleton rows, one Communications heading, working channel toggles, no page overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })