/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic local browser acceptance; no provider sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.COMMUNICATIONS_PROFILE_REVIEW_URL || 'http://127.0.0.1:3271/communications-profile-review'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local review only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], sends = []
      const tenant = '00000000-0000-0000-0000-000000000001'
      const contact = { id: 'alex', tenant_id: tenant, first_name: 'Alex', last_name: 'Example', phone: '2025550101', email: 'alex@example.invalid', is_student: true, student_id: 'student', client_status: 'active', message_routing: 'student', custom_fields: {}, profile_enrollments: [], notes_history: [], student_notes_history: [] }
      const person = { id: 'person:alex', name: 'Alex Example', email: contact.email, phone: contact.phone, student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }
      const thread = { thread_key: 'alex-phone', contact_id: 'alex', other_phone: contact.phone, display_name: person.name, student_name: '', client_status: '', profile_type: 'contact', profile_id: 'alex', has_unread: false,
        messages: [{ id: 'sms-one', body: 'Customer message stays visible', direction: 'inbound', created_at: '2026-11-25T12:00:00Z' }] }
      let failProfile = false, releaseProfile
      const profileGate = new Promise(resolve => { releaseProfile = resolve })
      let profileRequests = 0
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        if (request.method() !== 'GET' && url.pathname !== '/api/inbox') sends.push(url.pathname)
        const fulfill = (json, extra = {}) => route.fulfill({ json, ...extra })
        if (url.pathname === '/api/conversations') return fulfill({ people: [person] })
        if (url.pathname === '/api/inbox') return fulfill(request.method() === 'PATCH' ? { success: true } : [thread])
        if (url.pathname === '/api/contacts/alex') {
          profileRequests++
          await profileGate
          return failProfile ? fulfill({ error: 'Fixture profile unavailable' }, { status: 503 }) : fulfill(contact)
        }
        if (url.pathname === '/api/contacts') return fulfill([contact], { headers: { 'X-Contacts-Can-Edit': 'true', 'X-Contacts-Can-Read-Notes': 'true', 'X-Contacts-Can-Edit-Notes': 'true' } })
        if (url.pathname === '/api/conversations/email') return fulfill({ mailboxes: [], threads: [] })
        return fulfill([])
      })
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(base)
      await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).click()
      const sms = page.getByRole('textbox', { name: 'SMS message', exact: true })
      await sms.fill('Preserve this unsent reply')
      await sms.evaluate(node => { node.dataset.retainedComposer = 'true' })
      const open = () => page.getByRole('button', { name: 'View contact for Alex Example', exact: true }).click()
      await open()
      await page.getByRole('status', { name: 'Loading profile', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Send SMS', exact: true }).count(), 0)
      releaseProfile()
      const dialog = page.getByRole('dialog').first()
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      assert.equal(await dialog.getByText('AI highlights', { exact: true }).count(), 0)
      const bounds = await dialog.boundingBox()
      assert.ok(Math.abs(bounds.width - (width > 760 ? width * 0.65 : width)) < 2)
      await dialog.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.equal(await sms.inputValue(), 'Preserve this unsent reply')
      assert.equal(await sms.getAttribute('data-retained-composer'), 'true')
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'SMS message')
      assert.equal(page.context().pages().length, 1)
      await page.getByText('Customer message stays visible', { exact: true }).waitFor()
      await open()
      await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.equal(await sms.inputValue(), 'Preserve this unsent reply')
      failProfile = true
      await open()
      await page.getByText('Fixture profile unavailable', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.equal(await sms.inputValue(), 'Preserve this unsent reply')
      assert.deepEqual(sends, [])
      assert.deepEqual(errors, [])
      assert.ok(profileRequests >= 3)
      await page.screenshot({ path: `/tmp/communications-contact-profile-${width}.png` })
      console.log(`PASS ${width}px: current contact panel, skeleton, same mounted SMS composer and draft, focus, Escape, error recovery, no sends`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })