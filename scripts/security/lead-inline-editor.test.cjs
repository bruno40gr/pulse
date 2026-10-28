/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

function scenario() {
  return {
    actor: { personId: 'staff', instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, name: 'Synthetic school', is_demo: true }],
      crm_contacts: [{ id: 'contact', tenant_id: HEAD, full_name: 'Synthetic Contact' }],
      lead_intakes: [{ id: 'inquiry', tenant_id: HEAD, contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'lost', updated_at: '2026-10-28T10:00:00Z', payload: { student_name: 'Original', winback: { status: 'to_contact' }, follow_up_note: 'Keep reminder' } }],
    },
  }
}
async function patch(h, body) {
  return h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/inquiry', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'inquiry' }) })
}
test('stale inline edits fail before writes', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await patch(h, { expected_updated_at: 'stale', payload: { student_name: 'Changed' } })
  assert.equal(response.status, 409)
  assert.equal(h.getWrites().length, 0)
})
test('inline editing uses the real API and preserves Win-back metadata and status', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await patch(h, { expected_updated_at: '2026-10-28T10:00:00Z', intake_type: 'tour_request', payload: { student_name: 'Changed' } })
  assert.equal(response.status, 200)
  const write = h.getWrites().find(q => q.table === 'lead_intakes' && q.operation === 'update')
  assert.equal(write.payload.intake_type, 'tour_request')
  assert.equal(write.payload.payload.student_name, 'Changed')
  assert.equal(write.payload.payload.winback.status, 'to_contact')
  assert.equal(write.payload.payload.follow_up_note, 'Keep reminder')
  assert.equal('status' in write.payload, false)
})
test('unsupported inline lead type fails before writes', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await patch(h, { intake_type: 'unknown' })
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
})