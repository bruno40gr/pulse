const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

test('tour detail stays in the lesson tab; unrelated tabs still dismiss it', () => {
  const { leadBelongsToTab } = createHarness().load('lib/lead-lesson-details.ts')
  assert.equal(leadBelongsToTab({ intake_type: 'tour_request' }, 'lesson_inquiry'), true)
  assert.equal(leadBelongsToTab({ intake_type: 'lesson_inquiry' }, 'lesson_inquiry'), true)
  assert.equal(leadBelongsToTab({ intake_type: 'tour_request' }, 'service_inquiry'), false)
  assert.equal(leadBelongsToTab({ intake_type: 'service_inquiry' }, 'lesson_inquiry'), false)
  assert.equal(leadBelongsToTab({ intake_type: 'job_application' }, 'job_application'), true)
  assert.equal(leadBelongsToTab({ intake_type: 'lesson_inquiry', category: 'winback' }, 'winback'), true)
  assert.equal(leadBelongsToTab({ intake_type: 'lesson_inquiry', source_form: '2026-disenrollment-import' }, 'winback'), true)
  assert.equal(leadBelongsToTab({ intake_type: 'tour_request' }, 'winback'), false)
})

test('detail auto-dismiss uses shared tab membership rather than exact intake type', () => {
  const fs = process.getBuiltinModule('fs')
  const path = process.getBuiltinModule('path')
  const source = fs.readFileSync(path.resolve(__dirname, '../../components/leads/LeadsView.tsx'), 'utf8')
  assert.ok(source.includes('selectedLead && !leadBelongsToTab(selectedLead, activeTab)'))
  assert.ok(!source.includes('selectedLead.intake_type !== activeTab'))
})

test('program choices include both early-childhood programs', () => {
  const details = createHarness().load('lib/lead-lesson-details.ts')
  assert.ok(details.LESSON_PROGRAM_OPTIONS.includes('Little Rockers'))
  assert.ok(details.LESSON_PROGRAM_OPTIONS.includes('Tiny Keys'))
})

test('website tour and lesson fields round-trip through manual editing', () => {
  const details = createHarness().load('lib/lead-lesson-details.ts')
  const payload = {
    student_name: 'Synthetic Student', age: 3, experience_level: 'Beginner',
    preferred_days: ['Monday', 'Wednesday'], preferred_times: ['After school'],
    preferred_date: '2026-10-13', time_window: 'Evening (4pm to 8pm)',
  }
  const fields = details.readLessonRequestFields(payload)
  assert.equal(fields.studentAge, '3')
  assert.equal(fields.experience, 'Beginner')
  assert.equal(fields.preferredDays, 'Monday, Wednesday')
  const saved = details.lessonRequestPayload(fields)
  assert.equal(saved.preferred_date, payload.preferred_date)
  assert.equal(saved.time_window, payload.time_window)
  assert.equal(JSON.stringify(saved.preferred_days), JSON.stringify(payload.preferred_days))
  assert.equal(JSON.stringify(details.readLessonRequestFields(saved)), JSON.stringify(fields))
})

function scenario() {
  return {
    actor: { personId: 'staff', instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, name: 'Synthetic school', is_demo: true }],
      lead_intakes: [{ id: 'tour', tenant_id: HEAD, contact_id: 'contact', intake_type: 'tour_request', status: 'new', source_form: 'booking_interstitial', payload: { message: 'Original note', preferred_date: '2026-10-13', time_window: 'Evening' }, created_at: '2026-10-01T00:00:00Z' }],
    },
  }
}

test('clearing a website field does not revive its old alias', () => {
  const details = createHarness().load('lib/lead-lesson-details.ts')
  const fields = details.readLessonRequestFields({ experience: null, experience_level: 'Beginner', age: null, student_age: 3, preferred_days: [], days_available: ['Monday'] })
  assert.equal(fields.experience, '')
  assert.equal(fields.studentAge, '')
  assert.equal(fields.preferredDays, '')
})

test('lesson list and count queries include existing tours with tenant scoping', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/leads/route.ts').GET(
    new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=lesson_inquiry&include_counts=1`),
  )
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(result.leads.some(lead => lead.id === 'tour' && lead.intake_type === 'tour_request'))
  assert.equal(result.counts.lesson_inquiry, 1)
  const queries = h.getQueries().filter(q => q.table === 'lead_intakes' && q.filters.some(f => f[0] === 'in' && f[1] === 'intake_type'))
  assert.ok(queries.length >= 2)
  for (const q of queries) {
    assert.ok(q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD))
    assert.ok(q.filters.some(f => f[0] === 'in' && f[1] === 'intake_type' && f[2].includes('tour_request')))
  }
  assert.equal(h.getWrites().length, 0)
})

test('existing tour detail surfaces Tour request note without a database write', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/leads/[id]/route.ts').GET(
    new Request('https://synthetic.invalid/api/leads/tour?intake_type=lesson_inquiry'),
    { params: Promise.resolve({ id: 'tour' }) },
  )
  assert.equal(response.status, 200)
  const lead = await response.json()
  assert.ok(lead.notes_history.some(note => note.text === 'Tour request'))
  assert.ok(lead.notes_history.some(note => note.text === 'Original note'))
  assert.equal(lead.payload.time_window, 'Evening')
  assert.equal(h.getWrites().length, 0)
})

test('tour status obeys normal lead validation before writes', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(
    new Request('https://synthetic.invalid/api/leads/tour', { method: 'PATCH', body: JSON.stringify({ status: 'invented' }) }),
    { params: Promise.resolve({ id: 'tour' }) },
  )
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('tour edits preserve original note and untouched scheduling fields', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(
    new Request('https://synthetic.invalid/api/leads/tour', { method: 'PATCH', body: JSON.stringify({ payload: { preferred_days: ['Friday'] } }) }),
    { params: Promise.resolve({ id: 'tour' }) },
  )
  assert.equal(response.status, 200)
  const update = h.getWrites().find(q => q.table === 'lead_intakes' && q.operation === 'update')
  assert.equal(update.payload.payload.message, 'Original note')
  assert.equal(update.payload.payload.time_window, 'Evening')
  assert.equal(JSON.stringify(update.payload.payload.preferred_days), '["Friday"]')
})

test('tour contributes the same opportunity value as a lesson inquiry', () => {
  const { getLeadOpportunityValue } = createHarness().load('lib/lead-value.ts')
  assert.equal(getLeadOpportunityValue({ intakeType: 'tour_request', payload: {} }), getLeadOpportunityValue({ intakeType: 'lesson_inquiry', payload: {} }))
})