/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression; all API responses are synthetic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const sends = [], errors = []
      page.on('pageerror', error => errors.push(error.message))
      const person = { id: 'person:alex', name: 'Alex Example', phone: '+12025550101', email: '', student: '', stage: '', profileType: 'contact', profileId: 'alex', smsContactId: 'alex' }
      await page.route('**/api/**', route => {
        const request = route.request(), path = new URL(request.url()).pathname
        if (path === '/api/conversations') return route.fulfill({ json: { people: [person] } })
        if (path === '/api/inbox') return route.fulfill({ json: [{ thread_key: 'alex-phone', contact_id: 'alex', other_phone: person.phone, display_name: person.name, profile_type: 'contact', profile_id: 'alex', messages: [{ id: 'previous', body: 'Previous SMS', direction: 'inbound', status: 'read', created_at: new Date().toISOString() }] }] })
        if (path === '/api/inbox/reply') {
          sends.push(request.postDataJSON())
          return route.fulfill({ json: { success: true } })
        }
        if (path === '/api/conversations/email') return route.fulfill({ json: { mailboxes: [], threads: [] } })
        return route.fulfill({ json: [] })
      })
      await page.goto(process.env.SMS_ENTER_REVIEW_URL || 'http://127.0.0.1:3218/dashboard/inbox')
      await page.getByRole('button', { name: 'Open conversation with Alex Example', exact: true }).click()
      const input = page.getByRole('textbox', { name: 'SMS message', exact: true })
      await input.fill('First paragraph')
      await input.press('End')
      await input.press('Enter')
      await input.press('Enter')
      await input.pressSequentially('Second paragraph')
      await input.press('Shift+Enter')
      await input.pressSequentially('Another line')
      const body = 'First paragraph\n\nSecond paragraph\nAnother line'
      assert.equal(await input.inputValue(), body, 'Enter inserts newlines and retains the draft')
      assert.equal(sends.length, 0, 'Enter must never submit an SMS')
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await page.getByText('Text message submitted.', { exact: true }).waitFor()
      assert.equal(sends.length, 1, 'Only clicking Send submits the message')
      assert.equal(sends[0].body, body, 'Paragraph breaks are preserved in the sent message')
      assert.equal(await input.inputValue(), '')
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS ${width}px: Enter/Shift+Enter insert newlines; clicking Send submits once with paragraphs intact`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })