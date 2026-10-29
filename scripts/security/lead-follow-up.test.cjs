/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

for (const [name, date, note, event] of [
  ['schedule', '2026-11-02T20:00:00.000Z', 'Call after school', 'follow_up_scheduled'],
  ['update', '2026-11-09T20:00:00.000Z', 'Send lesson options', 'follow_up_scheduled'],
  ['clear', null, null, 'follow_up_cleared'],
]) {
  test(`follow-up ${name} persists reminder and activity without replacing lead details`, async () => {
    const h = createHarness()
    h.setScenario({
      actor: { personId: 'staff', instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
      fixtures: {
        tenants: [{ id: HEAD, name: 'Synthetic school', is_demo: true }],
        crm_contacts: [{ id: 'contact', tenant_id: HEAD, full_name: 'Synthetic Contact' }],
        lead_intakes: [{ id: 'inquiry', tenant_id: HEAD, contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'contacted', payload: { student_name: 'Keep student', siblings: [{ name: 'Keep sibling' }], ...(name !== 'schedule' ? { follow_up_at: '2026-10-29T20:00:00Z', follow_up_note: 'Old reminder' } : {}) } }],
      },
    })
    const response = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/inquiry', {
      method: 'PATCH', body: JSON.stringify({ payload: { follow_up_at: date, follow_up_note: note } }),
    }), { params: Promise.resolve({ id: 'inquiry' }) })
    assert.equal(response.status, 200)
    const write = h.getWrites().find(q => q.table === 'lead_intakes' && q.operation === 'update')
    assert.equal(write.payload.payload.follow_up_at, date)
    assert.equal(write.payload.payload.follow_up_note, note)
    assert.equal(write.payload.payload.student_name, 'Keep student')
    assert.deepEqual(write.payload.payload.siblings, [{ name: 'Keep sibling' }])
    assert.equal('status' in write.payload, false)
    assert.ok(h.getWrites().some(q => q.table === 'lead_events' && q.operation === 'insert' && q.payload.event_type === event))
  })
}

test('read-only identity details do not disable the independent follow-up editor', () => {
  const panel = fs.readFileSync(path.join(__dirname, '../../components/leads/LeadDetailPanel.tsx'), 'utf8')
  assert.match(panel, /const followUpEditor = <DenseSectionPanel/)
  assert.match(panel, /actions=\{<div/)
  assert.match(panel, /Clear follow-up/)
  assert.match(panel, /\{isMobile \? <Disclosure[^\n]+\{followUpEditor\}[^\n]+: followUpEditor\}/)
  assert.doesNotMatch(panel, /staticDetails \? <DenseSectionPanel title=\{<SectionTitle>Follow-up/)
})