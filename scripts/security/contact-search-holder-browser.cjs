/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic identities, database and API; no provider sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const base = process.env.CONTACT_SEARCH_REVIEW_URL || 'http://127.0.0.1:3218'
const rows = [
  { id: 'faith', first_name: 'Faith', last_name: 'Sanchez', tenant_id: HEAD, is_student: true, student_id: 'student-faith', client_status: 'active',
    account_id: 'family', account_holder_name: 'Valerie Sanchez', is_minor: true, message_routing: 'account_holder', account_holder_phone: '+12025550101', account_holder_email: 'valerie@example.invalid', custom_fields: {}, opted_out: false },
  { id: 'other', first_name: 'Jordan', last_name: 'Lee', tenant_id: HEAD, is_student: true, student_id: 'student-other', client_status: 'active', custom_fields: {}, opted_out: false },
]
const people = rows.map(row => ({ ...row, email: null, phone: null, students: [{ is_minor: row.is_minor, message_routing: row.message_routing,
  accounts: row.account_id ? { name: row.account_holder_name, email: row.account_holder_email, phone: row.account_holder_phone } : null,
  client_status: 'active', enrollments: [{ instrument: row.id === 'faith' ? 'Piano' : 'Drums', custom_fields: {} }] }] }))
;(async () => {
  const harness = createHarness()
  harness.setScenario({ actor: { personId: 'staff', access: { kind: 'headliner' } }, allowSyntheticAI: true,
    syntheticAIText: JSON.stringify({ instruments: ['piano'], explanation: 'Piano students' }), fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'role', status: 'active', legacy_access_enabled: true }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'owner' }], people,
    } })
  const api = harness.load('app/api/ai-filter/route.ts')
  const { conversationContact } = harness.load('lib/conversations-directory.ts')
  const directory = people.map(conversationContact)
  const linkedFamily = ['Alex', 'Taylor', 'Casey'].map((first_name, index) => ({
    id: `linked-${index}`, first_name, last_name: 'Example', phone: '+12025550999',
    students: [{ is_minor: true, accounts: null, student_accounts: [{ accounts: {
      name: 'Morgan Example', phone: '+12025550102', email: 'morgan@example.invalid',
    } }] }],
  }))
  directory.push(...linkedFamily.map(conversationContact))
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname
        if (path === '/api/ai-filter') {
          const result = await api.POST(new Request(req.url(), { method: 'POST', body: req.postData(), headers: { 'Content-Type': 'application/json' } }))
          return route.fulfill({ status: result.status, json: await result.json() })
        }
        if (path === '/api/inbox/reconcile' || (path === '/api/inbox' && req.method() === 'PATCH')) return route.fulfill({ json: {} })
        if (path === '/api/communications/recipients') {
          const { resolveCommunicationRecipients } = harness.load('lib/communication-recipients.ts')
          const ids = req.postDataJSON().contactIds
          const resolution = resolveCommunicationRecipients([...people, ...linkedFamily].filter(person => ids.includes(person.id)), 'sms')
          return route.fulfill({ json: { ...resolution, version: 'synthetic-review' } })
        }
        if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { sensitive: false } })
        if (req.method() !== 'GET') { writes.push(path); return route.abort() }
        if (path === '/api/contacts') return route.fulfill({ json: rows })
        if (path === '/api/conversations') return route.fulfill({ json: { people: directory } })
        if (path === '/api/inbox') return route.fulfill({ json: [{ thread_key: 'family-phone', profile_type: 'contact', profile_id: 'faith', contact_id: 'faith',
          display_name: 'Valerie Sanchez', student_name: 'Faith Sanchez', other_phone: '+12025550101', has_unread: false,
          messages: [{ id: 'message', direction: 'outbound', body: 'Lesson availability', status: 'delivered', created_at: '2026-11-05T10:00:00Z' }] }] })
        if (path === '/api/conversations/email') return route.fulfill({ json: { mailboxes: [], threads: [] } })
        return route.fulfill({ json: path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto(`${base}/dashboard/contacts`)
      const search = page.getByRole('textbox', { name: 'Search contacts', exact: true })
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      for (const query of ['Faith', 'fAiTh', 'SANCHEZ', 'VALERIE', 'Who takes keys?']) {
        await search.fill(query)
        await search.press('Enter')
        await page.getByText('1 contact', { exact: true }).waitFor()
        assert.equal(await table.getByRole('button', { name: 'Jordan Lee', exact: true }).count(), 0)
        await table.getByRole('button', { name: 'Faith Sanchez', exact: true }).waitFor()
      }
      await page.goto(`${base}/dashboard/inbox`)
      const communicationsSearch = page.getByRole('searchbox', { name: 'Search communications', exact: true })
      await communicationsSearch.fill('faith')
      await page.getByRole('button', { name: 'Open conversation with Valerie Sanchez', exact: true }).click()
      await page.getByText('Student: Faith Sanchez', { exact: false }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Open conversation with Faith Sanchez', exact: true }).count(), 0)
      await page.goto(`${base}/dashboard/inbox`)
      await page.getByRole('button', { name: 'Send new text message', exact: true }).click()
      const picker = page.getByRole('dialog', { name: 'New message', exact: true })
      const recipientSearch = picker.getByRole('textbox', { name: 'Search SMS recipients', exact: true })
      await recipientSearch.fill('morgan')
      const results = picker.getByRole('table', { name: 'SMS recipients search results', exact: true })
      assert.equal(await results.getByText('Morgan Example', { exact: true }).count(), 1)
      assert.equal(await results.getByText('(202) 555-0102', { exact: true }).count(), 1)
      const searchBounds = await recipientSearch.boundingBox()
      const viewBounds = await picker.getByRole('group', { name: 'Recipient view', exact: true }).boundingBox()
      if (width >= 900) {
        assert.ok(Math.abs(searchBounds.y - viewBounds.y) < 4, 'Search and toggles share a toolbar row')
        assert.ok(viewBounds.x > searchBounds.x + searchBounds.width, 'View toggles sit to the right of search')
      } else {
        assert.ok(viewBounds.y >= searchBounds.y + searchBounds.height, 'Mobile toolbar stacks without crowding')
      }
      assert.equal(await results.getByRole('checkbox').count(), 2, 'Only parent and select-all checkboxes in family view')
      for (const name of ['Alex', 'Taylor', 'Casey']) {
        await recipientSearch.fill(name)
        await results.getByText('Morgan Example', { exact: true }).waitFor()
        assert.equal(await results.getByText(`${name} Example`, { exact: true }).count(), 1)
      }
      const familyName = results.getByText('Morgan Example', { exact: true })
      const studentName = results.getByText('Casey Example', { exact: true })
      assert.equal(await familyName.evaluate(node => getComputedStyle(node).fontWeight), '600', 'Shared parent name weight')
      assert.equal(await studentName.evaluate(node => getComputedStyle(node).fontWeight), '400', 'Shared detail name weight')
      const familyBounds = await familyName.boundingBox()
      const studentBounds = await studentName.boundingBox()
      assert.ok(Math.abs(familyBounds.x - studentBounds.x) < 2, 'Shared family and detail name alignment')
      await results.getByRole('checkbox', { name: 'Select Add Morgan Example to SMS recipients', exact: true }).check()
      await picker.getByRole('button', { name: 'View students', exact: true }).click()
      await results.getByText('Casey Example', { exact: true }).waitFor()
      await results.getByText('(202) 555-0102', { exact: true }).waitFor()
      await picker.getByRole('button', { name: 'Remove Morgan Example from SMS recipients', exact: true }).click()
      await results.getByRole('checkbox', { name: 'Select Add Casey Example to SMS recipients', exact: true }).check()
      await picker.getByRole('button', { name: 'View families', exact: true }).click()
      assert.equal(await results.getByRole('checkbox', { name: 'Select Remove Morgan Example from SMS recipients', exact: true }).isChecked(), true)
      await picker.getByRole('button', { name: 'View students', exact: true }).click()
      assert.equal(await results.getByRole('checkbox', { name: 'Select Remove Casey Example from SMS recipients', exact: true }).isChecked(), true)
      await picker.screenshot({ path: `/private/tmp/family-picker-students-${width}.png` })
      await picker.getByRole('button', { name: 'Send text message (1)', exact: true }).click()
      await page.getByRole('heading', { name: 'Morgan Example', exact: true }).waitFor()
      await page.getByText('Student: Casey Example', { exact: false }).waitFor()
      // Multiple students sharing a destination must still count as one recipient.
      await page.goto(`${base}/dashboard/inbox`)
      await page.getByRole('button', { name: 'Send new text message', exact: true }).click()
      await recipientSearch.fill('morgan')
      await picker.getByRole('button', { name: 'View students', exact: true }).click()
      await results.getByRole('checkbox', { name: 'Select all', exact: true }).check()
      await picker.getByRole('button', { name: 'Send text message (1)', exact: true }).waitFor()
      await picker.getByRole('button', { name: 'View families', exact: true }).click()
      await recipientSearch.fill('')
      await results.getByRole('checkbox', { name: 'Select Add Valerie Sanchez to SMS recipients', exact: true }).check()
      await picker.screenshot({ path: `/private/tmp/family-picker-families-${width}.png` })
      assert.ok(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), 'Modal must fit viewport')
      assert.ok(await results.evaluate(node => node.scrollWidth <= node.clientWidth), 'Recipient columns must fit without horizontal scrolling')
      await picker.getByRole('button', { name: 'Send text message (2)', exact: true }).click()
      await page.getByRole('button', { name: 'Edit recipients', exact: true }).click()
      const edit = page.getByRole('dialog', { name: 'Edit SMS recipients', exact: true })
      await edit.getByRole('textbox', { name: 'Search SMS recipients', exact: true }).fill('Casey')
      const editResults = edit.getByRole('table', { name: 'SMS recipients search results', exact: true })
      await editResults.getByText('Morgan Example', { exact: true }).waitFor()
      await editResults.getByText('Casey Example', { exact: true }).waitFor()
      assert.equal(await editResults.getByRole('checkbox', { name: 'Select Remove Morgan Example from SMS recipients', exact: true }).isChecked(), true)
      await edit.getByRole('button', { name: 'View students', exact: true }).click()
      await editResults.getByText('Casey Example', { exact: true }).waitFor()
      await edit.getByRole('button', { name: 'Done', exact: true }).click()
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: Contacts search, account-holder conversation and new-text picker with three linked students`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })