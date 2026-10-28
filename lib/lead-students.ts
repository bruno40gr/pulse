import { normalizeFamilyMembers, type LeadFamilyMember } from './lead-family'
import { readLessonRequestFields } from './lead-lesson-details'
import { validBirthday } from './lead-birthday'

export type StudentPreferences = { experience: string; preferredDays: string; preferredTimes: string; preferredDate: string; timeWindow: string }
export type LeadStudent = LeadFamilyMember & { date_of_birth: string; relationship_to_contact: string; email: string; phone: string; adult?: boolean; same_as_contact?: boolean; same_availability?: boolean; preferences?: StudentPreferences }
export const emptyStudentPreferences = (): StudentPreferences => ({ experience: '', preferredDays: '', preferredTimes: '', preferredDate: '', timeWindow: '' })
// Share scheduling only. Experience and hidden legacy time windows stay learner-owned.
export function syncStudentAvailability(students: LeadStudent[]): LeadStudent[] {
  const first = students[0]?.preferences || emptyStudentPreferences()
  return students.map((student, index) => index > 0 && student.same_availability ? { ...student, preferences: { ...emptyStudentPreferences(), ...student.preferences, preferredDays: first.preferredDays, preferredTimes: first.preferredTimes, preferredDate: first.preferredDate } } : student)
}
const readPreferences = (value: unknown): StudentPreferences => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStudentPreferences()
  const fields = readLessonRequestFields(value as Record<string, unknown>)
  return { experience: fields.experience, preferredDays: fields.preferredDays, preferredTimes: fields.preferredTimes, preferredDate: fields.preferredDate, timeWindow: fields.timeWindow }
}
const preferencePatch = (value?: StudentPreferences) => {
  const fields = value || emptyStudentPreferences()
  const list = (text: string) => text.split(',').map(item => item.trim()).filter(Boolean)
  return { experience: fields.experience.trim() || null, preferred_days: list(fields.preferredDays), preferred_times: list(fields.preferredTimes), preferred_date: fields.preferredDate || null, time_window: fields.timeWindow.trim() || null }
}
const text = (value: unknown) => typeof value === 'string' ? value : ''
export type InquiryStudentContact = { name: string; email: string; phone: string }

// Explicit staff action only; do not replace an already populated learner identity.
export function canUseContactAsStudent(student: LeadStudent, contact: InquiryStudentContact) {
  return Boolean(contact.name.trim()) && (['name', 'email', 'phone'] as const).every(key => !student[key].trim() || student[key].trim() === contact[key].trim())
}

export function studentFromContact(student: LeadStudent, contact: InquiryStudentContact): LeadStudent {
  if (!canUseContactAsStudent(student, contact)) throw new Error('Existing student details differ from the contact.')
  return { ...student, name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(), relationship_to_contact: 'self', same_as_contact: true }
}
// Only an explicit checkbox opt-in follows subsequent edits to the draft contact.
export function syncStudentContact(students: LeadStudent[], contact: InquiryStudentContact): LeadStudent[] {
  return students.map(student => student.same_as_contact ? { ...student, name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(), relationship_to_contact: 'self' } : student)
}
const extras = (value: Record<string, unknown>, primary = false) => ({
  date_of_birth: text(Object.prototype.hasOwnProperty.call(value, 'date_of_birth') ? value.date_of_birth : value.birth_date),
  relationship_to_contact: text(value.relationship_to_contact),
  email: text(value[primary ? 'student_email' : 'email']),
  phone: text(value[primary ? 'student_phone' : 'phone']),
  ...(value.adult_student === true ? { adult: true } : {}),
  ...(value.same_as_contact === true ? { same_as_contact: true } : {}),
  ...(value.same_availability === true ? { same_availability: true } : {}),
  ...(value.student_preferences && typeof value.student_preferences === 'object' ? { preferences: readPreferences(value.student_preferences) } : {}),
})

// Presentation adapter only: array position is not a person or opportunity ID.
export function readLeadStudents(payload: Record<string, unknown>, programLabel: string | null): LeadStudent[] {
  const fields = readLessonRequestFields(payload)
  return [{
    name: fields.studentName,
    age: fields.studentAge,
    instrument_interest: programLabel || (typeof payload.instrument === 'string' ? payload.instrument : ''),
    ...extras(payload, true),
  }, ...(Array.isArray(payload.siblings) ? payload.siblings.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return []
    const member = normalizeFamilyMembers([entry])[0]
    const extra = extras(entry)
    return member || Object.values(extra).some(Boolean) ? [{ ...(member || { name: '', age: '', instrument_interest: '' }), ...extra }] : []
  }) : [])]
}

// A display-only shortcut for an explicit self inquiry, never a name match.
export function leadStudentDetailRows(payload: Record<string, unknown>, programLabel: string | null): LeadStudent[] {
  const students = readLeadStudents(payload, programLabel)
  if (students.length === 1 && students[0].same_as_contact === true) return []
  return students.filter(student => student.name || student.date_of_birth || student.email || student.phone || student.relationship_to_contact)
}

export function leadStudentsPatch(students: LeadStudent[], savedPayload: Record<string, unknown> = {}) {
  students = syncStudentAvailability(students)
  if (students.some(student => student.date_of_birth && !validBirthday(student.date_of_birth))) throw new Error('Enter a valid birthday, not a future date.')
  const first = students[0] || { name: '', age: '', instrument_interest: '' }
  const savedSiblingCount = readLeadStudents(savedPayload, null).length - 1
  // Preserve unrecognized legacy metadata. Never create identity links here.
  const rawSiblings = Array.isArray(savedPayload.siblings)
    ? savedPayload.siblings.filter(entry => readLeadStudents({ siblings: [entry] }, null).length > 1)
    : []
  const siblings = students.slice(1).flatMap((student, index) => {
    const normalized = normalizeFamilyMembers([student])[0]
    const raw = rawSiblings[index]
    // Keep the previous visible row when clearing would delete legacy metadata.
    if (!normalized && !student.date_of_birth && !student.relationship_to_contact && !student.email.trim() && !student.phone.trim() && !student.adult && !Object.values(student.preferences || {}).some(Boolean)) return raw && typeof raw === 'object' ? [{ ...raw }] : []
    const saved = raw && typeof raw === 'object' ? raw : {}
    return [{ ...saved, ...normalized, date_of_birth: student.date_of_birth || null, relationship_to_contact: student.relationship_to_contact || null, email: student.email.trim() || null, phone: student.phone.trim() || null, adult_student: student.adult || false, same_as_contact: student.same_as_contact || false, same_availability: student.same_availability || false, ...(student.preferences ? { student_preferences: { ...(saved.student_preferences && typeof saved.student_preferences === 'object' ? saved.student_preferences : {}), ...preferencePatch(student.preferences) } } : {}) }]
  })
  return {
    program_label: first.instrument_interest.trim(),
    payload: {
      student_name: first.name.trim() || null,
      student_email: first.email.trim() || null,
      student_phone: first.phone.trim() || null,
      adult_student: first.adult || false,
      same_as_contact: first.same_as_contact || false,
      ...(first.preferences ? { student_preferences: { ...(savedPayload.student_preferences && typeof savedPayload.student_preferences === 'object' ? savedPayload.student_preferences : {}), ...preferencePatch(first.preferences) } } : {}),
      age: first.age.trim() || null,
      date_of_birth: first.date_of_birth || null,
      relationship_to_contact: first.relationship_to_contact || null,
      instrument: first.instrument_interest.trim() || null,
      siblings,
      sibling_count: siblings.length,
      // Retain an explicitly reported larger household count until staff verifies it.
      family_members_interested: Math.max(students.length, typeof savedPayload.family_members_interested === 'number' && savedPayload.family_members_interested > savedSiblingCount + 1 ? savedPayload.family_members_interested : 0),
    },
  }
}
