/* eslint-disable @typescript-eslint/no-require-imports -- Offline TypeScript/React harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')
function load(file) {
  const exports = {}
  const requireLocal = name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: requireLocal })
  return exports
}
const domain = load(path.join(root, 'lib/academy-enrollment-drafts.ts'))
const enrollment = load(path.join(root, 'lib/academy-staff-enrollment.ts'))
const plain = value => JSON.parse(JSON.stringify(value))
const now = '2026-10-30T12:00:00.000Z'
const lead = { id: 'one', status: 'won', intake_type: 'lesson_inquiry', updated_at: now, program_label: 'Private · Guitar', contact: { full_name: 'Jamie Park', email: 'jamie@example.invalid', phone: '' }, payload: { student_name: 'Riley Park', student_preferences: { preferred_days: ['Tuesday'], preferred_times: ['evening'] }, siblings: [{ name: 'Morgan Park', instrument_interest: 'Voice', student_preferences: { preferred_days: ['Friday'] } }] } }

test('new drafts are blank, not reviewed, and have stable configurable step labels', () => {
  const record = domain.newEnrollmentDraft('draft', now)
  assert.equal(record.draft.contact, null)
  assert.equal(record.draft.lessons.length, 0)
  assert.equal(domain.enrollmentDraftName(record), 'Unnamed enrollment')
  assert.equal(domain.enrollmentDraftProgress(record).steps.length, enrollment.enrollmentSteps.length)
  assert.equal(domain.enrollmentDraftProgress(record).steps.some(step => step.complete), false)
})

test('won lesson/tour leads queue automatically, unrelated services and active leads do not', () => {
  assert.ok(domain.enrollmentDraftFromLead(lead))
  assert.ok(domain.enrollmentDraftFromLead({ ...lead, intake_type: 'tour_request' }))
  assert.equal(domain.enrollmentDraftFromLead({ ...lead, status: 'contacted' }), null)
  assert.equal(domain.enrollmentDraftFromLead({ ...lead, intake_type: 'service_inquiry' }), null)
})

test('lead adapter preserves per-student interests/preferences without choosing a teacher or booking', () => {
  const record = domain.enrollmentDraftFromLead(lead)
  assert.equal(record.sourceLeadId, lead.id)
  assert.equal(record.draft.contact.email, lead.contact.email)
  assert.equal(record.draft.student.firstName, 'Riley')
  assert.equal(record.draft.additionalStudents[0].firstName, 'Morgan')
  assert.deepEqual(plain(record.draft.lessons.map(item => item.instrument)), ['Guitar', 'Voice'])
  assert.equal(record.preferences[0].availability.preferredDays, 'Tuesday')
  assert.equal(record.preferences[1].availability.preferredDays, 'Friday')
  assert.ok(record.draft.lessons.every(item => !item.teacher && !item.start && !item.time && !item.day))
  assert.equal(record.opportunityValue, undefined, 'No illustrative opportunity default')
  assert.equal(record.draft.consent.termsAccepted, false)
})

test('ambiguous instruments remain unselected; self reuse requires explicit source flag', () => {
  const record = domain.enrollmentDraftFromLead({ ...lead, program_label: 'Piano, Guitar', payload: { student_name: 'Jamie Park' } })
  assert.equal(record.draft.lessons[0].instrument, '')
  assert.notEqual(record.draft.student.id, record.draft.contact.id)
  const self = domain.enrollmentDraftFromLead({ ...lead, payload: { same_as_contact: true, relationship_to_contact: 'self' } })
  assert.equal(self.draft.student.id, self.draft.contact.id)
  assert.equal(self.draft.contactIsStudent, true)
})

test('queue deduplicates repeated source rows and never replaces edited drafts', () => {
  const original = domain.enrollmentDraftFromLead(lead)
  original.draft.student.firstName = 'Edited'
  const rows = domain.mergeEnrollmentQueue([original], [lead, lead])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].draft.student.firstName, 'Edited')
  assert.equal(domain.mergeEnrollmentQueue([], [lead, lead]).length, 1)
})

test('completion requires review and valid preceding data, not the furthest visited screen', () => {
  const record = domain.newEnrollmentDraft('one', now)
  record.step = 4; record.reviewedSteps = [0, 1, 2, 3, 4]
  assert.equal(domain.enrollmentDraftProgress(record).current, 0)
  record.draft.contact = { ...enrollment.enrollmentPeople[0] }
  record.draft.student = record.draft.contact
  assert.equal(domain.enrollmentDraftProgress(record).steps[0].complete, true)
  assert.equal(domain.enrollmentDraftProgress(record).current, 1)
  record.draft.contact.email = ''; record.draft.contact.phone = ''
  assert.equal(domain.enrollmentDraftProgress(record).current, 0)
})

test('incomplete drafts round-trip without requiring step completion; storage is versioned and scoped', () => {
  const record = domain.newEnrollmentDraft('one', now)
  const key = domain.enrollmentDraftStorageKey('tenant:person')
  let raw = null
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value } }
  domain.writeEnrollmentDrafts(storage, key, null, [record])
  assert.deepEqual(plain(domain.readEnrollmentDrafts(raw)), plain([record]))
  assert.notEqual(key, domain.enrollmentDraftStorageKey('other:person'))
  assert.notEqual(key, domain.enrollmentDraftStorageKey('tenant:other'))
})

test('damaged storage and unknown versions fail rather than clearing previous work', () => {
  for (const raw of ['bad json', '{}', '{"version":2,"records":[]}', '{"version":1,"records":[{}]}']) assert.throws(() => domain.readEnrollmentDrafts(raw))
  const record = domain.newEnrollmentDraft('one', now)
  record.draft.lessons = [{}]
  assert.throws(() => domain.readEnrollmentDrafts(JSON.stringify({ version: 1, records: [record] })))
})

test('storage failure and stale-tab writes fail visibly without overwriting', () => {
  let changed = false
  const storage = { getItem: () => 'newer', setItem: () => { changed = true } }
  assert.throws(() => domain.writeEnrollmentDrafts(storage, 'key', 'older', []), /another tab/)
  assert.equal(changed, false)
  assert.throws(() => domain.writeEnrollmentDrafts({ getItem: () => null, setItem: () => { throw new Error('quota') } }, 'key', null, []), /quota/)
})

test('shared stepper exposes labels and current step without color alone', () => {
  const { ProgressStepper } = load(path.join(root, 'components/ui/ProgressStepper.tsx'))
  const steps = [{ id: 'a', label: 'Family', complete: true }, { id: 'b', label: 'Times', complete: false }]
  const html = renderToStaticMarkup(React.createElement(ProgressStepper, { steps, currentStep: 1, label: 'Enrollment' }))
  assert.match(html, /2 of 2 · Times/)
  assert.match(html, /aria-current="step"/)
  assert.match(html, /Family: complete/)
  assert.ok(!html.includes('>2 of 2 · Times<'), 'Progress descriptions are accessible, not explanatory text under the circles')
  assert.match(renderToStaticMarkup(React.createElement(ProgressStepper, { steps, currentStep: 0, label: 'Enrollment', notStarted: true })), /Not started/)
})

test('mock enrollments are varied incomplete drafts driven by real validation', () => {
  const { createEnrollmentHubFixtures } = load(path.join(root, 'lib/academy-enrollment-hub-fixtures.ts'))
  const records = createEnrollmentHubFixtures(now)
  assert.equal(records.length, 8)
  assert.equal(new Set(records.map(record => domain.enrollmentDraftProgress(record).current)).size, 5)
  assert.ok(records.every(record => !domain.enrollmentDraftProgress(record).steps.every(step => step.complete)))
  assert.equal(new Set(records.map(record => record.updatedAt)).size, records.length)
  assert.ok(records.some(record => record.draft.additionalStudents.length > 0))
  assert.ok(records.some(record => record.draft.student === null && record.draft.contact))
  assert.ok(records.some(record => record.opportunityValue === undefined))
  assert.ok(records.every(record => record.draft.payer !== 'other' && !record.draft.otherPayer))
  assert.deepEqual(plain(domain.readEnrollmentDrafts(JSON.stringify({ version: 1, records }))), plain(records))
})

test('legacy empty mock payer is repaired without changing explicit payer details or real drafts', () => {
  const { normalizeEnrollmentHubFixtures } = load(path.join(root, 'lib/academy-enrollment-hub-fixtures.ts'))
  const record = domain.newEnrollmentDraft('mock:brooks', now)
  record.draft.payer = 'other'
  record.draft.otherPayer = { name: '', email: '', phone: '' }
  assert.equal(normalizeEnrollmentHubFixtures([record])[0].draft.payer, 'student')
  assert.equal(record.draft.payer, 'other', 'Source is not mutated')
  assert.equal(normalizeEnrollmentHubFixtures([{ ...record, id: 'real' }])[0].draft.payer, 'other')
  record.draft.otherPayer.name = 'Explicit payer'
  assert.equal(normalizeEnrollmentHubFixtures([record])[0].draft.payer, 'other')
})