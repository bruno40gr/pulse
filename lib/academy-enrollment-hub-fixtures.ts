import { newEnrollmentDraft, type EnrollmentDraftRecord } from './academy-enrollment-drafts'
import { newLesson, type EnrollmentPerson } from './academy-staff-enrollment'
import { selectScheduleSlot, sampleWeek, shiftDate } from './academy-enrollment-schedule'

/** Fictional design-review data only; never seeded into the live lead queue. */
export function createEnrollmentHubFixtures(now = new Date().toISOString()): EnrollmentDraftRecord[] {
  const person = (id: string, firstName: string, lastName: string, email = ''): EnrollmentPerson => ({ id: `mock:${id}`, firstName, lastName, email, phone: '', activeTeacher: false })
  const definitions = [
    { id: 'chen', first: 'Mia', last: 'Chen', instrument: 'Piano', stage: 2, hours: 1, value: 200 },
    { id: 'rivera', first: 'Lucas', last: 'Rivera', instrument: 'Guitar', stage: 0, hours: 3 },
    { id: 'brooks', first: 'Ava', last: 'Brooks', instrument: 'Voice', stage: 4, hours: 5, value: 320 },
    { id: 'patel', first: 'Arjun', last: 'Patel', instrument: 'Violin', stage: 1, hours: 8 },
    { id: 'williams', first: 'Theo', last: 'Williams', instrument: 'Drums', stage: 3, hours: 22, value: 200 },
    { id: 'kim', first: 'Sophie', last: 'Kim', instrument: 'Piano', stage: 2, hours: 27 },
    { id: 'morgan', first: 'Alex', last: 'Morgan', instrument: '', stage: 0, hours: 48 },
    { id: 'reed', first: 'Isla', last: 'Reed', instrument: 'Guitar', stage: 1, hours: 72, value: 200 },
  ]
  return definitions.map(item => {
    const updated = new Date(Date.parse(now) - item.hours * 3600000).toISOString()
    const record = newEnrollmentDraft(`mock:${item.id}`, updated)
    const student = person(item.id, item.first, item.last)
    const contact = person(`${item.id}:contact`, item.id === 'morgan' ? 'Alex' : 'Sam', item.last, `${item.id}@example.invalid`)
    record.started = item.id !== 'rivera'
    record.step = item.stage
    record.reviewedSteps = Array.from({ length: item.stage }, (_, index) => index)
    record.sourceLeadId = item.id === 'rivera' || item.id === 'chen' ? `mock:lead:${item.id}` : undefined
    record.opportunityValue = item.value
    record.draft = { ...record.draft, contact, student: item.id === 'morgan' ? null : student, contactIsStudent: false, manager: contact, payer: 'manager', payment: 'later', studentRelationships: { [student.id]: 'Child' }, lessons: item.instrument ? [{ ...newLesson(`mock:${item.id}:lesson`), studentId: student.id, instrument: item.instrument, day: '', duration: item.id === 'brooks' ? '60' : '30' }] : [] }
    if (item.stage >= 3) {
      record.draft.lessons[0] = selectScheduleSlot(record.draft.lessons[0], shiftDate(sampleWeek, 1), '16:00', 'Robin Ellis')
    }
    if (item.stage >= 4) record.draft.consent.termsAccepted = true
    if (item.id === 'kim') {
      const sibling = person('kim:sibling', 'Ethan', 'Kim')
      record.draft.additionalStudents = [sibling]
      record.draft.studentRelationships[sibling.id] = 'Child'
      record.draft.lessons.push({ ...newLesson('mock:kim:sibling:lesson'), studentId: sibling.id, instrument: 'Guitar', day: '' })
      // One sibling has a proposal; the other still needs a time.
      record.draft.lessons[0] = selectScheduleSlot(record.draft.lessons[0], shiftDate(sampleWeek, 1), '16:00', 'Jordan Vale')
    }
    if (item.id === 'patel') record.draft.lessons[0].instrument = ''
    return record
  })
}

/** Repair the old empty mock payer only; never change real or populated drafts. */
export function normalizeEnrollmentHubFixtures(records: EnrollmentDraftRecord[]) {
  return records.map(record => {
    const other = record.draft.otherPayer
    if (record.id !== 'mock:brooks' || record.draft.payer !== 'other' || !other || other.name || other.email || other.phone) return record
    return { ...record, draft: { ...record.draft, payer: record.draft.manager ? 'manager' as const : 'student' as const, otherPayer: null } }
  })
}