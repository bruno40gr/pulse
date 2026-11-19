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
      const errors = [], writes = [], unexpected = [], recipientChecks = []
      let viewOnly = false, fail = true
      const roster = [
        row('student', 'Emma', 'Smith', { account_id: 'family', is_student: true, student_id: 'roster-emma', is_minor: true, account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holder_phone: '2025550199', account_holder_email: 'jane@example.test', email: 'emma@example.test', date_of_birth: '2015-02-03' }),
        row('sibling', 'Noah', 'Smith', { account_id: 'family', is_student: true, student_id: 'roster-noah', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holder_phone: '2025550199' }),
        row('holder', 'Jane', 'Smith', { is_student: false, phone: '2025550198' }),
        row('legacy-student', 'Ivy', 'Lee', { account_id: 'legacy', is_student: true, student_id: 'roster-ivy', is_minor: true, message_routing: 'account_holder', account_holder_name: 'Jamie Lee', account_holder_phone: '2025550196', account_holder_email: 'summary@example.test', profile_enrollments: [
          { id: 'piano', instrument: 'Piano', plan_name: '30 min lesson', lesson_day: 'Monday', lesson_time: '3 PM' },
          { id: 'guitar', instrument: 'Guitar', plan_name: '45 min lesson', lesson_day: 'Thursday', lesson_time: '4 PM' },
        ] }),
        row('email-only', 'Rae', 'Diaz', { account_id: 'emailonly', is_student: true, student_id: 'roster-rae', is_minor: true, account_holder_name: 'Rae Diaz Account', account_holder_email: 'rae@example.test' }),
      ]
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname
        const method = request.method()
        if (path === '/api/contacts') return route.fulfill({ json: roster, headers: {
          'x-contacts-can-edit': String(!viewOnly), 'x-contacts-can-read-notes': 'true', 'x-contacts-can-edit-notes': String(!viewOnly),
        } })
        if (path === '/api/tenant-fields') return route.fulfill({ json: [] })
        if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { flagged: [], opted_out: [] } })
        if (path === '/api/inbox/reconcile' || path === '/api/account/me') return route.fulfill({ json: {} })
        if (path === '/api/communications/senders') return route.fulfill({ json: { senders: [] } })
        const accountProfile = path.match(/^\/api\/contacts\/accounts\/([^/]+)\/profile$/)
        if (accountProfile && method === 'PATCH') {
          const id = accountProfile[1], body = request.postDataJSON()
          writes.push({ action: 'account-profile', id, body })
          const owner = roster.find(person => person.account_id === (id === 'legacy' ? 'legacy' : 'family'))
          const account = { id, name: body.name ?? owner?.account_holder_name ?? 'Account holder',
            phone: body.phone === undefined ? owner?.account_holder_phone ?? null : body.phone,
            email: body.email === undefined ? owner?.account_holder_email ?? null : body.email }
          for (const member of roster) if (member.account_id === (id === 'legacy' ? 'legacy' : 'family')) {
            Object.assign(member, { account_holder_name: account.name, account_holder_phone: account.phone, account_holder_email: account.email,
              account_holders: [{ name: account.name, phone: account.phone, email: account.email, relationship: null, is_primary: true }] })
          }
          return route.fulfill({ json: account })
        }
        if (path === '/api/communications/recipients') {
          const { contactIds, channel } = request.postDataJSON()
          recipientChecks.push([channel, contactIds])
          return route.fulfill({ json: { recipients: [], excluded: [], selectedCount: contactIds.length, version: 'fixture' } })
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
      assert.match(await button('Send email').innerText(), /summary@example.test/)
      const metadata = dialog.locator('[aria-label="Contact details metadata"]')
      assert.deepEqual(await metadata.locator(':scope > div').evaluateAll(nodes => nodes.map(node => node.firstElementChild.textContent)), ['Dependents', 'Member since', 'Birthday'])
      assert.equal(await metadata.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 3)
      assert.equal(await dialog.getByRole('button', { name: 'Open profile', exact: true }).count(), 0)
      await button('Add subscription').waitFor()
      await button('Ivy Lee Piano subscription actions').click()
      await dialog.getByRole('menuitem', { name: 'Manage subscription' }).click()
      const manage = page.getByRole('dialog', { name: 'Manage subscription', exact: true })
      await manage.getByText('Coming soon', { exact: true }).waitFor()
      await button('Close', manage).click()
      await button('Ivy Lee Guitar subscription actions').waitFor()
      await dialog.getByText('Account Balance', { exact: true }).waitFor()
      assert.ok(await dialog.getByText('Coming soon', { exact: true }).count() >= 2)
      assert.equal(await button('Send SMS').isEnabled(), true)
      await button('Send SMS').click()
      await page.waitForFunction(() => window.performance.getEntriesByType('resource').some(entry => entry.name.includes('/api/communications/recipients')))
      await button('Back to contact').click()
      assert.deepEqual(recipientChecks.at(-1), ['sms', ['legacy-student']])
      await close()
      await button('Rae Diaz Account', table).click()
      await title('Rae Diaz Account')
      assert.equal(await button('Send SMS').isDisabled(), true)
      assert.equal(await button('Send email').isEnabled(), true)
      await close()
      await button('Jamie Lee', table).click()
      await title('Jamie Lee')
      await button('Ivy Lee').click()
      await title('Ivy Lee')
      const accountLink = dialog.getByRole('link', { name: 'Jamie Lee', exact: true })
      const accountHref = await accountLink.getAttribute('href')
      assert.equal(accountHref, '/dashboard/contacts?account=legacy')
      await accountLink.click()
      await title('Jamie Lee')
      const deepLink = await browser.newPage({ viewport: { width, height: 850 } })
      await deepLink.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        return route.fulfill({ json: path === '/api/contacts' ? roster : path === '/api/tenant-fields' ? [] : {} })
      })
      await deepLink.goto(new URL(accountHref, base).href)
      await deepLink.getByRole('dialog').getByRole('heading', { name: 'Jamie Lee', exact: true }).waitFor()
      await deepLink.close()
      await close()
      await button('Jamie Lee', table).click()
      await title('Jamie Lee')
      await button('Edit Contact').click()
      await dialog.getByLabel('Name', { exact: true }).fill('Jamie Updated')
      await dialog.getByLabel('Phone', { exact: true }).fill('2025550197')
      await button('Save changes').click()
      await title('Jamie Updated')
      assert.equal(roster[3].first_name, 'Ivy')
      await tab('Notes').click()
      await dialog.getByText('Coming soon', { exact: true }).waitFor()
      await close()

      await button('Jane Smith', table).click()
      await title('Jane Smith')
      await button('Emma Smith').click()
      await title('Emma Smith')
      const holderLink = dialog.getByRole('link', { name: 'Jane Smith', exact: true })
      assert.equal(await holderLink.getAttribute('href'), '/dashboard/contacts?contact=holder')
      await holderLink.click()
      await title('Jane Smith')
      await button('Emma Smith').click()
      await title('Emma Smith')
      assert.equal(await button('Send SMS').isEnabled(), true)
      const recipientCheck = page.waitForRequest('**/api/communications/recipients*')
      await button('Send email').click()
      await recipientCheck
      assert.deepEqual(recipientChecks.at(-1), ['email', ['student']])
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
      assert.deepEqual(writes.filter(write => write.action === 'profile' && write.id === 'student').map(write => write.body), [{ phone: '2025550188', email: null }, { phone: '2025550188', email: null }])
      for (const section of ['Schedule & lessons', 'Billing', 'Makeups']) {
        await tab(section).click()
        await dialog.getByText('Coming soon', { exact: true }).waitFor()
      }
      await tab('Funding Program').click()
      await dialog.getByText('No funding program assigned', { exact: true }).waitFor()
      await tab('Notes').click()
      await note('Add a note', 'Emma’s own note')
      await button('Internal notes').click()
      await note('Add internal note', 'Emma’s internal note')
      await close()
      await button('Jane Smith', table).click()
      await title('Jane Smith')
      await button('Edit Contact').click()
      await dialog.getByLabel('Phone', { exact: true }).fill('')
      await button('Save changes').click()
      await button('Save changes').waitFor({ state: 'hidden' })
      assert.equal(roster.find(person => person.id === 'holder').phone, null)
      assert.deepEqual(writes.map(({ action, id }) => [action, id]), [
        ['account-profile', 'legacy'], ['profile', 'student'], ['profile', 'student'],
        ['student-notes', 'student'], ['internal-notes', 'student'], ['profile', 'holder'],
      ])
      assert.equal(roster[0].account_holder_phone, '2025550199')
      assert.equal(roster[1].phone, null)

      viewOnly = true
      await page.reload()
      await button('Jamie Updated', table).click()
      await title('Jamie Updated')
      assert.match(await button('Send SMS').innerText(), /\(202\) 555-0197/)
      assert.equal(await button('Edit Contact').isDisabled(), true)
      await page.goto(base)
      await button('Jane Smith', table).click()
      await title('Jane Smith')
      assert.equal(roster.find(person => person.id === 'holder').phone, null)
      assert.equal(await button('Edit Contact').isDisabled(), true)
      await button('Emma Smith').click()
      await title('Emma Smith')
      assert.match(await button('Send SMS').innerText(), /\(202\) 555-0199/)
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