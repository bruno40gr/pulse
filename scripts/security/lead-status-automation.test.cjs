/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing synthetic Node harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

const helpers = createHarness().load('lib/lead-status-automation.ts')
for (const note of ['Left a voicemail', 'Called and left VM', 'Left them a message', 'LVM', 'Spoke with parent', 'Talked to the guardian']) {
  test(`clear completed outreach: ${note}`, () => assert.equal(helpers.detectNoteStatus(note)?.status, 'contacted'))
}
for (const note of ['Booked a lesson with Josh on Tuesday', 'Trial confirmed for Tuesday', 'Scheduled a piano lesson tomorrow', 'Confirmed the tour for Tuesday', 'Lesson was booked']) {
  test(`confirmed booking: ${note}`, () => assert.equal(helpers.detectNoteStatus(note)?.status, 'booked'))
}
for (const note of [
  'Not booked yet', 'Did not leave a voicemail', "Didn't leave a voicemail", 'Will leave a voicemail tomorrow',
  'Need to call', 'Leaving a voicemail', 'Wants to book a lesson', 'Asked about Tuesday availability',
  'Can we say the lesson is booked?', 'Tentative trial confirmed for Tuesday', 'Booked a lesson but cancelled it',
  'Previously booked a lesson', 'Example: booked a lesson with Josh', 'Parent said "left a voicemail"',
  'Asked about prices and schedules', 'Paid and enrolled', 'Booked a lesson? Waiting for parent to confirm',
  'If the lesson is booked, send a reminder', 'No answer; left a voicemail', 'Maybe trial confirmed',
  "Lesson isn't booked", "Wouldn't say the lesson is booked", 'Going to mark the lesson booked',
  'Trying to get the lesson booked', 'Hopes to get a trial confirmed',
]) test(`ambiguous notes remain manual: ${note}`, () => assert.equal(helpers.detectNoteStatus(note), null))

test('rules only advance New/Contacted and respect durable manual override', () => {
  const booked = helpers.detectNoteStatus('Booked a lesson with Josh')
  const contacted = helpers.detectNoteStatus('Left a voicemail')
  assert.equal(helpers.canApplyNoteStatus('new', booked, {}), true)
  assert.equal(helpers.canApplyNoteStatus('contacted', booked, {}), true)
  assert.equal(helpers.canApplyNoteStatus('contacted', contacted, {}), false)
  assert.equal(helpers.canApplyNoteStatus('new', booked, { status_automation: { paused: true } }), false)
  for (const status of ['booked', 'processing', 'won', 'lost', 'spam', 'ghosted_us']) {
    assert.equal(helpers.canApplyNoteStatus(status, booked, {}), false)
    assert.equal(helpers.canApplyNoteStatus(status, contacted, {}), false)
  }
})

function setup({ status = 'new', payload = {}, intakeType = 'lesson_inquiry', errors = {}, sourceForm = 'manual', updatedAt = '2026-10-06T00:00:00Z', extra = {} } = {}) {
  const h = createHarness()
  const contact = { id: 'contact', tenant_id: HEAD, full_name: 'Synthetic Parent', email: 'test@example.invalid', phone: '111' }
  const lead = { id: 'lead', tenant_id: HEAD, contact_id: contact.id, intake_type: intakeType, status,
    payload, source_form: sourceForm, updated_at: updatedAt, created_at: '2026-10-01T00:00:00Z', crm_contacts: contact }
  h.setScenario({ actor: { personId: 'staff', displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: { tenants: [{ id: HEAD, name: 'Synthetic', is_demo: true }], crm_contacts: [contact], lead_intakes: [lead] }, errors, ...extra })
  const PATCH = h.load('app/api/leads/[id]/route.ts').PATCH
  const patch = (body, tenant = HEAD) => PATCH(new Request(`https://synthetic.invalid/api/leads/lead?tenant=${tenant}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: 'lead' }) })
  return { h, patch, lead }
}

test('new saved note triggers scoped automatic change with durable evidence and history', async () => {
  const { h, patch } = setup()
  assert.equal((await patch({ add_note: 'Left a voicemail' })).status, 200)
  const writes = h.getWrites()
  const noteIndex = writes.findIndex(q => q.payload?.event_type === 'note_added')
  const updateIndex = writes.findIndex(q => q.table === 'lead_intakes' && q.payload?.status === 'contacted')
  assert.ok(noteIndex >= 0 && updateIndex > noteIndex)
  const update = writes[updateIndex]
  const change = update.payload.payload.status_automation.last_change
  assert.equal(change.previous_status, 'new')
  assert.equal(change.next_status, 'contacted')
  assert.equal(change.evidence, 'Left a voicemail')
  assert.ok(change.note_event_id)
  for (const [key, value] of [['tenant_id', HEAD], ['id', 'lead'], ['status', 'new'], ['updated_at', '2026-10-06T00:00:00Z']]) {
    assert.ok(update.filters.some(([method, k, v]) => method === 'eq' && k === key && v === value))
  }
  assert.ok(writes.some(q => q.payload?.event_type === 'status_automated' && q.payload.payload.previous_status === 'new'))
})

test('booked notes advance Contacted and tours but do not create actual bookings', async () => {
  for (const intakeType of ['lesson_inquiry', 'tour_request', 'service_inquiry']) {
    const { h, patch } = setup({ status: 'contacted', intakeType })
    assert.equal((await patch({ add_note: 'Booked a lesson with Josh on Tuesday' })).status, 200)
    assert.ok(h.getWrites().some(q => q.table === 'lead_intakes' && q.payload?.status === 'booked'))
    assert.equal(h.getWrites().some(q => q.table === 'bookings'), false)
  }
})

test('manual status in same save wins and pauses future automation, even unchanged status', async () => {
  for (const status of ['new', 'contacted', 'won']) {
    const { h, patch } = setup()
    assert.equal((await patch({ status, add_note: 'Booked a lesson with Josh' })).status, 200)
    const updates = h.getWrites().filter(q => q.table === 'lead_intakes')
    assert.equal(updates.length, 1)
    assert.equal(updates[0].payload.status, status)
    assert.equal(updates[0].payload.payload.status_automation.paused, true)
  }
})

test('paused, protected, winback and ambiguous notes save without automated status writes', async () => {
  for (const options of [
    { payload: { status_automation: { paused: true } } }, { status: 'won' }, { status: 'processing' },
    { status: 'lost' }, { sourceForm: '2026-disenrollment-import' }, { payload: { winback: { status: 'to_contact' } } },
    { updatedAt: null },
  ]) {
    const { h, patch } = setup(options)
    assert.equal((await patch({ add_note: 'Booked a lesson with Josh' })).status, 200)
    assert.equal(h.getWrites().some(q => q.table === 'lead_intakes'), false)
    assert.ok(h.getWrites().some(q => q.payload?.event_type === 'note_added'))
  }
  const { h, patch } = setup()
  assert.equal((await patch({ add_note: 'Will leave a voicemail' })).status, 200)
  assert.equal(h.getWrites().some(q => q.table === 'lead_intakes'), false)
})

test('Resume and Pause persist without replaying existing notes', async () => {
  for (const action of ['resume', 'pause']) {
    const { h, patch } = setup({ payload: { message: 'Booked a lesson', status_automation: { paused: true } } })
    assert.equal((await patch({ status_automation_action: action })).status, 200)
    const update = h.getWrites().find(q => q.table === 'lead_intakes')
    assert.equal(update.payload.payload.status_automation.paused, action === 'pause')
    assert.equal(update.payload.status, undefined)
    assert.equal(update.payload.payload.message, 'Booked a lesson')
  }
})

const change = { id: 'change', previous_status: 'new', next_status: 'contacted', reason: 'Outreach', evidence: 'Left a voicemail', note_event_id: 'note', changed_at: '2026-10-06T00:00:00Z' }
test('Undo restores previous status, pauses automation, and clears stale undo controls', async () => {
  const { h, patch } = setup({ status: 'contacted', payload: { status_automation: { paused: false, last_change: change } } })
  assert.equal((await patch({ status_automation_action: 'undo', status_automation_change_id: change.id })).status, 200)
  const update = h.getWrites().find(q => q.table === 'lead_intakes')
  assert.equal(update.payload.status, 'new')
  assert.equal(update.payload.payload.status_automation.paused, true)
  assert.equal(update.payload.payload.status_automation.last_change, null)
})

test('stale undo, invalid actions, cross-tenant and unauthenticated requests make no writes', async () => {
  for (const [options, body, tenant, expected] of [
    [{ status: 'booked', payload: { status_automation: { last_change: change } } }, { status_automation_action: 'undo', status_automation_change_id: 'change' }, HEAD, 409],
    [{}, { status_automation_action: 'invalid' }, HEAD, 400],
    [{}, { status: 'new', status_automation_action: 'resume' }, HEAD, 400],
    [{}, { add_note: 'Left a voicemail' }, DEMO, 403],
    [{ extra: { actor: null } }, { add_note: 'Left a voicemail' }, HEAD, 401],
  ]) {
    const { h, patch } = setup(options)
    assert.equal((await patch(body, tenant)).status, expected)
    assert.equal(h.getWrites().length, 0)
  }
})

test('payload editing cannot forge automation metadata', async () => {
  const { h, patch } = setup({ payload: { status_automation: { paused: true } } })
  assert.equal((await patch({ payload: { status_automation: { paused: false }, source: 'meta' } })).status, 200)
  assert.equal(h.getWrites().find(q => q.table === 'lead_intakes').payload.payload.status_automation.paused, true)
})

test('automatic update failures do not throw back into successful note save', async () => {
  const { h, patch } = setup({ extra: { queryResult: q => q.table === 'lead_intakes' && q.operation === 'update'
    ? { data: null, error: { message: 'Synthetic automation failure' } } : null } })
  assert.equal((await patch({ add_note: 'Left a voicemail' })).status, 200)
  assert.ok(h.getWrites().some(q => q.payload?.event_type === 'note_added'))
  assert.equal(h.getWrites().some(q => q.payload?.event_type === 'status_automated'), false)
})

test('concurrent manual edits defeat automatic compare-and-swap without false history', async () => {
  const { h, patch } = setup({ extra: { queryResult: q => q.table === 'lead_intakes' && q.operation === 'update'
    ? { data: null, error: null } : null } })
  assert.equal((await patch({ add_note: 'Left a voicemail' })).status, 200)
  assert.equal(h.getWrites().some(q => q.payload?.event_type === 'status_automated'), false)
})

test('stale manual updates return conflict instead of overwriting a newer lead', async () => {
  const { h, patch } = setup({ extra: { queryResult: q => q.table === 'lead_intakes' && q.operation === 'update'
    ? { data: null, error: null } : null } })
  assert.equal((await patch({ status: 'booked' })).status, 409)
  assert.equal(h.getWrites().some(q => q.table === 'lead_events'), false)
})

test('same persisted note is idempotent and cannot reapply a status change', async () => {
  const { h } = setup({ payload: { status_automation: { last_change: { ...change, note_event_id: 'same-note' } } } })
  assert.equal(await h.load('lib/lead-status-automation-server.ts').applySavedNoteStatus({
    tenantId: HEAD, leadId: 'lead', noteId: 'same-note', note: 'Left a voicemail', actor: {},
  }), null)
  assert.equal(h.getWrites().length, 0)
})

test('shared lead labels consistently use Won and Enrolling', () => {
  const { formatLeadStatus } = createHarness().load('lib/lead-status.ts')
  assert.equal(formatLeadStatus('won'), 'Won')
  assert.equal(formatLeadStatus('processing'), 'Enrolling')
  const panel = fs.readFileSync(path.resolve(__dirname, '../../components/leads/LeadDetailPanel.tsx'), 'utf8')
  assert.equal(panel.includes("'Completed'"), false)
  const editor = fs.readFileSync(path.resolve(__dirname, '../../components/leads/LeadsView.tsx'), 'utf8')
  assert.match(editor, /leadEditForm.status !== selectedLead.status/)
})