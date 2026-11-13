import { familyQueue, isAccountHolder, personAccountId, type PortalQueue } from './academy-portal-queue'
import { availableBandSubscriptions, completeBandEnrollment, defaultBandInstrument, newBandEnrollment, type BandEnrollment } from './academy-band-enrollment'
import { openBandEnrollmentRequest, resolveBandEnrollmentRequests } from './academy-band-requests'
import { completeEnrollmentDraft, type EnrollmentDraftRecord } from './academy-enrollment-drafts'
import { enrollmentGroupPrograms, enrollmentInstruments, enrollmentStudents, newLesson, selectEnrollmentContact, type EnrollmentPerson } from './academy-staff-enrollment'
import { newWorkflowDraft, type WorkflowDraft } from './academy-workflow-drafts'
import type { ExplorerInquiry, ExplorerPerson } from './event-explorer'

/** Pure preview commands. Call inside the store update so validation and writes
 * use the same current snapshot. These are NOT server authorization checks.
 */
export function enrollmentPerson(person: ExplorerPerson): EnrollmentPerson {
  return { id: person.id, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), email: person.email, phone: '', activeTeacher: false, accountId: personAccountId(person), accountHolder: isAccountHolder(person) }
}
export function canSendLessonEnrollment(inquiry: ExplorerInquiry) {
  return inquiry.category === 'Lesson requests' && !inquiry.bandId && !inquiry.proposalId && inquiry.serviceType !== 'band' && !['Lost', 'Spam', 'Ghosted us', 'Disenrolled', 'Won', 'Enrolled'].includes(inquiry.stage)
}
export function sendLessonEnrollment(queue: PortalQueue, inquiryId: string): PortalQueue {
  const inquiry = queue.inquiries.find(item => item.id === inquiryId)
  if (!inquiry || !canSendLessonEnrollment(inquiry)) throw new Error('This opportunity does not support lesson enrollment.')
  if (inquiry.enrollmentSentAt) return queue
  return { ...queue, inquiries: queue.inquiries.map(item => item.id === inquiryId ? { ...item, enrollmentSentAt: new Date().toISOString() } : item) }
}
function lessonInquiry(queue: PortalQueue, accountId: string, id: string) {
  const inquiry = familyQueue(queue, accountId).inquiries.find(item => item.id === id)
  if (!inquiry?.enrollmentSentAt || !canSendLessonEnrollment(inquiry)) throw new Error('Enrollment request unavailable for this family.')
  return inquiry
}
export function openFamilyLesson(queue: PortalQueue, accountId: string, inquiryId: string): { queue: PortalQueue; record: EnrollmentDraftRecord } {
  const inquiry = lessonInquiry(queue, accountId, inquiryId)
  const existing = queue.drafts.find(item => item.kind === 'enrollment' && item.data.sourceLeadId === inquiry.id)
  if (existing?.kind === 'enrollment') {
    if (existing.data.completedAt) throw new Error('This enrollment has already been completed.')
    return { queue, record: existing.data }
  }
  const people = familyQueue(queue, accountId).people.map(enrollmentPerson)
  const student = people.find(person => person.id === inquiry.personId)!
  const record = newWorkflowDraft('enrollment', queue.academy)
  if (record.kind !== 'enrollment') throw new Error('Lesson enrollment unavailable.')
  const interest = inquiry.interest.replace(/^(Private|Semi-private|Group) · /, '')
  const instrument = [...enrollmentInstruments, ...enrollmentGroupPrograms].find(value => value.toLowerCase() === interest.toLowerCase()) || ''
  const group = enrollmentGroupPrograms.some(value => value === instrument)
  const service = group ? 'Group' : inquiry.interest.startsWith('Semi-private') ? 'Semi-private' : 'Private'
  record.data = { ...record.data, sourceLeadId: inquiry.id, started: true, draft: {
    ...selectEnrollmentContact(record.data.draft, student, people),
    lessons: [{ ...newLesson(crypto.randomUUID()), instrument, service, duration: group || service === 'Semi-private' ? '45' : '30', studentId: student.id }],
  } }
  return { queue: { ...queue, drafts: [...queue.drafts, record] }, record: record.data }
}
export function saveFamilyLesson(queue: PortalQueue, accountId: string, record: EnrollmentDraftRecord, complete = false): PortalQueue {
  const stored = queue.drafts.find(item => item.id === record.id && item.kind === 'enrollment')
  if (!stored || stored.kind !== 'enrollment' || stored.data.completedAt || stored.data.updatedAt !== record.updatedAt || !stored.data.sourceLeadId || record.sourceLeadId !== stored.data.sourceLeadId) throw new Error('Enrollment draft unavailable, changed or already completed.')
  const inquiry = lessonInquiry(queue, accountId, stored.data.sourceLeadId)
  const allowed = new Set(familyQueue(queue, accountId).people.map(person => person.id))
  const students = enrollmentStudents(record.draft)
  const linkedPeople = [record.draft.contact, record.draft.manager, ...students].filter((person): person is EnrollmentPerson => !!person)
  if (!students.some(person => person.id === inquiry.personId) || linkedPeople.some(person => !allowed.has(person.id))) throw new Error('Enrollment does not match this family request.')
  const next = { ...record, started: true, updatedAt: new Date().toISOString() }
  const saved = complete ? completeEnrollmentDraft(next, next.updatedAt) : next
  return {
    ...queue,
    drafts: queue.drafts.map(item => item.id === stored.id ? { ...item, data: saved, step: saved.step, reviewedSteps: saved.reviewedSteps } as WorkflowDraft : item),
    inquiries: complete ? queue.inquiries.map(item => item.id === inquiry.id ? { ...item, stage: 'Enrolled', updatedAt: saved.updatedAt } : item) : queue.inquiries,
  }
}
function familyBandRequest(queue: PortalQueue, accountId: string, requestId: string) {
  const request = openBandEnrollmentRequest(queue.requests, requestId, accountId, queue.academy.groups)
  if (!familyQueue(queue, accountId).people.some(person => person.id === request.studentId)) throw new Error('Enrollment request unavailable for this family.')
  return request
}
export function openFamilyBand(queue: PortalQueue, accountId: string, requestId: string): { queue: PortalQueue; draft: BandEnrollment } {
  const request = familyBandRequest(queue, accountId, requestId)
  const existing = queue.enrollments.find(item => item.requestId === request.id && !item.completedAt)
  if (existing) return { queue, draft: existing }
  const person = queue.state.people.find(item => item.id === request.studentId)!
  const draft = { ...newBandEnrollment(request.studentId, request.bandId), step: 1, requestId: request.id, instrument: queue.academy.groups.find(group => group.id === request.bandId)?.memberInstruments?.[request.studentId] || defaultBandInstrument(person), monthlyPrice: request.monthlyPrice, pricing: request.pricing, payerName: request.recipientName, payerEmail: request.recipientEmail }
  return { queue: { ...queue, enrollments: [...queue.enrollments, draft] }, draft }
}
export function saveFamilyBand(queue: PortalQueue, accountId: string, draft: BandEnrollment, complete = false): PortalQueue {
  const request = familyBandRequest(queue, accountId, draft.requestId || '')
  const stored = queue.enrollments.find(item => item.id === draft.id && item.requestId === request.id)
  if (!stored || stored.completedAt || draft.completedAt || draft.studentId !== request.studentId || draft.bandId !== request.bandId || draft.monthlyPrice !== request.monthlyPrice || JSON.stringify(draft.pricing) !== JSON.stringify(request.pricing)) throw new Error('Enrollment does not match this request or is already completed.')
  if (!complete) return { ...queue, enrollments: queue.enrollments.map(item => item.id === draft.id ? draft : item) }
  if (availableBandSubscriptions(queue.enrollments, draft.studentId).length) throw new Error('Assign the available paid subscription instead of charging again.')
  const result = completeBandEnrollment(draft, queue.academy.groups, queue.state.people, queue.inquiries)
  return { ...queue, academy: { ...queue.academy, groups: result.groups }, state: { ...queue.state, people: result.people }, inquiries: result.inquiries, requests: resolveBandEnrollmentRequests(queue.requests, draft.studentId, draft.bandId), enrollments: queue.enrollments.map(item => item.id === draft.id ? result.receipt : item) }
}
