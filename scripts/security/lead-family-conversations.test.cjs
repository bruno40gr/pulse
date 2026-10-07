/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing synthetic Node test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, DEMO, HEAD } = require('./synthetic-harness.cjs')

test('family pricing discounts additional siblings, ignores blank rows, and preserves explicit opt-out', () => {
  const { getLeadOpportunityValue } = createHarness().load('lib/lead-value.ts')
  const value = payload => getLeadOpportunityValue({ intakeType: 'lesson_inquiry', payload })
  const siblings = [{ name: 'Sibling' }, { name: '', age: '', instrument_interest: '' }]
  assert.equal(value({ potential_value_base: 160, siblings }), 304)
  assert.equal(value({ potential_value_base: 160, siblings, discount_offer_applied: false }), 320)
  assert.equal(value({ potential_value_base: 160, siblings: [] }), 160)
  assert.equal(value({ potential_value_base: '160', siblings: [{ age: 5 }, { instrument_interest: 'Tiny Keys' }] }), 448)
  assert.equal(value({ potential_value_base: 160, siblings: [null, 'invalid', {}] }), 160)
})

test('family dirty state only counts filled rows and recognizes deleting the last member', () => {
  const { familyMembersChanged, normalizeFamilyMembers } = createHarness().load('lib/lead-family.ts')
  assert.equal(familyMembersChanged([{ name: '', age: '', instrument_interest: '' }], []), false)
  assert.equal(familyMembersChanged([{ name: 'New' }], []), true)
  assert.equal(familyMembersChanged([{ age: 5 }], [{ age: '5' }]), false)
  assert.equal(familyMembersChanged([], [{ name: 'Saved' }]), true)
  const saved = normalizeFamilyMembers([{ name: ' Saved ', age: '5' }])
  assert.equal(familyMembersChanged(saved, saved), false)
})

test('note avatars derive distinct author initials with an honest unknown fallback', () => {
  const { getNoteAuthorInitials } = createHarness().load('lib/note-author.ts')
  assert.equal(getNoteAuthorInitials('Bruno Wong'), 'BW')
  assert.equal(getNoteAuthorInitials('  Alex Taylor  '), 'AT')
  assert.equal(getNoteAuthorInitials('Alex'), 'A')
  assert.equal(getNoteAuthorInitials(null), '?')
  assert.equal(getNoteAuthorInitials('   '), '?')
})

function setup(extra = {}) {
  const h = createHarness()
  h.setScenario({
    actor: { personId: 'staff', displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: DEMO } },
    fixtures: { tenants: [{ id: DEMO, name: 'Synthetic demo', is_demo: true }], messages: [
      { id: 'read', tenant_id: DEMO, direction: 'inbound', from_phone: '+12025550111', status: 'read' },
      { id: 'unread', tenant_id: DEMO, direction: 'inbound', from_phone: '+12025550111', status: 'received' },
      { id: 'outbound', tenant_id: DEMO, direction: 'outbound', from_phone: '+12025550111', status: 'delivered' },
      { id: 'other-phone', tenant_id: DEMO, direction: 'inbound', from_phone: '+12025550122', status: 'read' },
      { id: 'other-tenant', tenant_id: HEAD, direction: 'inbound', from_phone: '+12025550111', status: 'read' },
    ] }, ...extra,
  })
  return { h, PATCH: h.load('app/api/inbox/route.ts').PATCH }
}
const request = (body, tenant = DEMO) => new Request(`https://synthetic.invalid/api/inbox?tenant=${tenant}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

for (const action of ['mark_read', 'mark_unread', undefined]) test(`conversation action ${action} only updates matching inbound messages in its tenant`, async () => {
  const { h, PATCH } = setup()
  const response = await PATCH(request({ other_phone: '2025550111', action }))
  assert.equal(response.status, 200)
  const writes = h.getWrites()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].payload.status, action === 'mark_unread' ? 'received' : 'read')
  assert.ok(writes[0].filters.some(([method, key, value]) => method === 'eq' && key === 'tenant_id' && value === DEMO))
  assert.ok(writes[0].filters.some(([method, key, value]) => method === 'eq' && key === 'direction' && value === 'inbound'))
  const ids = writes[0].filters.find(([method, key]) => method === 'in' && key === 'id')[2]
  assert.equal(ids.length, 1)
  assert.equal(ids[0], action === 'mark_unread' ? 'read' : 'unread')
})

test('unread action rejects invalid selections and unauthenticated access without writes', async () => {
  for (const [body, tenant, extra, status] of [
    [{ other_phone: '2025550111', action: 'invalid' }, DEMO, {}, 400],
    [{ other_phone: 'bad', action: 'mark_unread' }, DEMO, {}, 400],
    [{ other_phone: '2025550111', action: 'mark_unread' }, HEAD, {}, 403],
    [{ other_phone: '2025550111', action: 'mark_unread' }, DEMO, { actor: null }, 401],
  ]) {
    const { h, PATCH } = setup(extra)
    assert.equal((await PATCH(request(body, tenant))).status, status)
    assert.equal(h.getWrites().length, 0)
  }
})

test('read-state storage failures surface instead of reporting success', async () => {
  const { PATCH } = setup({ errors: { messages: { message: 'Synthetic failure' } } })
  assert.equal((await PATCH(request({ other_phone: '2025550111', action: 'mark_unread' }))).status, 500)
})