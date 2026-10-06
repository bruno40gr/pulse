const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

const original = { id: 'existing-contact', tenant_id: HEAD, full_name: 'Synthetic Original', email: 'shared@example.invalid', phone: '111' }
function intakeRequest(body) {
  return new Request('https://synthetic.invalid/api/intake', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ intake_type: 'lesson_inquiry', source_form: 'manual-meta', source_system: 'pulse-manual', ...body }),
  })
}
for (const fields of [
  { full_name: 'Synthetic Other', email: original.email, phone: '222' },
  { full_name: 'Synthetic Other', email: 'different@example.invalid', phone: original.phone },
  { full_name: original.full_name, email: original.email, phone: original.phone },
]) test(`intake inserts an independent contact even when identity fields overlap: ${JSON.stringify(fields)}`, async () => {
  const h = createHarness()
  h.setScenario({ fixtures: { crm_contacts: [original] } })
  const response = await h.load('app/api/intake/route.ts').POST(intakeRequest(fields))
  assert.equal(response.status, 200)
  const contacts = h.getQueries().filter(q => q.table === 'crm_contacts')
  assert.equal(contacts.length, 1)
  assert.equal(contacts[0].operation, 'insert')
  assert.equal(contacts[0].payload.full_name, fields.full_name)
  assert.equal(h.getWrites().some(q => q.operation === 'update'), false)
})

function detailScenario(shared = true) {
  return {
    actor: { personId: 'staff', instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, name: 'Synthetic school', is_demo: true }],
      crm_contacts: [original],
      lead_intakes: [
        { id: 'older', tenant_id: HEAD, contact_id: original.id, intake_type: 'lesson_inquiry', status: 'new', payload: { message: 'Initial manual note' }, created_at: '2026-10-01T00:00:00Z', crm_contacts: original },
        ...(shared ? [{ id: 'newer', tenant_id: HEAD, contact_id: original.id }] : []),
      ],
    },
  }
}
test('shared-contact identity correction is refused before any writes', async () => {
  const h = createHarness()
  h.setScenario(detailScenario())
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(
    new Request('https://synthetic.invalid/api/leads/older', { method: 'PATCH', body: JSON.stringify({ full_name: 'Synthetic Other', status: 'contacted' }) }),
    { params: Promise.resolve({ id: 'older' }) },
  )
  assert.equal(response.status, 409)
  assert.equal(h.getWrites().length, 0)
})
test('initial manual note appears in lead detail without a database backfill', async () => {
  const h = createHarness()
  h.setScenario(detailScenario(false))
  const response = await h.load('app/api/leads/[id]/route.ts').GET(
    new Request('https://synthetic.invalid/api/leads/older?intake_type=lesson_inquiry'),
    { params: Promise.resolve({ id: 'older' }) },
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).notes_history[0].text, 'Initial manual note')
})
test('saving unrelated fields on a shared contact is allowed and preserves the creation note', async () => {
  const h = createHarness()
  h.setScenario(detailScenario())
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(
    new Request('https://synthetic.invalid/api/leads/older', { method: 'PATCH', body: JSON.stringify({ full_name: original.full_name, email: original.email, phone: original.phone, status: 'contacted' }) }),
    { params: Promise.resolve({ id: 'older' }) },
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).notes_history[0].text, 'Initial manual note')
})
test('an independent contact can still be corrected', async () => {
  const h = createHarness()
  h.setScenario(detailScenario(false))
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(
    new Request('https://synthetic.invalid/api/leads/older', { method: 'PATCH', body: JSON.stringify({ full_name: 'Synthetic Corrected' }) }),
    { params: Promise.resolve({ id: 'older' }) },
  )
  assert.equal(response.status, 200)
  assert.equal(h.getWrites().find(q => q.table === 'crm_contacts').payload.full_name, 'Synthetic Corrected')
})
test('creation message and subsequent notes both survive and are sorted', () => {
  const h = createHarness()
  const { getLeadNotesHistory } = h.load('lib/lead-notes.ts')
  const notes = getLeadNotesHistory([{ id: 'note', event_type: 'note_added', payload: { text: 'Follow-up', actor: { displayName: 'Staff' } }, created_at: '2026-10-02T00:00:00Z' }],
    { id: 'lead', payload: { message: ' Initial note ' }, created_at: '2026-10-01T00:00:00Z' })
  assert.equal(notes.length, 2)
  assert.equal(notes[0].text, 'Follow-up')
  assert.equal(notes[1].text, 'Initial note')
})