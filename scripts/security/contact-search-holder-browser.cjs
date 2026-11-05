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
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: Contacts first/last/holder/mixed-case and AI search; searchable student opens account-holder conversation`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })