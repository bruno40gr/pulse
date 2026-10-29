/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI lab, intercepted APIs, no real mailbox or writes. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = []
      let reads = 0, writes = 0, phase = 'pending'
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        const interval = window.setInterval.bind(window)
        window.setInterval = (callback, delay, ...args) => interval(callback, delay === 15000 ? 250 : delay, ...args)
      })
      const person = { id: 'lead:one', name: 'Alex Example', email: 'alex@example.com', phone: '', student: '', stage: '', profileType: 'lead', profileId: 'one', smsContactId: 'one' }
      const thread = { ...person, contactId: person.id, id: 'email:box:thread:lead:one', mailboxId: 'box', providerThreadId: 'thread', channel: 'email', subject: 'Stored lesson inquiry', messages: [{ id: 'saved', channel: 'email', direction: 'inbound', timestamp: new Date().toISOString(), time: 'Today', body: 'Persisted inbound lesson question', emailFrom: person.email, emailTo: ['office@example.com'] }] }
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        const fulfill = (json, status = 200) => route.fulfill({ json, status })
        if (request.method() !== 'GET') { writes++; return fulfill({ error: 'Writes disabled' }, 503) }
        if (url.pathname === '/api/conversations') return fulfill({ people: [person] })
        if (url.pathname === '/api/communications/senders') return fulfill({ senders: [{ id: 'office@example.com', email: 'office@example.com', name: 'Headliner', mine: false }] })
        if (url.pathname === '/api/conversations/signature') return fulfill({ company: 'Headliner' })
        if (url.pathname === '/api/conversations/templates') return fulfill({ templates: [] })
        if (url.pathname === '/api/conversations/email') {
          if (!url.searchParams.has('mailbox')) return fulfill({ mailboxes: [{ id: 'box', email: 'office@example.com', canSend: true }] })
          if (url.searchParams.has('person')) reads++
          return fulfill({ threads: url.searchParams.has('summary') || ['saved', 'delayed', 'stale'].includes(phase) ? [thread] : [], nextCursor: null, sync: { state: phase === 'saved' || phase === 'deleted' ? 'complete' : phase, processed: phase === 'saved' ? 1 : 0 } })
        }
        return fulfill([])
      })
      await page.goto(`${process.env.STORED_EMAIL_REVIEW_URL || 'http://127.0.0.1:3167'}/?recipient=lead%3Aone&channel=email&compose=1`)
      await page.getByRole('button', { name: 'Back to Communications', exact: true }).click()
      await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
      await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).click()
      await page.getByRole('button', { name: 'Email', exact: true }).click()
      await page.getByText('Importing email history for this date range. Saved emails appear as they are imported.', { exact: true }).waitFor()
      assert.ok(reads > 0, 'Contact history loaded')
      phase = 'saved'
      const threadButton = page.getByRole('button', { name: /Stored lesson inquiry/ })
      if (width === 1440) await threadButton.waitFor()
      await page.getByText('Persisted inbound lesson question', { exact: true }).last().waitFor()
      phase = 'delayed'
      await page.getByText('Email sync is delayed. Retrying automatically; saved emails remain available.', { exact: true }).waitFor()
      assert.ok(await page.getByText('Persisted inbound lesson question', { exact: true }).last().isVisible())
      phase = 'stale'
      await page.getByText('Email updates are behind. Saved emails remain available while background sync catches up.', { exact: true }).waitFor()
      phase = 'deleted'
      await page.getByText('No email history', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'New email', exact: true }).click()
      const body = page.getByRole('textbox', { name: 'Email body', exact: true })
      await body.fill('Keep my unsent draft')
      await page.waitForTimeout(500)
      const before = reads
      await page.waitForTimeout(750)
      assert.equal(reads, before, 'Compose does not poll recipient history')
      assert.match(await body.innerText(), /Keep my unsent draft/)
      assert.equal(writes, 0)
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width}px: import completion refreshes open detail, delayed history remains visible, deletions reconcile, compose draft stays intact, zero writes`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })