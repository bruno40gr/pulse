/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/contacts/[id]/follow-ups/route.ts'
const person = '11111111-1111-4111-8111-111111111111'
const lead = '22222222-2222-4222-8222-222222222222'
const record = { id: '33333333-3333-4333-8333-333333333333', tenant_id: HEAD, person_id: person, lead_intake_id: null, due_at: '2026-12-01T20:00:00Z', message: 'Call after school', status: 'open', version: 1 }
function setup(options = {}) {
  const h = createHarness(), grants = options.grants ?? ['contacts.read', 'contacts.manage', 'leads.read', 'leads.manage']
  h.setScenario({ env: { NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS: options.disabled ? 'false' : 'true' }, actor: options.anonymous ? null : { personId: 'staff', displayName: 'Staff' },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'role', legacy_access_enabled: true, status: 'active' }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'assistant' }], permissions: grants.map(key => ({ id: key, key })), role_permissions: grants.map(key => ({ role_id: 'role', permission_id: key })),
      people: [{ id: person, tenant_id: options.foreign ? DEMO : HEAD }],
      lead_intakes: [{ id: lead, tenant_id: HEAD, person_id: options.unlinked ? 'other' : person }],
      follow_ups: [record, { ...record, id: 'inquiry', lead_intake_id: lead }, { ...record, id: 'foreign', tenant_id: DEMO }],
    }, rpcResults: { save_shared_follow_up: [record] }, rpcErrors: options.conflict ? { save_shared_follow_up: { code: '40001' } } : options.failure ? { save_shared_follow_up: { message: 'secret' } } : {},
  })
  return h
}
const request = (body, tenant = HEAD) => new Request(`https://synthetic.invalid/api/contacts/${person}/follow-ups?tenant=${tenant}`, body ? { method: 'PATCH', body: JSON.stringify(body) } : {})
const params = () => ({ params: Promise.resolve({ id: person }) })
const command = { action: 'save', lead_intake_id: null, expected_version: 0, due_at: '2026-12-01T20:00:00Z', message: 'Call after school' }

test('feature is off by default and never accesses a database when disabled', async () => {
  const h = setup({ disabled: true })
  assert.equal((await h.load(route).GET(request(), params())).status, 404)
  assert.equal(h.getQueries().length, 0)
})
test('contact reads retain date/message and include only tenant-scoped linked inquiry contexts', async () => {
  const h = setup(), response = await h.load(route).GET(request(), params())
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.follow_ups.length, 2)
  assert.equal(data.follow_ups[0].message, 'Call after school')
  assert.equal(data.can_edit_inquiries, true)
})
test('contact-only permissions never expose inquiry reminders', async () => {
  const h = setup({ grants: ['contacts.read'] }), response = await h.load(route).GET(request(), params())
  const data = await response.json()
  assert.equal(data.follow_ups.length, 1); assert.equal(data.can_edit_inquiries, false)
})
test('unauthorized, foreign contacts, unlinked inquiries and malformed commands never write', async () => {
  for (const [options, body, status] of [
    [{ anonymous: true }, command, 401], [{ grants: ['contacts.read'] }, command, 403], [{ foreign: true }, command, 404],
    [{ unlinked: true }, { ...command, lead_intake_id: lead }, 404], [{ grants: ['contacts.manage'] }, { ...command, lead_intake_id: lead }, 403],
    [{}, { ...command, due_at: 'invalid' }, 400], [{}, { ...command, expected_version: -1 }, 400], [{}, { ...command, message: 'x'.repeat(12001) }, 400],
  ]) {
    const h = setup(options), response = await h.load(route).PATCH(request(body), params())
    assert.equal(response.status, status)
    assert.equal(h.getQueries().some(query => query.operation === 'rpc'), false)
  }
})
test('save/clear/complete use the CRM transaction and authenticated membership, never caller actor', async () => {
  for (const action of ['save', 'clear', 'complete']) {
    const h = setup(), response = await h.load(route).PATCH(request({ ...command, action, actor: 'forged', lead_intake_id: lead }), params())
    assert.equal(response.status, 200)
    const rpc = h.getQueries().find(query => query.operation === 'rpc')
    assert.equal(rpc.database, 'crm'); assert.equal(rpc.payload.p_actor, 'membership'); assert.equal(rpc.payload.p_person, person)
    assert.equal(rpc.payload.p_action, action)
  }
})
test('conflicts and database failures remain failures and hide internal errors', async () => {
  for (const [options, status] of [[{ conflict: true }, 409], [{ failure: true }, 503]]) {
    const h = setup(options), response = await h.load(route).PATCH(request(command), params())
    assert.equal(response.status, status); assert.doesNotMatch(JSON.stringify(await response.json()), /secret/)
  }
})