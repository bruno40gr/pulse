/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only browser acceptance, synthetic APIs; never sends real mail. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_REVIEW_URL || 'http://127.0.0.1:3271'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], sent = [], unexpected = []
      let failSend = true, releaseSender
      const senderGate = new Promise(resolve => { releaseSender = resolve })
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        const respond = (json, status = 200) => route.fulfill({ json, status })
        if (path === '/api/contacts/alex/follow-ups') return respond({ follow_ups: [], can_edit_inquiries: false })
        if (path === '/api/inbox') return respond([])
        if (path === '/api/account/me') return respond({ user: { displayName: 'Fixture' } })
        if (path === '/api/communications/recipients') return respond({ recipients: [{ destination: 'alex@example.invalid', name: 'Alex Example', contactIds: ['alex'] }], excluded: [], selectedCount: 1 })
        if (path === '/api/conversations') return respond({ people: [{ id: 'person:alex', name: 'Alex Example', email: 'alex@example.invalid', phone: '', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }] })
        if (path === '/api/communications/senders') {
          await senderGate
          return respond({ senders: [{ id: 'office', email: 'office@example.invalid', name: 'Office', mine: true, signatureHtml: '<p>Office signature</p>' }] })
        }
        if (path === '/api/conversations/templates') return respond({ templates: [] })
        if (path === '/api/conversations/signature') return respond({ company: 'School', phone: '', logoUrl: '' })
        if (path === '/api/conversations/email') {
          if (request.method() === 'POST') {
            sent.push(request.postDataJSON())
            return respond(failSend ? { error: 'Synthetic send failure' } : { sent: true }, failSend ? 500 : 200)
          }
          return respond(new URL(request.url()).searchParams.has('mailbox') ? { threads: [], nextCursor: null } : { mailboxes: [{ id: 'mailbox', email: 'office@example.invalid', canSend: true }] })
        }
        unexpected.push(path); return respond({ error: 'Unexpected fixture API' }, 500)
      })
      await page.goto(`${base}/profile-email-review`)
      const panel = page.getByRole('dialog')
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await panel.getByRole('status', { name: 'Loading composer' }).waitFor()
      assert.equal(await panel.getByRole('textbox', { name: 'Email body' }).count(), 0, 'Wait for sender settings before displaying the editor')
      releaseSender()
      const subject = panel.getByRole('textbox', { name: 'Email subject' }), body = panel.getByRole('textbox', { name: 'Email body' })
      await subject.fill('Lesson question')
      await body.fill('Keep this email draft')
      assert.equal(await page.getByRole('dialog').count(), 1)
      const initialWidth = (await panel.boundingBox()).width
      await panel.getByRole('button', { name: 'Back to contact', exact: true }).click()
      await panel.getByRole('heading', { name: 'Alex Example', exact: true }).waitFor()
      assert.equal((await panel.boundingBox()).width, initialWidth)
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.waitFor()
      assert.equal(await subject.inputValue(), 'Lesson question')
      assert.equal(await body.innerText(), 'Keep this email draft')
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await panel.getByText('Synthetic send failure', { exact: true }).first().waitFor()
      assert.equal(await subject.inputValue(), 'Lesson question')
      assert.equal(await body.innerText(), 'Keep this email draft')
      assert.equal(sent.length, 1)
      assert.deepEqual(sent[0].to, ['person:alex'])
      assert.equal(sent[0].expectedContactEmail, 'alex@example.invalid')
      assert.equal(sent[0].senderEmail, 'office@example.invalid')
      assert.equal(sent[0].mailboxId, 'mailbox')
      failSend = false
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[aria-label="Email subject"]')?.value === '')
      assert.equal(await body.innerText(), '')
      assert.equal(sent.length, 2)
      assert.equal(await page.getByRole('dialog').count(), 1)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.goto(`${base}/profile-email-review?legacy=1&mobile=${width === 390 ? '1' : '0'}`)
      await panel.getByRole('textbox', { name: 'Profile note', exact: true }).fill('Keep profile context')
      const profileWidth = (await panel.boundingBox()).width
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.fill('Standard profile draft')
      await body.fill('Retain the standard email body')
      assert.equal(await page.getByRole('dialog').count(), 1, 'Standard profile switches within the existing drawer')
      assert.equal((await panel.boundingBox()).width, profileWidth)
      await panel.getByRole('button', { name: 'Back to contact', exact: true }).click()
      assert.equal(await panel.getByRole('textbox', { name: 'Profile note', exact: true }).inputValue(), 'Keep profile context')
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      assert.equal(await subject.inputValue(), 'Standard profile draft')
      assert.equal(await body.innerText(), 'Retain the standard email body')
      assert.equal(sent.length, 2, 'Switching views never sends mail')
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
      console.log(`PASS ${width}px: same panel, delayed settings skeleton, draft survives profile switch/send failure, explicit send payload and success clear; synthetic APIs only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })