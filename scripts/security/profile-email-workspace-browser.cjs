/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only browser acceptance, synthetic APIs; never sends real mail. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_REVIEW_URL || 'http://127.0.0.1:3271'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 1076, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], sent = [], unexpected = [], historyReads = [], smsSent = []
      let inboxReads = 0
      let failHistory = false, releaseHistory
      let historyGate = Promise.resolve()
      const delivered = []
      const seed = (id, direction, body, phone) => ({ id, direction, body, created_at: `2026-11-23T15:0${id.endsWith('1') ? 1 : 2}:00Z`, status: direction === 'outbound' ? 'delivered' : 'received', phone })
      let multiHolder = false
      const campaignSends = []
      let senderReads = 0
      let failSend = true, failSettings = false, releaseSender
      const senderGate = new Promise(resolve => { releaseSender = resolve })
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        const respond = (json, status = 200) => route.fulfill({ json, status })
        if (path === '/api/contacts/alex/follow-ups') return respond({ follow_ups: [], can_edit_inquiries: false })
        if (path === '/api/inbox') {
          inboxReads++; await historyGate
          if (failHistory) return respond({ error: 'Synthetic history failure' }, 500)
          return respond(['+15555550123', '+15555550124', '+15555550999'].map((phone, index) => ({ other_phone: phone, messages: [
            seed(`${index}-1`, 'outbound', `Previous outgoing ${index}`, phone), seed(`${index}-2`, 'inbound', `Previous reply ${index}`, phone),
            ...delivered.filter(message => message.phone === phone),
          ] })))
        }
        if (path === '/api/inbox/reply') {
          smsSent.push(request.postDataJSON())
          if (!failSend) delivered.push(seed(`sent-${delivered.length}`, 'outbound', request.postDataJSON().body, request.postDataJSON().to_phone))
          return respond(failSend ? { error: 'Synthetic SMS failure' } : { ok: true }, failSend ? 500 : 200)
        }
        if (path === '/api/account/me') return respond({ user: { displayName: 'Fixture' } })
        if (path === '/api/contacts') return respond([{ id: 'alex', first_name: 'Alex', last_name: 'Example', phone: '+15555550123', email: 'alex@example.invalid' }])
        if (path === '/api/staff') return respond([])
        if (path === '/api/brand-settings') return respond({})
        if (path === '/api/contacts/check-sensitive') return respond({ flagged: [], opted_out: [] })
        if (path === '/api/communications/recipients') return respond({ version: 'synthetic-v1', recipients: multiHolder && request.postDataJSON().channel === 'sms' ? [
          { destination: '+15555550123', name: 'Sam Holder', contactIds: ['alex'] },
          { destination: '+15555550124', name: 'Taylor Holder', contactIds: ['alex'] },
        ] : [{ destination: request.postDataJSON().channel === 'sms' ? '+15555550123' : 'alex@example.invalid', name: 'Alex Example', contactIds: ['alex'] }], excluded: [], selectedCount: 1 })
        if (path === '/api/campaigns' && request.method() === 'POST') { delivered.push(seed(`campaign-${delivered.length}`, 'outbound', request.postDataJSON().message, '+15555550124')); return respond({ id: 'synthetic-campaign' }) }
        if (path === '/api/campaigns/synthetic-campaign/send') { campaignSends.push(request.postDataJSON()); return respond({ ok: true, sent: 1, failed: 0 }) }
        if (path === '/api/conversations') return respond({ people: [{ id: 'person:alex', aliases: ['lead:alex'], name: 'Alex Example', email: 'alex@example.invalid', phone: '+15555550123', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }] })
        if (path === '/api/communications/senders') {
          senderReads++
          await senderGate
          if (failSettings) return respond({ error: 'Synthetic settings failure' }, 500)
          return respond({ senders: [{ id: 'office', email: 'office@example.invalid', name: 'Office', mine: true, signatureHtml: '<p>Office signature</p>' }] })
        }
        if (path === '/api/conversations/templates') return respond({ templates: [] })
        if (path === '/api/conversations/signature') return respond({ company: 'School', phone: '', logoUrl: '' })
        if (path === '/api/conversations/email') {
          if (request.method() === 'POST') {
            sent.push(request.postDataJSON())
            return respond(failSend ? { error: 'Synthetic send failure' } : { sent: true }, failSend ? 500 : 200)
          }
          if (new URL(request.url()).searchParams.has('mailbox') || new URL(request.url()).searchParams.has('summary')) historyReads.push(request.url())
          return respond(new URL(request.url()).searchParams.has('mailbox') ? { threads: [], nextCursor: null } : { mailboxes: [{ id: 'mailbox', email: 'office@example.invalid', canSend: true }] })
        }
        unexpected.push(path); return respond({ error: 'Unexpected fixture API' }, 500)
      })
      await page.goto(`${base}/profile-email-review`)
      const panel = page.getByRole('dialog')
      const initialProfileWidth = (await panel.boundingBox()).width
      assert.ok(Math.abs(initialProfileWidth - (width > 960 ? width / 2 : width)) < 2)
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await panel.getByRole('status', { name: 'Loading composer' }).waitFor()
      assert.equal(await panel.getByRole('textbox', { name: 'Email body' }).count(), 0, 'Wait for sender settings before displaying the editor')
      releaseSender()
      const subject = panel.getByRole('textbox', { name: 'Email subject' }), body = panel.getByRole('textbox', { name: 'Email body' })
      await subject.fill('Lesson question')
      await body.fill('Keep this email draft')
      assert.equal(await panel.getByRole('button', { name: 'Close', exact: true }).count(), 1)
      assert.equal(await panel.getByRole('heading', { name: 'Write email', level: 2 }).count(), 1)
      const closeBox = await panel.getByRole('button', { name: 'Close', exact: true }).boundingBox()
      assert.ok(closeBox.x > width - 90, 'Only close icon is at the far right of the workspace')
      assert.equal(await page.getByRole('dialog').count(), 1)
      assert.ok(Math.abs((await panel.boundingBox()).width - width) < 2)
      if (width > 960) {
        const left = await panel.getByRole('region', { name: 'Profile', exact: true }).boundingBox()
        const right = await panel.getByRole('region', { name: 'Message composer', exact: true }).boundingBox()
        assert.ok(Math.abs(left.width - width / 2) < 2)
        assert.ok(Math.abs(right.x - width / 2) < 2)
        await panel.getByRole('button', { name: 'Notes', exact: true }).click()
        await panel.getByRole('button', { name: 'Account', exact: true }).click()
      }
      const settingsBeforeReopen = senderReads
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('heading', { name: 'Alex Example', exact: true }).waitFor()
      await page.waitForFunction(expected => Math.abs(document.querySelector('[role="dialog"]').getBoundingClientRect().width - expected) < 2, initialProfileWidth)
      assert.equal((await panel.boundingBox()).width, initialProfileWidth)
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.waitFor()
      assert.equal(senderReads, settingsBeforeReopen, 'Reopening uses the mounted composer without reloading settings')
      assert.equal(await subject.inputValue(), 'Lesson question')
      assert.equal(await body.innerText(), 'Keep this email draft')
      await panel.getByRole('region', { name: 'Message composer', exact: true }).getByRole('button', { name: 'Send', exact: true }).click()
      await panel.getByText('Synthetic send failure', { exact: true }).first().waitFor()
      assert.equal(await subject.inputValue(), 'Lesson question')
      assert.equal(await body.innerText(), 'Keep this email draft')
      assert.equal(sent.length, 1)
      assert.deepEqual(sent[0].to, ['person:alex'])
      assert.equal(sent[0].expectedContactEmail, 'alex@example.invalid')
      assert.equal(sent[0].senderEmail, 'office@example.invalid')
      assert.equal(sent[0].mailboxId, 'mailbox')
      failSend = false
      await panel.getByRole('region', { name: 'Message composer', exact: true }).getByRole('button', { name: 'Send', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[aria-label="Email subject"]')?.value === '')
      assert.equal(await body.innerText(), '')
      assert.equal(sent.length, 2)
      assert.equal(await page.getByRole('dialog').count(), 1)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.equal(inboxReads, 0, 'Email does not load SMS history')
      historyGate = new Promise(resolve => { releaseHistory = resolve })
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await panel.getByRole('status', { name: 'Loading SMS history' }).waitFor()
      assert.equal(await panel.getByText('No text messages yet. Write one below.', { exact: true }).count(), 0)
      releaseHistory()
      await panel.getByRole('region', { name: 'SMS history' }).getByText('Previous reply 0', { exact: true }).waitFor()
      const sms = panel.getByRole('textbox', { name: 'SMS message' })
      await sms.fill('Keep this SMS draft')
      assert.equal(await panel.getByRole('heading', { name: 'Messaging Alex Example', level: 2 }).count(), 1)
      assert.equal(await panel.getByRole('combobox', { name: 'SMS account holder' }).count(), 0)
      assert.equal(await panel.getByRole('button', { name: 'Send', exact: true }).count(), 1)
      const smsComposer = panel.getByRole('region', { name: 'Message composer', exact: true })
      const headingBox = await smsComposer.getByRole('heading', { name: 'Messaging Alex Example' }).boundingBox()
      const composerBox = await smsComposer.boundingBox(), editorBox = await sms.boundingBox()
      assert.ok(headingBox.y - composerBox.y < 60, 'SMS toolbar is at the top, not centered beside history')
      assert.ok(editorBox.y > headingBox.y && editorBox.width > 150 && editorBox.x >= composerBox.x, 'SMS editor stays below the toolbar without overflow')
      assert.ok(editorBox.height >= 60 && editorBox.height <= 120, 'Compact reply box leaves room for conversation bubbles')
      if (width > 700) {
        const preview = await smsComposer.getByRole('complementary', { name: 'SMS preview pane' }).boundingBox()
        const history = await smsComposer.getByRole('region', { name: 'SMS history' }).boundingBox()
        assert.ok(Math.abs(preview.width - history.width) < 2, 'Conversation and preview are exactly 50/50')
      }
      assert.equal(await smsComposer.getByRole('complementary', { name: 'SMS preview pane' }).isVisible(), true)
      await smsComposer.getByRole('region', { name: 'SMS phone preview for Alex Example' }).getByText('Keep this SMS draft', { exact: true }).waitFor()
      assert.equal(await panel.getByRole('region', { name: 'SMS history' }).count(), 1)
      await sms.press('Enter')
      assert.equal(smsSent.length, 0, 'Enter inserts a newline rather than sending a profile draft')
      assert.ok((await sms.inputValue()).includes('\n'))
      await sms.fill('Keep this SMS draft')
      failSend = true
      await smsComposer.getByRole('button', { name: 'Send', exact: true }).click()
      await panel.getByText('Synthetic SMS failure', { exact: true }).waitFor()
      assert.equal(await sms.inputValue(), 'Keep this SMS draft', 'SMS transport failure preserves the draft')
      await page.screenshot({ path: `/tmp/profile-sms-${width}.png` })
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.fill('Separate email draft')
      await body.fill('Separate email body')
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      assert.equal(await sms.inputValue(), 'Keep this SMS draft')
      failSend = false
      await smsComposer.getByRole('button', { name: 'Send', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[aria-label="SMS message"]')?.value === '')
      assert.deepEqual(smsSent[1], { contact_id: 'alex', to_phone: '+15555550123', body: 'Keep this SMS draft' })
      assert.ok(inboxReads > 0)
      await panel.getByRole('region', { name: 'SMS history' }).getByText('Keep this SMS draft', { exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      assert.equal(await subject.inputValue(), 'Separate email draft')
      assert.equal(await body.innerText(), 'Separate email body')
      await page.clock.install()
      const inactiveReads = inboxReads
      await page.clock.fastForward(61_000)
      assert.equal(inboxReads, inactiveReads, 'Mounted SMS composer does not poll while email is active')
      failHistory = true
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await panel.getByText('Synthetic history failure', { exact: true }).waitFor()
      assert.equal(await panel.getByText('No text messages yet. Write one below.', { exact: true }).count(), 0)
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      const closedReads = inboxReads
      await page.clock.fastForward(61_000)
      assert.equal(inboxReads, closedReads, 'Cancelled SMS composer does not poll')
      failHistory = false
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await panel.getByRole('region', { name: 'SMS history' }).getByText('Previous reply 0', { exact: true }).waitFor()
      await panel.getByText('Synthetic history failure', { exact: true }).waitFor({ state: 'hidden' })
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await page.screenshot({ path: `/tmp/split-composer-${width}.png` })
      await page.goto(`${base}/profile-email-review?legacy=1&mobile=${width === 390 ? '1' : '0'}`)
      await panel.getByRole('textbox', { name: 'Profile note', exact: true }).fill('Keep profile context')
      const profileWidth = (await panel.boundingBox()).width
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.fill('Standard profile draft')
      await body.fill('Retain the standard email body')
      assert.equal(await page.getByRole('dialog').count(), 1, 'Standard profile switches within the existing drawer')
      assert.ok(Math.abs((await panel.boundingBox()).width - width) < 2)
      assert.ok(profileWidth <= width)
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.equal(await panel.getByRole('textbox', { name: 'Profile note', exact: true }).inputValue(), 'Keep profile context')
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      assert.equal(await subject.inputValue(), 'Standard profile draft')
      assert.equal(await body.innerText(), 'Retain the standard email body')
      assert.equal(sent.length, 2, 'Switching views never sends mail')
      await page.goto(`${base}/profile-email-review?lead=1&mobile=${width === 390 ? '1' : '0'}`)
      await panel.getByRole('heading', { name: 'Alex Example', exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.fill('Lead email draft')
      await body.fill('Keep lead email context')
      if (width > 960) {
        assert.equal(await panel.getByRole('heading', { name: 'Alex Example', exact: true }).isVisible(), true)
        assert.ok(Math.abs((await panel.boundingBox()).width - width) < 2)
      }
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await sms.fill('Lead SMS draft')
      assert.equal(await panel.getByRole('heading', { name: 'Messaging Alex Example', level: 2 }).count(), 1)
      assert.equal(await panel.getByRole('button', { name: 'Send', exact: true }).count(), 1)
      const leadPane = await panel.getByRole('region', { name: 'Message composer', exact: true }).boundingBox()
      const leadTitle = await panel.getByRole('heading', { name: 'Messaging Alex Example' }).boundingBox()
      assert.ok(leadTitle.y - leadPane.y < 60, 'Lead SMS toolbar is top aligned')
      assert.ok((await sms.boundingBox()).width > 150, 'Lead SMS editor remains usable beside or above preview')
      assert.equal(await panel.getByRole('region', { name: 'Message composer', exact: true }).getByRole('complementary', { name: 'SMS preview pane' }).isVisible(), true)
      await page.screenshot({ path: `/tmp/profile-sms-lead-${width}.png` })
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      assert.equal(await subject.inputValue(), 'Lead email draft')
      assert.equal(await body.innerText(), 'Keep lead email context')
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
      assert.equal(await sms.inputValue(), 'Lead SMS draft')
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      assert.equal(await page.getByRole('dialog').count(), 1)
      await page.screenshot({ path: `/tmp/split-composer-lead-${width}.png` })
      await panel.getByRole('region', { name: 'Message composer', exact: true }).getByRole('button', { name: 'Send', exact: true }).click()
      await panel.getByRole('region', { name: 'Message composer', exact: true }).waitFor({ state: 'hidden' })
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await subject.waitFor()
      assert.equal(await subject.inputValue(), '', 'A sent lead draft does not reappear')
      assert.equal(sent.length, 3)
      failSettings = true
      await page.goto(`${base}/profile-email-review`)
      await panel.getByRole('button', { name: 'Send email', exact: true }).click()
      await panel.getByText('Synthetic settings failure', { exact: true }).waitFor()
      assert.equal(await panel.getByRole('status', { name: 'Loading composer' }).count(), 0, 'Settings failure settles the loader')
      assert.equal(await body.count(), 0, 'Settings failure cannot expose an unauthorised send form')
      multiHolder = true
      for (const lead of [false, true]) {
        await page.goto(`${base}/profile-email-review?lead=${lead ? '1' : ''}&mobile=${width === 390 ? '1' : '0'}`)
        await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
        const picker = panel.getByRole('combobox', { name: 'SMS account holder' })
        await picker.waitFor()
        await panel.getByRole('heading', { name: 'Messaging Sam Holder', exact: true }).waitFor()
        await sms.fill('Draft for Sam')
        await picker.selectOption('+15555550124')
        await panel.getByRole('heading', { name: 'Messaging Taylor Holder', exact: true }).waitFor()
        await panel.getByRole('region', { name: 'SMS history' }).getByText('Previous reply 1', { exact: true }).waitFor()
        assert.equal(await panel.getByRole('region', { name: 'SMS history' }).getByText('Previous reply 0', { exact: true }).count(), 0)
        assert.equal(await sms.inputValue(), '', 'New holder starts with its own draft')
        await sms.fill('Draft for Taylor')
        await panel.getByRole('region', { name: 'SMS phone preview for Taylor Holder' }).getByText('Draft for Taylor', { exact: true }).waitFor()
        await picker.selectOption('+15555550123')
        assert.equal(await sms.inputValue(), 'Draft for Sam')
        await picker.selectOption('+15555550124')
        assert.equal(await sms.inputValue(), 'Draft for Taylor')
        await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
        await panel.getByRole('button', { name: 'Send SMS', exact: true }).click()
        assert.equal(await picker.inputValue(), '+15555550124')
        assert.equal(await sms.inputValue(), 'Draft for Taylor')
        await page.screenshot({ path: `/tmp/sms-holder-${lead ? 'lead' : 'contact'}-${width}.png` })
        await panel.getByRole('region', { name: 'Message composer', exact: true }).getByRole('button', { name: 'Send', exact: true }).click()
        if (lead) {
          await page.waitForFunction(() => document.querySelector('[aria-label="SMS message"]')?.value === '')
          await panel.getByRole('region', { name: 'SMS history' }).getByText('Draft for Taylor', { exact: true }).last().waitFor()
          assert.equal(campaignSends.at(-1).recipientDestination, '+15555550124')
          assert.equal(campaignSends.at(-1).recipientVersion, 'synthetic-v1')
        } else {
          await page.waitForFunction(() => document.querySelector('[aria-label="SMS message"]')?.value === '')
          assert.equal(smsSent.at(-1).to_phone, '+15555550124')
          assert.equal(smsSent.at(-1).body, 'Draft for Taylor')
        }
      }
      assert.deepEqual(historyReads, [], 'New-email composition never requests mailbox history or summary')
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
      console.log(`PASS ${width}px: contact + lead 50/50 conversation and preview, historical bubbles, compact reply, loading gate, holder-isolated history and drafts, verified selected-destination send, Cancel/reopen, newline safety; email regression passed; synthetic APIs only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })