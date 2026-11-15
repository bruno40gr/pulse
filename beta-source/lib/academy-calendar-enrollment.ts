import type { PortalQueue } from './academy-portal-queue'
import { personAccountId } from './academy-portal-queue'
import type { FamilyPreviewData } from './academy-family-preview'
import type { EnrollmentDraftRecord } from './academy-enrollment-drafts'
import { completeEnrollmentDraft } from './academy-enrollment-drafts'
import { enrollmentStudents, newLesson, selectEnrollmentContact, saveLocalEnrollment } from './academy-staff-enrollment'
import { enrollmentPerson } from './academy-portal-actions'
import { newWorkflowDraft, type WorkflowDraft } from './academy-workflow-drafts'
import { calendarEnrollmentLesson, completeCalendarEnrollment, type BookingContext, type CalendarBooking } from './academy-calendar-booking'

export type CalendarEnrollmentWorkflow = Extract<WorkflowDraft, { kind: 'enrollment' }>
const normalized = (name: string) => ({ 'Voice & Vocals': 'Voice', Band: 'Band Program' }[name] || name).toLowerCase()
export function matchingSubscriptions(data: FamilyPreviewData, studentId: string, serviceId: string, program: string) {
  return (data.students.find(student => student.id === studentId)?.enrollments || []).filter(enrollment => enrollment.status === 'active' && enrollment.lifecycle !== 'cancelled' && enrollment.frequency === 'Weekly' && (enrollment.serviceId === serviceId || normalized(enrollment.program) === normalized(program)))
}

/** Draft identity comes from the proposal, making retries/resends idempotent. */
export function createCalendarEnrollment(queue: PortalQueue, context: BookingContext, proposal: CalendarBooking, sent: boolean) {
  const existing = queue.drafts.find(item => item.id === proposal.id)
  if (existing) {
    if (existing.kind !== 'enrollment' || !existing.data.calendarRequest) throw new Error('Proposal identity is already in use.')
    return { queue: sent ? sendCalendarEnrollment(queue, existing.id) : queue, id: existing.id }
  }
  const lesson = calendarEnrollmentLesson(context, proposal)
  const account = context.data.accounts.find(item => item.studentIds.includes(proposal.studentIds[0]))
  if (!account) throw new Error('This student needs a linked family account.')
  if (sent && !account.email) throw new Error('Add an email for the family recipient before sending.')
  const people = queue.state.people.filter(person => personAccountId(person) === account.id).map(enrollmentPerson)
  const student = people.find(person => person.id === proposal.studentIds[0])
  if (!student) throw new Error('Student unavailable for enrollment.')
  const workflow = newWorkflowDraft('enrollment', queue.academy)
  if (workflow.kind !== 'enrollment') throw new Error('Enrollment unavailable.')
  workflow.id = proposal.id
  workflow.data = { ...workflow.data, id: proposal.id, fromCalendar: true, entryLesson: lesson, started: true,
    calendarRequest: { accountId: account.id, recipientName: account.holderName, recipientEmail: account.email, sentAt: sent ? new Date().toISOString() : undefined, acknowledgedSubscriptionIds: matchingSubscriptions(context.data, student.id, proposal.serviceId, lesson.instrument || '').map(item => item.id) },
    draft: { ...selectEnrollmentContact(workflow.data.draft, student, people), lessons: [{ ...newLesson(`${proposal.id}:lesson`), ...lesson }] },
  }
  return { queue: { ...queue, drafts: [...queue.drafts, workflow] }, id: workflow.id }
}
export function sendCalendarEnrollment(queue: PortalQueue, id: string): PortalQueue {
  const stored = calendarWorkflow(queue, id)
  if (stored.data.completedAt) throw new Error('This enrollment has already been completed.')
  if (!stored.data.calendarRequest!.recipientEmail) throw new Error('Add a recipient email before sending.')
  if (stored.data.calendarRequest!.sentAt) return queue
  return { ...queue, drafts: queue.drafts.map(item => item.id === id ? { ...stored, data: { ...stored.data, calendarRequest: { ...stored.data.calendarRequest!, sentAt: new Date().toISOString() } } } : item) }
}
export function calendarWorkflow(queue: PortalQueue, id: string, accountId?: string): CalendarEnrollmentWorkflow {
  const stored = queue.drafts.find(item => item.id === id)
  if (stored?.kind !== 'enrollment' || !stored.data.calendarRequest || (accountId && (stored.data.calendarRequest.accountId !== accountId || !stored.data.calendarRequest.sentAt))) throw new Error('Enrollment request unavailable for this family.')
  return stored
}

/** One command for staff and family: completion and its result share one identity. */
export function saveCalendarEnrollment(queue: PortalQueue, context: BookingContext, record: EnrollmentDraftRecord, complete: boolean, actor: 'staff' | 'family', accountId?: string, reviewedMatchingSubscriptions = false): { queue: PortalQueue; data: FamilyPreviewData } {
  const stored = calendarWorkflow(queue, record.id, actor === 'family' ? accountId || 'missing-account' : undefined)
  if (stored.data.completedAt) throw new Error('This enrollment has already been completed. Reopen the request to see its result.')
  const request = stored.data.calendarRequest!
  const allowed = new Set(queue.state.people.filter(person => personAccountId(person) === request.accountId).map(person => person.id))
  const linked = [record.draft.contact, record.draft.manager, ...enrollmentStudents(record.draft)].filter(Boolean)
  if (linked.some(person => !allowed.has(person!.id))) throw new Error('Enrollment does not match this family.')
  const next = { ...record, fromCalendar: true, calendarRequest: request, started: true, updatedAt: new Date().toISOString() }
  let data = context.data
  if (complete) {
    for (const lesson of record.draft.lessons) {
      const extra = matchingSubscriptions(data, lesson.studentId || record.draft.student?.id || '', lesson.serviceId || '', lesson.instrument).filter(item => !request.acknowledgedSubscriptionIds.includes(item.id))
      if (extra.length && !(actor === 'staff' && reviewedMatchingSubscriptions)) throw new Error('A matching subscription was created elsewhere. Ask staff to review this request before starting another subscription.')
    }
    const completed = completeEnrollmentDraft({ ...next, draft: saveLocalEnrollment(next.draft) }, next.updatedAt)
    data = completeCalendarEnrollment({ ...context, data }, completed.draft, `beta:${stored.id}`, queue.state.events)
    Object.assign(next, completed, { calendarRequest: { ...request, completedBy: actor, enrollmentIds: data.students.flatMap(student => student.enrollments.filter(item => item.id.startsWith(`beta:${stored.id}:lesson:`)).map(item => item.id)) } })
  }
  return { data, queue: { ...queue, drafts: queue.drafts.map(item => item.id === stored.id ? { ...stored, data: next, step: next.step, reviewedSteps: next.reviewedSteps } : item) } }
}