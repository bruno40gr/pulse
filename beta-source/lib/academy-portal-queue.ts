import { academySettings, type AcademySettings } from './academy-explorer'
import { createExplorerState, type ExplorerInquiry } from './event-explorer'
import { createDemoWorkspace } from './odeon-demo-workspace'
import { betaEnrollmentPeople } from './academy-beta-people'
import type { BandEnrollmentRequest } from './academy-band-requests'
import type { BandEnrollment } from './academy-band-enrollment'
import type { ProgramTask, ProgramBooking } from './academy-program-proposals'
import type { WorkflowDraft } from './academy-workflow-drafts'
import { hasEnrollmentName } from './academy-workflow-drafts'
import type { FamilyPreviewData } from './academy-family-preview'
import { demoBandGroups } from './academy-demo-groups'

// Separate from the discarded prototype directory; do not hydrate its contacts.
export const portalQueueKey = 'odeon:beta-enrollment-portal:v2'
export type PortalQueue = {
  demoDatasetVersion?: number;
  state: ReturnType<typeof createExplorerState>; academy: AcademySettings; inquiries: ExplorerInquiry[];
  requests: BandEnrollmentRequest[]; enrollments: BandEnrollment[]; tasks: ProgramTask[]; bookings: ProgramBooking[]; drafts: WorkflowDraft[];
}
export function createPortalQueue(data: FamilyPreviewData = createDemoWorkspace().data): PortalQueue {
  return { demoDatasetVersion: data.datasetVersion, state: { ...createExplorerState(), people: betaEnrollmentPeople(data), registrations: [] }, academy: { ...academySettings('music'), groups: demoBandGroups(data), singleLessons: [] }, inquiries: [], requests: [], enrollments: [], tasks: [], bookings: [], drafts: [] }
}
/** Active blank editors remain in memory, but are not resumable session records. */
export function resumablePortalQueue(queue: PortalQueue): PortalQueue {
  return { ...queue, drafts: queue.drafts.filter(record => hasEnrollmentName(record, queue.state.people)), enrollments: queue.enrollments.filter(record => !!queue.state.people.find(person => person.id === record.studentId)?.name.trim()) }
}
/** Validate the persisted envelope before restoring it. This is crash recovery,
 * not a security boundary: all records here are fictional and browser-editable.
 */
export function readPortalQueue(saved?: string | null): PortalQueue {
  const fallback = createPortalQueue()
  if (!saved) return fallback
  try {
    const value = JSON.parse(saved)
    const records = (items: unknown): items is Record<string, unknown>[] => Array.isArray(items) && items.every(item => item && typeof item === 'object' && typeof item.id === 'string')
    if (!value || typeof value !== 'object' || !value.state || !value.academy ||
      !records(value.state.people) || !value.state.people.every((person: { name: unknown; roles: unknown }) => typeof person.name === 'string' && Array.isArray(person.roles)) ||
      !records(value.state.events) || !records(value.state.registrations) || !records(value.academy.groups) || !Array.isArray(value.academy.groupTypes) ||
      !['music', 'martial', 'tutoring'].includes(value.academy.kind) ||
      !['inquiries', 'requests', 'enrollments', 'tasks', 'bookings', 'drafts'].every(key => records(value[key]))) return fallback
    // Whitelist the envelope; do not merge arbitrary storage keys into app state.
    return resumablePortalQueue({ demoDatasetVersion: typeof value.demoDatasetVersion === 'number' ? value.demoDatasetVersion : undefined, state: value.state, academy: value.academy, inquiries: value.inquiries, requests: value.requests, enrollments: value.enrollments, tasks: value.tasks, bookings: value.bookings, drafts: value.drafts })
  } catch { return fallback }
}

const closedStages = new Set(['Lost', 'Spam', 'Ghosted us', 'Disenrolled', 'Won', 'Enrolled'])
export const personAccountId = (person: PortalQueue['state']['people'][number]) => person.accountId || person.id
export const isAccountHolder = (person: PortalQueue['state']['people'][number]) => person.roles.some(role => ['Parent', 'Account holder'].includes(role))

export function familyQueue(queue: PortalQueue, accountId: string) {
  const people = queue.state.people.filter(person => personAccountId(person) === accountId)
  const ids = new Set(people.map(person => person.id))
  return {
    people,
    inquiries: queue.inquiries.filter(item => ids.has(item.personId) && (!item.accountId || item.accountId === accountId) && !closedStages.has(item.stage)),
    requests: queue.requests.filter(item => item.accountId === accountId && ids.has(item.studentId) && !item.completedAt),
    tasks: queue.tasks.filter(item => ids.has(item.studentId)),
  }
}

/** Linear indexes replace a full familyQueue scan for every person.
 * Existing account data is preserved. Only missing, explicitly linked students
 * are added; repeat projection does not drop a child added after first import.
 */
export function withQueueAccounts(data: FamilyPreviewData, queue: PortalQueue): FamilyPreviewData {
  const peopleById = new Map(queue.state.people.map(person => [person.id, person]))
  const families = new Map<string, typeof queue.state.people>()
  for (const person of queue.state.people) {
    const id = personAccountId(person)
    const family = families.get(id) || []
    family.push(person)
    families.set(id, family)
  }
  const active = new Set<string>()
  for (const inquiry of queue.inquiries) {
    const person = peopleById.get(inquiry.personId)
    if (person && !closedStages.has(inquiry.stage) && (!inquiry.accountId || inquiry.accountId === personAccountId(person))) active.add(personAccountId(person))
  }
  for (const request of queue.requests) {
    const person = peopleById.get(request.studentId)
    if (person && !request.completedAt && personAccountId(person) === request.accountId) active.add(request.accountId)
  }
  for (const task of queue.tasks) {
    const person = peopleById.get(task.studentId)
    if (person) active.add(personAccountId(person))
  }
  const accounts = new Map(data.accounts.map(account => [account.id, account]))
  const studentIds = new Set(data.students.map(student => student.id))
  const students = [...data.students]
  for (const id of active) {
    const people = families.get(id)!
    const holder = people.find(isAccountHolder) || people[0]
    const existing = accounts.get(id)
    const linked = people.filter(person => person.id !== holder.id || !isAccountHolder(holder))
    const account = existing ? { ...existing, studentIds: [...new Set([...existing.studentIds, ...linked.map(person => person.id)])] } : {
      id, name: holder.family, holderId: holder.id, holderName: holder.name, email: holder.email, studentIds: linked.map(person => person.id),
    }
    accounts.set(id, account)
    for (const person of linked) {
      if (studentIds.has(person.id)) continue
      studentIds.add(person.id)
      students.push({ id: person.id, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), email: person.email, phone: '', communicationContactId: account.holderId, family: [], enrollments: [], notes: [], messages: [] })
    }
  }
  return { ...data, accounts: [...accounts.values()], students }
}
