/* eslint-disable @typescript-eslint/no-require-imports -- Local UI harness, all network responses synthetic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []; const sends = []
      page.on('pageerror', error => errors.push(error.message))
      const people = [
        { id: 'person:alex', name: 'Alex Example', email: 'alex@example.com', phone: '(202) 555-0101', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' },
        { id: 'lead:taylor', name: 'Taylor Example', email: 'taylor@example.com', phone: '(202) 555-0102', student: '', stage: 'new', profileType: 'lead', profileId: 'taylor', smsContactId: 'taylor', intakeType: 'lesson_inquiry' },
      ]
      const sms = { thread_key: 'alex-phone', contact_id: 'alex', other_phone: people[0].phone, display_name: people[0].name, student_name: '', client_status: '', profile_type: 'contact', profile_id: 'alex', has_unread: true, messages: [{ id: 'sms-one', body: 'Previous real-shaped SMS history', direction: 'inbound', status: 'received', created_at: '2026-10-17T12:00:00Z' }] }
      const email = { id: 'email:box:thread:person:alex', contactId: people[0].id, name: people[0].name, email: people[0].email, phone: people[0].phone, initials: 'AE', student: '', stage: '', interest: '', nextAction: '', note: '', channel: 'email', subject: 'Piano inquiry', mailboxId: 'box', providerThreadId: 'thread', unread: false, messages: [{ id: 'email-one', channel: 'email', direction: 'inbound', body: 'Previous email context', time: 'October 17', timestamp: '2026-10-17T12:00:00Z' }] }
      await page.context().route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url()); const method = request.method()
        const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
        if (url.pathname === '/api/conversations') return fulfill({ people })
        if (url.pathname === '/api/inbox') return fulfill(method === 'PATCH' ? { success: true } : [sms])
        if (url.pathname === '/api/inbox/reply') { sends.push(['sms', request.postDataJSON()]); return fulfill({ success: true }) }
        if (url.pathname === '/api/conversations/email') {
          if (method === 'POST') { sends.push(['email', request.postDataJSON()]); return fulfill({ error: 'Synthetic provider failure; draft kept.' }, 502) }
          if (!url.searchParams.has('mailbox')) return fulfill({ mailboxes: [{ id: 'box', email: 'office@example.com', canSend: true }] })
          return fulfill({ threads: url.searchParams.get('person') === people[0].id ? [email] : [], nextCursor: null })
        }
        if (url.pathname === '/api/contacts/alex') return fulfill({ id: 'alex', first_name: 'Alex', last_name: 'Example', phone: people[0].phone, email: people[0].email, client_status: 'active', opted_out: false, last_attended: null, notes: null, family_name: null, account_holder_name: null, account_holder_phone: null, account_holder_email: null, custom_fields: {} })
        if (url.pathname === '/api/leads/taylor') return fulfill({ id: 'taylor', intake_type: 'lesson_inquiry', status: 'new', created_at: '2026-10-17T12:00:00Z', source_form: 'manual', source_page: null, program_label: null, service_label: null, payload: {}, contact: { id: 'taylor', full_name: people[1].name, email: people[1].email, phone: people[1].phone }, notes_history: [], events: [] })
        if (url.pathname === '/api/tenant-fields') return fulfill([])
        return fulfill([])
      })
      await page.goto(process.env.CONVERSATIONS_LIVE_REVIEW_URL || 'http://127.0.0.1:3102')
      const button = name => page.getByRole('button', { name, exact: true })
      await button('Open conversation with Alex Example').click()
      await page.getByText('Previous real-shaped SMS history', { exact: true }).waitFor()
      await page.getByRole('textbox', { name: 'SMS message', exact: true }).fill('Keep this personal draft')
      await button('Open lead for Alex Example').click()
      await page.getByRole('dialog').waitFor()
      assert.equal(await page.getByRole('region', { name: 'Lead preview' }).count(), 0)
      await page.getByRole('dialog').getByText('alex@example.com', { exact: true }).first().waitFor()
      const contactPanelWidth = (await page.getByRole('dialog').boundingBox()).width
      assert.ok(Math.abs(contactPanelWidth - (width > 760 ? Math.min(width * 0.75, 960) : width)) < 1)
      for (const channel of ['email', 'sms']) {
        const label = channel === 'email' ? 'Send email' : 'Send SMS'
        await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click()
        await page.getByRole('dialog').waitFor({ state: 'hidden' })
        assert.equal(page.context().pages().length, 1)
        if (channel === 'email') {
          await page.getByRole('region', { name: 'Email composer', exact: true }).waitFor()
          await page.getByRole('textbox', { name: 'Email body', exact: true }).fill('Keep card email draft')
          await button('SMS').click()
        }
        assert.equal(sends.length, 0)
        if (channel === 'email') {
          await button('Open lead for Alex Example').click()
          await page.getByRole('dialog').getByText('alex@example.com', { exact: true }).first().waitFor()
        }
      }
      assert.equal(await page.getByRole('textbox', { name: 'SMS message', exact: true }).inputValue(), 'Keep this personal draft')
      await button('Email').click()
      await page.getByRole('region', { name: 'Email reader', exact: true }).getByText('Previous email context', { exact: true }).waitFor()
      if (width <= 760) await button('Back to emails').click()
      await button('Read email: Piano inquiry').click()
      await button('Reply').click()
      const composer = page.getByRole('region', { name: 'Email composer', exact: true })
      await composer.getByRole('textbox', { name: 'Email body', exact: true }).fill('Retain failed email draft')
      await composer.getByRole('button', { name: 'Send email', exact: true }).click()
      await page.getByRole('alert').getByText('Synthetic provider failure; draft kept.', { exact: true }).waitFor()
      assert.equal(sends.filter(([channel]) => channel === 'email').length, 1)
      assert.equal(await composer.getByRole('textbox', { name: 'Email body', exact: true }).innerText(), 'Retain failed email draft')
      assert.equal(sends.find(([channel]) => channel === 'email')[1].mailboxId, 'box')
      await button('SMS').click()
      assert.equal(await page.getByRole('textbox', { name: 'SMS message', exact: true }).inputValue(), 'Keep this personal draft')
      await button('Send').click()
      await page.getByText('Text message submitted.', { exact: true }).waitFor()
      assert.equal(sends.filter(([channel]) => channel === 'sms').length, 1)
      assert.equal(await page.getByRole('textbox', { name: 'SMS message', exact: true }).inputValue(), '')
      await button('Back to Conversations').click()
      await button('Open conversation with Taylor Example').click()
      await page.getByText('No text messages yet. Write one below.', { exact: true }).waitFor()
      await button('Open lead for Taylor Example').click()
      await page.getByRole('dialog', { name: 'Lead details', exact: true }).waitFor()
      await page.getByRole('status', { name: 'Loading profile', exact: true }).waitFor({ state: 'hidden' })
      assert.ok(Math.abs((await page.getByRole('dialog', { name: 'Lead details', exact: true }).boundingBox()).width - contactPanelWidth) < 1, 'Lead and contact drawers must have identical widths')
      for (const channel of ['email', 'sms']) {
        await page.getByRole('dialog').getByRole('button', { name: channel === 'email' ? 'Send email' : 'Send SMS', exact: true }).click()
        await page.getByRole('dialog').waitFor({ state: 'hidden' })
        assert.equal(page.context().pages().length, 1)
        if (channel === 'email') {
          await page.getByRole('region', { name: 'Email composer', exact: true }).waitFor()
          await button('Open lead for Taylor Example').click()
          await page.getByRole('status', { name: 'Loading profile', exact: true }).waitFor({ state: 'hidden' })
        }
      }
      assert.ok(await button('SMS').isVisible())
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `No horizontal overflow at ${width}`)
      await page.screenshot({ path: `/tmp/pulse-live-conversations-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      const sendsBeforeEdgeCases = sends.length
      await page.context().route('**/api/conversations/email?*', async route => {
        assert.equal(route.request().method(), 'GET')
        await route.fulfill({ json: { mailboxes: [] } })
      })
      const base = process.env.CONVERSATIONS_LIVE_REVIEW_URL || 'http://127.0.0.1:3102'
      await page.goto(`${base}/dashboard/inbox?recipient=person%3Aalex&channel=email&compose=1`)
      await page.getByRole('region', { name: 'Email composer', exact: true }).waitFor()
      await page.getByRole('textbox', { name: 'Email body', exact: true }).fill('Draft before connecting Gmail')
      await page.getByRole('textbox', { name: 'Email subject', exact: true }).fill('Ready to connect')
      assert.equal(await page.getByRole('button', { name: 'Send email', exact: true }).isDisabled(), true)
      await page.screenshot({ path: `/tmp/pulse-card-no-mailbox-${width}.png`, fullPage: true })
      for (const query of ['recipient=foreign&channel=email&compose=1', 'tenant=other&recipient=person%3Aalex&channel=sms&compose=1']) {
        await page.goto(`${base}/dashboard/inbox?${query}`)
        await page.getByRole('alert').filter({ hasText: 'This recipient link is unavailable' }).waitFor()
        assert.equal(await page.getByRole('region', { name: 'Email composer', exact: true }).count(), 0)
        await page.getByRole('button', { name: 'Browse Conversations', exact: true }).click()
        await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).waitFor()
      }
      assert.equal(sends.length, sendsBeforeEdgeCases)
      console.log(`PASS ${width}: SMS history/draft, contact and lead side panels, email history, failed-send draft retention, mailbox identity, no overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })