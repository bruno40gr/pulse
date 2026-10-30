import { enrollmentSteps, enrollmentStepError, enrollmentStudents, enrollmentInstruments, enrollmentGroupPrograms, newStaffEnrollment, newLesson, type EnrollmentPerson, type StaffEnrollment } from './academy-staff-enrollment'
import { readLeadStudents, type StudentPreferences } from './lead-students'
import { isLessonLead } from './lead-lesson-details'

export type EnrollmentDraftRecord = {
  id: string
  sourceLeadId?: string
  draft: StaffEnrollment
  step: number
  reviewedSteps: number[]
  updatedAt: string
  started: boolean
  preferences?: { studentId: string; name: string; interest: string; availability: StudentPreferences | undefined }[]
  opportunityValue?: number
}
export type EnrollmentLead = {
  id: string; status: string; intake_type: string; program_label: string | null; updated_at: string
  contact: { full_name: string | null; email: string | null; phone: string | null } | null
  payload: Record<string, unknown> | null
}

export function enrollmentDraftStorageKey(scope: string) {
  return `odeon:enrollment-drafts:v1:${scope}`
}

export function newEnrollmentDraft(id: string, now: string): EnrollmentDraftRecord {
  return { id, draft: newStaffEnrollment(), step: 0, reviewedSteps: [], updatedAt: now, started: false }
}

export function enrollmentDraftName(record: EnrollmentDraftRecord) {
  const names = enrollmentStudents(record.draft).map(person => [person.firstName, person.lastName].filter(Boolean).join(' ')).filter(Boolean)
  return names.join(', ') || [record.draft.contact?.firstName, record.draft.contact?.lastName].filter(Boolean).join(' ') || 'Unnamed enrollment'
}

export function enrollmentDraftProgress(record: EnrollmentDraftRecord) {
  let previousComplete = true
  const steps = enrollmentSteps.map((label, index) => {
    const complete = previousComplete && record.reviewedSteps.includes(index) && !enrollmentStepError(record.draft, index)
    previousComplete = complete
    return { id: String(index), label, complete }
  })
  const incomplete = steps.findIndex(step => !step.complete)
  return { steps, current: incomplete < 0 ? steps.length - 1 : incomplete }
}

function personFromInquiry(id: string, name: string, email = '', phone = ''): EnrollmentPerson {
  const [firstName = '', ...rest] = name.trim().split(/\s+/)
  // Draft labels only. These local IDs never link or merge canonical people.
  return { id, firstName, lastName: rest.join(' '), email, phone, activeTeacher: false }
}

export function enrollmentDraftFromLead(lead: EnrollmentLead): EnrollmentDraftRecord | null {
  if (lead.status !== 'won' || !isLessonLead(lead.intake_type)) return null
  const record = newEnrollmentDraft(`lead:${lead.id}`, lead.updated_at)
  const contact = lead.contact ? personFromInquiry(`inquiry:${lead.id}:contact`, lead.contact.full_name || '', lead.contact.email || '', lead.contact.phone || '') : null
  const learners = readLeadStudents(lead.payload || {}, lead.program_label)
  const people = learners.map((student, index) => student.same_as_contact && contact ? contact : personFromInquiry(`inquiry:${lead.id}:student:${index}`, student.name, student.email, student.phone))
  const lessons = learners.map((student, index) => {
    const interests = student.instrument_interest.split(',').map(value => value.trim()).filter(Boolean)
    const match = interests.length === 1 ? /^(Private|Semi-private) · (.+)$/.exec(interests[0]) : null
    const instrument = match?.[2] || (interests.length === 1 ? interests[0] : '')
    const group = enrollmentGroupPrograms.find(program => program === instrument)
    const recognized = group || enrollmentInstruments.find(value => value === instrument) || ''
    return { ...newLesson(`inquiry:${lead.id}:lesson:${index}`), studentId: people[index].id, service: group ? 'Group' as const : match?.[1] === 'Semi-private' ? 'Semi-private' as const : 'Private' as const, instrument: recognized, teacher: '', day: '', start: '', time: '' }
  })
  record.sourceLeadId = lead.id
  record.draft = { ...record.draft, contact, contactIsStudent: Boolean(learners[0]?.same_as_contact && contact), student: people[0] || null, additionalStudents: people.slice(1), manager: learners[0]?.same_as_contact ? null : contact, payer: learners[0]?.same_as_contact ? 'student' : 'manager', lessons,
    studentRelationships: Object.fromEntries(learners.flatMap((student, index) => student.relationship_to_contact ? [[people[index].id, student.relationship_to_contact === 'self' ? 'Self' : student.relationship_to_contact]] : [])),
  }
  record.preferences = learners.map((student, index) => ({ studentId: people[index].id, name: student.name || contact?.firstName || 'Student', interest: student.instrument_interest, availability: student.preferences }))
  // Show only a recorded value; never substitute the CRM's illustrative default.
  const value = Number(lead.payload?.potential_value_base)
  if (lead.payload?.potential_value_base != null && Number.isFinite(value) && value >= 0) record.opportunityValue = value
  return record
}

/** Local edits win over refreshed source suggestions. A lead is queued once. */
export function mergeEnrollmentQueue(saved: EnrollmentDraftRecord[], leads: EnrollmentLead[]) {
  const rows = new Map(saved.map(record => [record.id, record]))
  const linked = new Set(saved.map(record => record.sourceLeadId).filter(Boolean))
  for (const lead of leads) {
    if (linked.has(lead.id)) continue
    const record = enrollmentDraftFromLead(lead)
    if (record) { rows.set(record.id, record); linked.add(lead.id) }
  }
  return [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}

/** Reject damaged/unknown storage instead of silently replacing it. */
export function readEnrollmentDrafts(raw: string | null): EnrollmentDraftRecord[] {
  if (raw === null) return []
  const envelope: unknown = JSON.parse(raw)
  if (!envelope || typeof envelope !== 'object' || !('version' in envelope) || envelope.version !== 1 || !('records' in envelope) || !Array.isArray(envelope.records)) throw new Error('Saved enrollment drafts could not be read. Existing storage has not been changed.')
  for (const record of envelope.records) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) || typeof record.started !== 'boolean' || !Number.isInteger(record.step) || record.step < 0 || record.step >= enrollmentSteps.length || !Array.isArray(record.reviewedSteps) || record.reviewedSteps.some((step: unknown) => !Number.isInteger(step) || Number(step) < 0 || Number(step) >= enrollmentSteps.length)) throw new Error('Saved enrollment drafts are damaged. Existing storage has not been changed.')
    const draft = record.draft
    if (!draft || !Array.isArray(draft.lessons) || !Array.isArray(draft.additionalStudents) || !draft.consent || typeof draft.consent.termsAccepted !== 'boolean' || typeof draft.contactIsStudent !== 'boolean' || !draft.studentRelationships || !['student', 'manager', 'other'].includes(draft.payer) || !['later', 'demo_card'].includes(draft.payment)) throw new Error('Saved enrollment details are damaged. Existing storage has not been changed.')
    const people = [draft.contact, draft.student, draft.manager, ...draft.additionalStudents]
    if (people.some(person => person !== null && (!person || ['id', 'firstName', 'lastName', 'email', 'phone'].some(key => typeof person[key] !== 'string') || typeof person.activeTeacher !== 'boolean'))) throw new Error('Saved enrollment people are damaged.')
    if (draft.lessons.some((lesson: Record<string, unknown>) => !lesson || ['id', 'service', 'instrument', 'teacher', 'day', 'time', 'start', 'duration', 'frequency'].some(key => typeof lesson[key] !== 'string'))) throw new Error('Saved enrollment lessons are damaged.')
  }
  if (new Set(envelope.records.map(record => record.id)).size !== envelope.records.length) throw new Error('Duplicate saved enrollment drafts require review.')
  return envelope.records as EnrollmentDraftRecord[]
}

/** Compare before writing so another tab's work is never silently overwritten. */
export function writeEnrollmentDrafts(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, previous: string | null, records: EnrollmentDraftRecord[]) {
  if (storage.getItem(key) !== previous) throw new Error('Drafts changed in another tab. Reload the enrollment list before saving; keep this tab open to preserve your work.')
  const raw = JSON.stringify({ version: 1, records })
  storage.setItem(key, raw)
  return raw
}