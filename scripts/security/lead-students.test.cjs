/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic TypeScript VM harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(name) {
  const exports = {}
  const source = fs.readFileSync(path.join(root, 'lib', `${name}.ts`), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: id => load(id.replace('./', '')),
  })
  return exports
}
const { readLeadStudents, leadStudentsPatch, canUseContactAsStudent, studentFromContact, syncStudentContact, syncStudentAvailability } = load('lead-students')
const plain = value => JSON.parse(JSON.stringify(value))
test('single explicit self inquiry uses the contact row without hiding other students or inferring identity', () => {
  const { leadStudentDetailRows } = load('lead-students')
  const payload = { student_name: 'Alex', same_as_contact: true, relationship_to_contact: 'self' }
  assert.equal(leadStudentDetailRows(payload, 'Private · Piano').length, 0)
  assert.equal(readLeadStudents(payload, 'Private · Piano').length, 1)
  assert.equal(leadStudentDetailRows({ student_name: 'Alex' }, 'Piano').length, 1)
  assert.equal(leadStudentDetailRows({ ...payload, siblings: [{ name: 'Riley' }] }, 'Piano').length, 2)
  assert.equal(leadStudentDetailRows({ student_name: 'Riley', relationship_to_contact: 'guardian' }, 'Piano').length, 1)
})
const { matchesLeadInquirySearch } = load('lead-inquiry-search')
test('private and semi-private offer identical instruments; programs round-trip without upgrading legacy values', () => {
  const { LESSON_PROGRAM_GROUPS } = load('lead-lesson-details')
  assert.deepEqual(plain(LESSON_PROGRAM_GROUPS[0].options.map(value => value.replace('Private · ', ''))), plain(LESSON_PROGRAM_GROUPS[1].options.map(value => value.replace('Semi-private · ', ''))))
  assert.deepEqual(plain(LESSON_PROGRAM_GROUPS[2].options), ['Tiny Keys', 'Little Rockers', 'Band'])
  const students = readLeadStudents({ student_name: 'Alex', siblings: [{ name: 'Riley', instrument_interest: 'Semi-private · Guitar, Band' }] }, 'Private · Piano, Tiny Keys')
  const patch = leadStudentsPatch(students)
  assert.equal(patch.program_label, 'Private · Piano, Tiny Keys')
  assert.equal(patch.payload.siblings[0].instrument_interest, 'Semi-private · Guitar, Band')
  assert.equal(readLeadStudents({ student_name: 'Legacy' }, 'Piano')[0].instrument_interest, 'Piano')
})
test('contact and learner search retains inquiry boundaries without inferring links', () => {
  const lead = { contact: { full_name: 'Jamie Example', email: 'jamie@example.invalid', phone: '+15555550100' }, payload: { student_name: 'Riley', siblings: [{ name: 'Morgan' }] } }
  assert.equal(matchesLeadInquirySearch(lead, '  MORGAN  '), true)
  assert.equal(matchesLeadInquirySearch(lead, 'Riley Jamie'), true)
  assert.equal(matchesLeadInquirySearch(lead, 'jamie@example.invalid'), true)
  assert.equal(matchesLeadInquirySearch(lead, '555550100'), true)
  assert.equal(matchesLeadInquirySearch(lead, 'Other Family'), false)
  assert.equal(matchesLeadInquirySearch({}, 'Jamie'), false)
  assert.equal(matchesLeadInquirySearch({}, '  '), true)
  assert.equal('contact_id' in lead.payload.siblings[0], false)
})
const student = value => ({ date_of_birth: '', relationship_to_contact: '', email: '', phone: '', ...value })
test('explicit contact-as-student action reuses details without replacing another learner', () => {
  const contact = { name: 'Jamie Example', email: 'jamie@example.invalid', phone: '+15555550100' }
  const blank = student({ name: '', age: '', instrument_interest: 'Piano', date_of_birth: '1990-03-04' })
  const result = studentFromContact(blank, contact)
  assert.equal(result.name, contact.name)
  assert.equal(result.email, contact.email)
  assert.equal(result.phone, contact.phone)
  assert.equal(result.relationship_to_contact, 'self')
  assert.equal(result.instrument_interest, 'Piano')
  assert.equal(result.date_of_birth, '1990-03-04')
  assert.equal(blank.name, '')
  assert.equal(canUseContactAsStudent({ ...blank, name: 'Riley Example' }, contact), false)
  assert.equal(canUseContactAsStudent({ ...blank, email: 'other@example.invalid' }, contact), false)
  assert.throws(() => studentFromContact({ ...blank, name: 'Riley Example' }, contact), /differ/)
  assert.equal(canUseContactAsStudent(blank, { ...contact, name: '' }), false)
})
test('website primary fields and siblings form one list, never borrowing contact identity', () => {
  const students = readLeadStudents({ parent_name: 'Jamie', student_name: 'Riley', student_age: 8, siblings: [{ name: 'Morgan', age: 6, instrument_interest: 'Voice' }] }, 'Piano')
  assert.deepEqual(plain(students), [student({ name: 'Riley', age: '8', instrument_interest: 'Piano' }), student({ name: 'Morgan', age: '6', instrument_interest: 'Voice' })])
  assert.equal(readLeadStudents({ parent_name: 'Jamie' }, null)[0].name, '')
})
test('missing primary fields remain empty even when siblings exist', () => {
  const students = readLeadStudents({ age: null, student_age: 9, siblings: [{ name: 'Morgan' }] }, null)
  assert.equal(students[0].age, '')
  assert.equal(students[0].name, '')
  assert.equal(students[1].name, 'Morgan')
})
test('saving uses legacy fields and preserves sibling metadata without identity or status writes', () => {
  const payload = { student_name: 'Riley', age: 8, siblings: [{ name: 'Morgan', age: 6, instrument_interest: 'Voice', legacy_reference: 'unverified' }], message: 'Keep me' }
  const before = JSON.stringify(payload)
  const students = readLeadStudents(payload, 'Piano')
  students[1].instrument_interest = 'Guitar'
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.siblings[0].legacy_reference, 'unverified')
  assert.equal(patch.payload.siblings[0].instrument_interest, 'Guitar')
  assert.equal(patch.payload.student_name, 'Riley')
  assert.equal(patch.payload.sibling_count, 1)
  assert.equal(patch.payload.family_members_interested, 2)
  assert.equal(JSON.stringify(payload), before)
  assert.deepEqual(Object.keys(patch).sort(), ['payload', 'program_label'])
  assert.equal('status' in patch.payload, false)
  assert.equal('email' in patch.payload, false)
})
test('clearing instrument does not resurrect a legacy alias', () => {
  const patch = leadStudentsPatch([student({ name: 'Riley', age: '', instrument_interest: '' })], { instrument: 'Piano' })
  assert.equal(readLeadStudents({ instrument: 'Piano', ...patch.payload }, patch.program_label)[0].instrument_interest, '')
})
test('reported count is retained when website did not provide all student details', () => {
  const patch = leadStudentsPatch(readLeadStudents({ student_name: 'Riley' }, 'Piano'), { family_members_interested: 3 })
  assert.equal(patch.payload.family_members_interested, 3)
})
test('clearing an existing sibling row does not silently delete legacy metadata', () => {
  const payload = { siblings: [{ name: 'Morgan', legacy_reference: 'unverified' }] }
  const students = readLeadStudents(payload, null)
  students[1] = student({ name: '', age: '', instrument_interest: '' })
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.siblings[0].name, 'Morgan')
  assert.equal(patch.payload.siblings[0].legacy_reference, 'unverified')
})
test('manual students round-trip through the same website adapter', () => {
  const students = [student({ name: 'Riley', age: '8', instrument_interest: 'Piano' }), student({ name: 'Morgan', age: '6', instrument_interest: 'Voice' })]
  const patch = leadStudentsPatch(students)
  assert.deepEqual(plain(readLeadStudents(patch.payload, patch.program_label)), students)
})

test('birthdays calculate age without manufacturing dates from legacy ages', () => {
  const { birthdayAge, validBirthday } = load('lead-birthday')
  assert.equal(birthdayAge('2018-10-29', '2026-10-28'), 7)
  assert.equal(birthdayAge('2018-10-28', '2026-10-28'), 8)
  assert.equal(validBirthday('2025-02-29'), false)
  assert.equal(validBirthday('2028-01-01', '2026-10-28'), false)
  const students = readLeadStudents({ age: 8, siblings: [{ name: 'Morgan', age: 6 }] }, null)
  assert.equal(students[0].date_of_birth, '')
  assert.equal(students[1].date_of_birth, '')
  students[0].date_of_birth = '2018-04-12'
  const patch = leadStudentsPatch(students)
  assert.equal(patch.payload.age, '8')
  assert.equal(patch.payload.date_of_birth, '2018-04-12')
  assert.equal(patch.payload.siblings[0].age, '6')
})

test('unknown relationships and birthday-only siblings survive editing in place', () => {
  const payload = { birth_date: '2018-04-12', relationship_to_contact: 'aunt', siblings: [{ date_of_birth: '2020-07-19', relationship_to_contact: 'carer', reference: 'preserve' }] }
  const students = readLeadStudents(payload, null)
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.relationship_to_contact, 'aunt')
  assert.equal(patch.payload.siblings[0].relationship_to_contact, 'carer')
  assert.equal(patch.payload.siblings[0].date_of_birth, '2020-07-19')
  assert.equal(patch.payload.siblings[0].reference, 'preserve')
  students[0].date_of_birth = ''
  const cleared = leadStudentsPatch(students, payload)
  assert.equal(readLeadStudents({ ...payload, ...cleared.payload }, null)[0].date_of_birth, '')
  students[0].date_of_birth = '2025-02-30'
  assert.throws(() => leadStudentsPatch(students, payload), /valid birthday/)
})

test('Win-back review never borrows imported contact identity for students or merges duplicates', () => {
  const { reviewWinbackHierarchy } = load('winback-hierarchy')
  const lead = { source_form: '2026-disenrollment-import', contact: { full_name: 'Imported Student Label' }, payload: { winback: { source_key: 'unverified legacy name' } } }
  const before = JSON.stringify(lead)
  const review = reviewWinbackHierarchy(lead)
  assert.equal(review.needsContactReview, true)
  assert.equal(review.recordedStudentName, '')
  assert.equal(readLeadStudents(lead.payload, null)[0].name, '')
  assert.equal(JSON.stringify(lead), before)
  const payload = { student_name: 'Riley Example', parent_name: 'Jamie Example', siblings: [{ name: 'Riley Example', source_reference: 'keep' }] }
  assert.equal(reviewWinbackHierarchy({ ...lead, payload }).duplicateStudentRows, true)
  assert.equal(payload.siblings.length, 1)
  assert.equal(reviewWinbackHierarchy({ ...lead, source_form: 'website' }), null)
})

test('invalid birthdays are rejected before lead and contact writes', async () => {
  const { createHarness, HEAD } = require('./synthetic-harness.cjs')
  const h = createHarness()
  h.setScenario({ actor: { personId: 'staff', instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } }, fixtures: { tenants: [{ id: HEAD, name: 'Synthetic school', is_demo: true }], lead_intakes: [{ id: 'lead', tenant_id: HEAD, contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'new', payload: {} }] } })
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/lead', { method: 'PATCH', body: JSON.stringify({ full_name: 'Must not change', payload: { siblings: [{ date_of_birth: '2025-02-30' }] } }) }), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('invalid intake birthday is rejected before capture or contact creation', async () => {
  const { createHarness, HEAD } = require('./synthetic-harness.cjs')
  const h = createHarness(); h.setScenario({})
  const response = await h.load('app/api/intake/route.ts').POST(new Request('https://synthetic.invalid/api/intake', { method: 'POST', body: JSON.stringify({ tenant_id: HEAD, intake_type: 'lesson_inquiry', source_form: 'synthetic', full_name: 'Jamie Example', email: 'jamie@example.invalid', payload: { date_of_birth: '2025-02-30' } }) }))
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('learner-owned details round-trip without borrowing inquiry or account-holder destinations', () => {
  const payload = { email: 'parent@example.invalid', phone: '+15555550100', account_holder_email: 'holder@example.invalid', student_name: 'Alex', relationship_to_contact: 'self', student_email: 'alex@example.invalid', student_phone: '+15555550101', siblings: [{ name: 'Riley', email: 'riley@example.invalid', phone: '+15555550102', source_reference: 'keep' }, { name: 'Morgan' }] }
  const students = readLeadStudents(payload, 'Guitar')
  assert.equal(students[0].email, 'alex@example.invalid')
  assert.equal(students[1].phone, '+15555550102')
  assert.equal(students[2].email, '')
  assert.equal(students[2].phone, '')
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.student_email, 'alex@example.invalid')
  assert.equal(patch.payload.siblings[0].email, 'riley@example.invalid')
  assert.equal(patch.payload.siblings[0].source_reference, 'keep')
  assert.equal('email' in patch, false)
  assert.equal('phone' in patch, false)
  assert.equal('contact_id' in patch, false)
  students[0].email = ''
  students[1].phone = ''
  const cleared = leadStudentsPatch(students, payload)
  assert.equal(readLeadStudents({ ...payload, ...cleared.payload }, 'Guitar')[0].email, '')
  assert.equal(cleared.payload.siblings[0].phone, null)
  assert.equal(payload.email, 'parent@example.invalid')
})

test('contact-only learner rows preserve in-place metadata and are not discarded', () => {
  const payload = { siblings: [{ email: 'learner@example.invalid', reference: 'preserve' }, { phone: '+15555550103', reference: 'also-preserve' }] }
  const students = readLeadStudents(payload, null)
  assert.equal(students.length, 3)
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.siblings.length, 2)
  assert.equal(patch.payload.siblings[0].reference, 'preserve')
  assert.equal(patch.payload.siblings[1].phone, '+15555550103')
  assert.equal(readLeadStudents({ email: 'parent@example.invalid', phone: '+15555550100', relationship_to_contact: 'self' }, null)[0].email, '')
})

test('student preferences remain independent and legacy shared values are never assigned automatically', () => {
  const payload = { experience: 'Legacy shared', preferred_days: ['Friday'], student_name: 'Alex', student_preferences: { experience: 'Returning', preferred_days: ['Monday'], preferred_times: ['Mornings'], preferred_date: '2026-11-02', time_window: '9am', source_note: 'keep-primary' }, siblings: [{ name: 'Riley', student_preferences: { experience: 'Beginner', preferred_days: ['Wednesday'], time_window: '4pm', source_note: 'keep-sibling' } }, { name: 'Morgan' }] }
  const students = readLeadStudents(payload, 'Piano')
  assert.equal(students[0].preferences.preferredDays, 'Monday')
  assert.equal(students[1].preferences.preferredDays, 'Wednesday')
  assert.equal(students[2].preferences, undefined)
  const patch = leadStudentsPatch(students, payload)
  assert.equal(patch.payload.student_preferences.source_note, 'keep-primary')
  assert.equal(patch.payload.siblings[0].student_preferences.source_note, 'keep-sibling')
  assert.equal(patch.payload.student_preferences.preferred_date, '2026-11-02')
  assert.equal('experience' in patch.payload, false)
  assert.equal('preferred_days' in patch.payload, false)
  students[0].preferences.preferredDays = ''
  const cleared = leadStudentsPatch(students, payload)
  assert.equal(readLeadStudents({ ...payload, ...cleared.payload }, 'Piano')[0].preferences.preferredDays, '')
  assert.equal(readLeadStudents({ experience: 'Legacy only', preferred_days: ['Friday'] }, null)[0].preferences, undefined)
})

test('only explicit same-as-contact opt-in follows draft edits; adult flag preserves existing birthday', () => {
  const original = { name: 'Alex', email: 'alex@example.invalid', phone: '' }
  const blank = student({ name: '', age: '', instrument_interest: 'Piano', date_of_birth: '1990-01-01', adult: true })
  const linked = studentFromContact(blank, original)
  const independent = { ...linked, same_as_contact: false, name: 'Riley' }
  const synced = syncStudentContact([linked, independent], { ...original, name: 'Alex Updated', email: 'updated@example.invalid' })
  assert.equal(synced[0].name, 'Alex Updated')
  assert.equal(synced[0].email, 'updated@example.invalid')
  assert.equal(synced[1].name, 'Riley')
  assert.equal(synced[1].email, 'alex@example.invalid')
  const patch = leadStudentsPatch(synced)
  assert.equal(patch.payload.adult_student, true)
  assert.equal(patch.payload.date_of_birth, '1990-01-01')
  assert.equal(readLeadStudents(patch.payload, 'Piano')[0].same_as_contact, true)
  assert.equal(readLeadStudents(patch.payload, 'Piano')[0].adult, true)
})

test('shared availability follows Student 1 without sharing experience or hidden legacy time windows', () => {
  const first = student({ name: 'Alex', age: '', instrument_interest: 'Piano', preferences: { experience: 'Returning', preferredDays: 'Monday', preferredTimes: 'morning', preferredDate: '2026-11-02', timeWindow: 'old primary' } })
  const second = student({ name: 'Riley', age: '', instrument_interest: 'Voice', same_availability: true, preferences: { experience: 'Beginner', preferredDays: '', preferredTimes: '', preferredDate: '', timeWindow: 'old learner' } })
  const third = { ...second, name: 'Morgan', same_availability: false }
  const synced = syncStudentAvailability([first, second, third])
  assert.equal(synced[1].preferences.preferredDays, 'Monday')
  assert.equal(synced[1].preferences.preferredTimes, 'morning')
  assert.equal(synced[1].preferences.preferredDate, '2026-11-02')
  assert.equal(synced[1].preferences.experience, 'Beginner')
  assert.equal(synced[1].preferences.timeWindow, 'old learner')
  assert.equal(synced[2].preferences.preferredDays, '')
  assert.equal(second.preferences.preferredDays, '')
  const patch = leadStudentsPatch([first, second, third])
  assert.equal(patch.payload.siblings[0].same_availability, true)
  assert.deepEqual(plain(patch.payload.siblings[0].student_preferences.preferred_times), ['morning'])
  assert.equal(readLeadStudents(patch.payload, 'Piano')[1].same_availability, true)
  const detached = { ...synced[1], same_availability: false }
  first.preferences.preferredDays = 'Tuesday'
  assert.equal(syncStudentAvailability([first, detached])[1].preferences.preferredDays, 'Monday')
})

test('multiple programs and weekdays round-trip using compatibility fields', () => {
  const students = readLeadStudents({ student_name: 'Alex', student_preferences: { preferred_days: ['Monday', 'Sunday'] }, siblings: [{ name: 'Riley', instrument_interest: 'Voice, Guitar', student_preferences: { preferred_days: ['Tuesday', 'Saturday'], legacy: 'keep' } }] }, 'Piano, Violin')
  const patch = leadStudentsPatch(students)
  assert.equal(patch.program_label, 'Piano, Violin')
  assert.equal(patch.payload.instrument, 'Piano, Violin')
  assert.equal(patch.payload.siblings[0].instrument_interest, 'Voice, Guitar')
  assert.deepEqual(plain(patch.payload.student_preferences.preferred_days), ['Monday', 'Sunday'])
  assert.deepEqual(plain(patch.payload.siblings[0].student_preferences.preferred_days), ['Tuesday', 'Saturday'])
  const restored = readLeadStudents(patch.payload, patch.program_label)
  assert.equal(restored[0].instrument_interest, 'Piano, Violin')
  assert.equal(restored[1].preferences.preferredDays, 'Tuesday, Saturday')
})
