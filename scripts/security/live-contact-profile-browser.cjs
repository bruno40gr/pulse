/* eslint-disable @typescript-eslint/no-require-imports -- Browser fixture with every API request intercepted. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.LIVE_CONTACT_REVIEW_URL || 'http://127.0.0.1:3248/dashboard/contacts'
const tenant = '00000000-0000-0000-0000-000000000001'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixtures only')
const row = (id, first_name, last_name, patch) => ({
  id, tenant_id: tenant, first_name, last_name, phone: null, email: null, client_status: 'active', opted_out: false,
  custom_fields: {}, notes_history: [], student_notes_history: [], ...patch,
})

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, screen: { width, height: 850 } })
      page.setDefaultTimeout(10000)
      const errors = [], writes = [], unexpected = []
      let viewOnly = false, fail = true
      const roster = [
        row('student', 'Emma', 'Smith', { account_id: 'family', is_student: true, student_id: 'roster-emma', is_minor: true, account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holder_phone: '2025550199', account_holder_email: 'jane@example.test', email: 'emma@example.test', date_of_birth: '2015-02-03' }),
        row('sibling', 'Noah', 'Smith', { account_id: 'family', is_student: true, student_id: 'roster-noah', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holder_phone: '2025550199' }),
        row('holder', 'Jane', 'Smith', { is_student: false, phone: '2025550198' }),
        row('legacy-student', 'Ivy', 'Lee', { account_id: 'legacy', is_student: true, student_id: 'roster-ivy', account_holder_name: 'Jamie Lee', account_holder_email: 'summary@example.test' }),
      ]
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname
        const method = request.method()
        if (path === '/api/contacts') return route.fulfill({ json: roster, headers: {
          'x-contacts-can-edit': String(!viewOnly), 'x-contacts-can-read-notes': 'true', 'x-contacts-can-edit-notes': String(!viewOnly),
        } })
        if (path === '/api/tenant-fields') return route.fulfill({ json: [] })
        if (path === '/api/inbox/reconcile' || path === '/api/account/me') return route.fulfill({ json: {} })
        if (path === '/api/communications/senders') return route.fulfill({ json: { senders: [] } })
        if (path === '/api/contacts/accounts/legacy/profile' && method === 'PATCH') {
          assert.deepEqual(request.postDataJSON(), { name: 'Jamie Updated', phone: '2025550197' })
          const account = { id: 'legacy', name: 'Jamie Updated', phone: '2025550197', email: 'summary@example.test' }
          Object.assign(roster[3], { account_holder_name: account.name, account_holder_phone: account.phone })
          return route.fulfill({ json: account })
        }
        if (path === '/api/communications/recipients') {
          const { contactIds, channel } = request.postDataJSON()
          assert.deepEqual(contactIds, ['student'])
          assert.equal(channel, 'email')
          return route.fulfill({ json: { recipients: [], excluded: [], selectedCount: 1, version: 'fixture' } })
        }
        if (path === '/api/funding/cases') {
          assert.equal(url.searchParams.get('student_person_id'), 'student')
          return route.fulfill({ json: [] })
        }
        const contact = roster.find(person => person.id === path.split('/')[3])
        if (contact && method === 'GET') return route.fulfill({ json: contact })
        if (contact && method !== 'GET') {
          const action = path.split('/')[4], body = request.postDataJSON()
          writes.push({ action, id: contact.id, body })
          if (action === 'profile') {
            if (fail) { fail = false; return route.fulfill({ status: 500, json: { error: 'Could not save contact details.' } }) }
            Object.assign(contact, body)
            return route.fulfill({ json: contact })
          }
          if (action === 'internal-notes' || action === 'student-notes') {
            const field = action === 'internal-notes' ? 'notes_history' : 'student_notes_history'
            contact[field].push({ id: action, text: body.text, timestamp: '2026-11-18T12:00:00Z' })
            return route.fulfill({ status: 201, json: { [field]: contact[field] } })
          }
        }
        if (method !== 'GET') unexpected.push(path)
        return route.fulfill({ json: {} })
      })
      const table = page.getByRole('table', { name: 'Contacts' })
      const dialog = page.getByRole('dialog')
      const button = (name, container = dialog) => container.getByRole('button', { name, exact: true })
      const tab = name => button(name, dialog.getByRole('group', { name: 'Contact sections' }))
      const title = name => dialog.getByRole('heading', { name, exact: true }).waitFor()
      const close = async () => { await button('Close').click(); await dialog.waitFor({ state: 'hidden' }) }
      const note = async (label, text) => {
        await button(label).click()
        await dialog.getByPlaceholder('Write a note...').fill(text)
        await button('Save note').click()
        await dialog.getByText(text, { exact: true }).waitFor()
      }

      await page.goto(base)
      await button('Jamie Lee', table).click()
      await title('Jamie Lee')
      await dialog.getByText('summary@example.test').waitFor()
      await button('Edit Contact').click()
      await dialog.getByLabel('Name', { exact: true }).fill('Jamie Updated')
      await dialog.getByLabel('Phone', { exact: true }).fill('2025550197')
      await button('Save changes').click()
      await title('Jamie Updated')
      assert.equal(roster[3].first_name, 'Ivy')
      assert.equal(await tab('Notes').count(), 0)
      await close()

      await button('Jane Smith', table).click()
      await title('Jane Smith')
      await button('Open Emma Smith').click()
      await title('Emma Smith')
      assert.equal(await button('Send SMS').isEnabled(), true)
      const recipientCheck = page.waitForRequest('**/api/communications/recipients*')
      await button('Send email').click()
      await recipientCheck
      await button('Back to contact').click()
      await button('Edit Contact').click()
      await dialog.getByLabel('Email', { exact: true }).fill('')
      await dialog.getByLabel('Phone', { exact: true }).fill('2025550188')
      await button('Save changes').click()
      await dialog.getByRole('alert').getByText('Could not save contact details.').waitFor()
      assert.equal(await dialog.getByLabel('Email', { exact: true }).inputValue(), '')
      assert.equal(await dialog.getByLabel('Phone', { exact: true }).inputValue(), '2025550188')
      await button('Save changes').click()
      await button('Save changes').waitFor({ state: 'hidden' })
      assert.deepEqual(writes.slice(0, 2).map(write => write.body), [{ phone: '2025550188', email: null }, { phone: '2025550188', email: null }])
      for (const section of ['Schedule & lessons', 'Billing', 'Makeups']) {
        await tab(section).click()
        await dialog.getByText('Coming soon', { exact: true }).waitFor()
      }
      await tab('Funding Program').click()
      await dialog.getByText('No funding program assigned', { exact: true }).waitFor()
      await tab('Notes').click()
      await note('Add a note', 'Emma’s own note')
      await tab('Account').click()
      await button('Open Jane Smith').click()
      await title('Jane Smith')
      await button('Edit Contact').click()
      await dialog.getByLabel('Phone', { exact: true }).fill('')
      await button('Save changes').click()
      await button('Save changes').waitFor({ state: 'hidden' })
      await tab('Notes').click()
      await button('Internal notes').click()
      await note('Add internal note', 'Jane’s own note')
      assert.deepEqual(writes.slice(2).map(({ action, id }) => [action, id]), [['student-notes', 'student'], ['profile', 'holder'], ['internal-notes', 'holder']])
      assert.equal(roster[0].account_holder_phone, '2025550199')
      assert.equal(roster[1].phone, null)

      viewOnly = true
      await page.reload()
      await button('Jamie Updated', table).click()
      await title('Jamie Updated')
      await dialog.getByText('(202) 555-0197', { exact: true }).waitFor()
      assert.equal(await button('Edit Contact').isDisabled(), true)
      await page.goto(base)
      await button('Jane Smith', table).click()
      await title('Jane Smith')
      await dialog.getByText('Not provided', { exact: true }).first().waitFor()
      assert.equal(await button('Edit Contact').isDisabled(), true)
      await button('Open Emma Smith').click()
      await title('Emma Smith')
      await dialog.getByText('(202) 555-0188').waitFor()
      await tab('Notes').click()
      await dialog.getByText('Emma’s own note', { exact: true }).waitFor()
      assert.equal(await button('Add a note').count(), 0)
      assert.deepEqual(errors, [])
      assert.deepEqual(unexpected, [])
      await page.close()
      console.log(`Headliner Contacts fixture passed at ${width}px`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })