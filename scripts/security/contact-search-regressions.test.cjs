/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic database and AI; no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const person = (id, first, last, instrument = 'Piano') => ({ id, tenant_id: HEAD, first_name: first, last_name: last,
  email: null, opted_out: false, students: [{ id: `s-${id}`, client_status: 'active', accounts: { name: id === 'faith' ? 'Valerie Sanchez (account)' : 'Morgan Lee (account)' },
    enrollments: [{ instrument, service_type: 'private', lesson_day: 'Tuesday', custom_fields: {} }] }] })
async function search(query, options = {}) {
  const harness = createHarness()
  harness.setScenario({ actor: { instructorId: 'teacher', personId: 'staff', access: { kind: 'headliner' } },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'role', status: 'active', legacy_access_enabled: true }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }], role_permissions: [{ role_id: 'role', permission_id: 'read' }],
      permissions: [{ id: 'read', key: 'contacts.read' }],
      people: [person('faith', 'Faith', 'Sanchez'), person('other', 'Jordan', 'Lee', 'Drums')],
    }, ...options })
  const response = await harness.load('app/api/ai-filter/route.ts').POST(new Request('http://synthetic.invalid/api/ai-filter', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, tenant: HEAD }),
  }))
  assert.equal(response.status, 200)
  return { body: await response.json(), queries: harness.getQueries() }
}
test('first, last, full and partial names work in any case without AI', async () => {
  for (const query of ['Faith', 'FAITH', 'faith', 'fAiTh', 'Fai', 'SANCHEZ', '  FAITH   SANCHEZ  ']) {
    assert.deepEqual(JSON.parse(JSON.stringify((await search(query)).body.contact_ids)), ['faith'], query)
  }
})
test('account-holder names search student references and natural language remains available', async () => {
  assert.equal((await search('vALERIE')).body.contact_ids.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify((await search('active piano students')).body.contact_ids)), ['faith'])
  assert.deepEqual(JSON.parse(JSON.stringify((await search('Who takes keys?', {
    allowSyntheticAI: true, syntheticAIText: JSON.stringify({ instruments: ['piano'], explanation: 'Piano students' }),
  })).body.contact_ids)), ['faith'])
})
test('search reads beyond the first database page and scopes every page to the tenant', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => person(String(i), i === 1000 ? 'Faith' : 'Other', 'Example'))
  const { body, queries } = await search('faith', { queryResult: ({ table, filters }) => {
    if (table !== 'people') return
    const range = filters.find(filter => filter[0] === 'range')
    return { data: rows.slice(range[1], range[2] + 1), error: null }
  } })
  assert.deepEqual(JSON.parse(JSON.stringify(body.contact_ids)), ['1000'])
  const pages = queries.filter(query => query.table === 'people')
  assert.equal(pages.length, 2)
  assert.ok(pages.every(query => query.filters.some(([op, key, value]) => op === 'eq' && key === 'tenant_id' && value === HEAD)))
})

test('search requires contacts.read and rejects conflicting tenant selections before domain reads', async () => {
  const harness = createHarness()
  harness.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }], role_permissions: [], permissions: [],
  } })
  const route = harness.load('app/api/ai-filter/route.ts')
  const request = tenant => new Request(`http://synthetic.invalid/api/ai-filter?tenant=${tenant}`, {
    method: 'POST', body: JSON.stringify({ query: 'Faith', tenant: HEAD }),
  })
  assert.equal((await route.POST(request(HEAD))).status, 403)
  assert.equal((await route.POST(request('00000000-0000-0000-0000-000000000004'))).status, 400)
  assert.equal(harness.getQueries().some(query => query.table === 'people' || query.table === 'import_profiles'), false)
})

test('Communications uses the account holder while retaining student ID and searchable name', () => {
  const harness = createHarness()
  const { conversationContact } = harness.load('lib/conversations-directory.ts')
  const row = { id: 'faith', first_name: 'Faith', last_name: 'Sanchez', phone: 'child-phone', email: 'child@example.invalid',
    students: [{ is_minor: true, accounts: [{ name: 'Valerie Sanchez (account)', phone: '+12025550101', email: 'valerie@example.invalid' }] }] }
  const holder = conversationContact(row)
  assert.equal(holder.name, 'Valerie Sanchez')
  assert.equal(holder.student, 'Faith Sanchez')
  assert.equal(holder.smsContactId, 'faith')
  assert.equal(holder.phone, '+12025550101')
  const { mergeConversationThreads } = harness.load('lib/conversations-live.ts')
  const threads = mergeConversationThreads([holder], [{ contactId: holder.id, channel: 'sms', name: 'Faith Sanchez', student: '', phone: holder.phone }])
  assert.equal(threads[0].name, 'Valerie Sanchez')
  assert.equal(threads[0].student, 'Faith Sanchez')
  assert.equal(conversationContact({ ...row, students: [] }).name, 'Faith Sanchez')
  const missing = conversationContact({ ...row, students: [{ is_minor: true, accounts: null }] })
  assert.equal(missing.phone, '', 'Never substitute a minor’s own number for a missing holder')
})