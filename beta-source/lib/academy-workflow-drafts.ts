import { newProgramPlan, programScheduleError, scheduleSignature, type ProgramPlan, type ProgramTask } from './academy-program-proposals'
import { assembleGroup, groupErrors, groupScheduleError, type AcademyGroup, type AcademyKind, type AcademySettings } from './academy-explorer'
import { eventQuestions, eventAlreadyRegistered, eventRegistrationActivity, activitySpace, eventErrors, newExplorerEvent, type ExplorerEvent, type ExplorerPerson, type ExplorerRegistration } from './event-explorer'
import { enrollmentDraftName, enrollmentDraftProgress, reviewedDraftProgress, newEnrollmentDraft, type EnrollmentDraftRecord } from './academy-enrollment-drafts'
import { enrollmentStepError } from './academy-staff-enrollment'

type DraftBase = { id: string; institution: AcademyKind; step: number; reviewedSteps: number[]; started: boolean; updatedAt: string; parentId?: string; origin: 'hub' | 'events' | 'groups' | 'people' }
export type WorkflowDraft = DraftBase & (
  | { kind: 'program'; data: ProgramPlan }
  | { kind: 'enrollment'; data: EnrollmentDraftRecord }
  | { kind: 'group'; data: AcademyGroup }
  | { kind: 'event'; data: ExplorerEvent }
  | { kind: 'membership'; data: { groupId: string; memberIds: string[]; billingReviewed: boolean } }
  | { kind: 'registration'; data: { personId: string; name: string; email: string; eventId: string; activityId: string; agreed: boolean; responses?: Record<string, string>; policyOverrides?: string[] } }
)
export type WorkflowContext = { academy: AcademySettings; people: ExplorerPerson[]; staffIds: string[]; events: ExplorerEvent[]; tasks?: ProgramTask[]; registrations?: ExplorerRegistration[]; registrationAudience?: 'staff' | 'family' }
export const workflowLabels = { program: 'Band / group program', enrollment: 'Individual / semi-private lessons', group: 'Create group', event: 'Create event', membership: 'Group membership', registration: 'Event' }
export function workflowSteps(record: WorkflowDraft): string[] {
  if (record.kind === 'program') return ['People & proposal', 'Availability', 'Schedule & pricing', 'Review & book']
  if (record.kind === 'enrollment') return enrollmentDraftProgress(record.data).steps.map(step => step.label)
  if (record.kind === 'group') return record.data.formation ? ['Band details', 'Review'] : ['Details & staff', 'Schedule', 'Capacity', 'Members', 'Review']
  if (record.kind === 'event') return ['Overview', 'Event details', 'Pricing', 'Policies & forms', 'Review']
  if (record.kind === 'membership') return ['Students', 'Group & schedule', 'Billing', 'Review']
  return ['Event', 'Participant', 'Policies & forms', 'Review']
}
export function newWorkflowDraft(kind: WorkflowDraft['kind'], academy: AcademySettings, origin: DraftBase['origin'] = 'hub', parentId?: string): WorkflowDraft {
  const id = crypto.randomUUID()
  const base: DraftBase = { id, institution: academy.kind, step: 0, reviewedSteps: [], started: false, updatedAt: new Date().toISOString(), origin, parentId }
  if (kind === 'program') return { ...base, kind, data: newProgramPlan() }
  if (kind === 'enrollment') return { ...base, kind, data: newEnrollmentDraft(id, base.updatedAt) }
  if (kind === 'event') return { ...base, kind, data: { ...newExplorerEvent(id), ...academy.eventDefaults, dailySchedule: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], from: '09:00', to: '12:00' }, schedule: 'Monday, Tuesday, Wednesday, Thursday, Friday · 09:00–12:00', paymentMethods: academy.eventDefaults?.paymentMethods || ['Card'], activities: [{ id: `${id}-main`, name: 'Whole event', ages: '', capacity: 12, teacher: '', room: '', schedule: '' }], scheduleMode: 'multiple', typeId: undefined } }
  if (kind === 'group') return { ...base, kind, data: { formation: academy.kind === 'music', description: '', id, typeId: academy.groupTypes.find(type => type.enabled)?.id || '', name: '', leader: '', capacity: 12, trialMax: 0, memberIds: [], schedule: '', dailySchedule: { days: [], from: '', to: '' }, resources: [], eventIds: [], message: '' } }
  if (kind === 'membership') return { ...base, kind, data: { groupId: '', memberIds: [], billingReviewed: false } }
  return { ...base, kind, data: { personId: '', name: '', email: '', eventId: '', activityId: '', agreed: false } }
}
export function workflowName(record: WorkflowDraft, context: WorkflowContext): string {
  if (record.kind === 'program') return record.data.memberIds.map(id => context.people.find(person => person.id === id)?.name).filter(Boolean).join(', ') || 'New program proposal'
  if (record.kind === 'enrollment') return enrollmentDraftName(record.data)
  if (record.kind === 'event' || record.kind === 'group') return record.data.name || `Unnamed ${record.kind}`
  if (record.kind === 'membership') return context.academy.groups.find(group => group.id === record.data.groupId)?.name || 'New group membership'
  return context.people.find(person => person.id === record.data.personId)?.name || record.data.name || 'New event registration'
}
export function workflowStepError(record: WorkflowDraft, step: number, context: WorkflowContext): string {
  if (step === 3 && record.kind !== 'enrollment' && record.kind !== 'event') {
    for (let index = 0; index < 3; index++) { const error = workflowStepError(record, index, context); if (error) return error }
    return ''
  }
  if (record.kind === 'program') {
    const plan = record.data
    const tasks = (context.tasks || []).filter(task => task.proposalId === record.id && task.institution === record.institution)
    if (step === 0) return !plan.name.trim() ? 'Enter a proposal name.' : !context.staffIds.includes(plan.leader) ? 'Choose a teacher or staff member.' : !plan.memberIds.length || new Set(plan.memberIds).size !== plan.memberIds.length || plan.memberIds.some(id => !context.people.some(person => person.id === id)) ? 'Choose at least one participant.' : ''
    if (step === 1) return plan.memberIds.some(id => !tasks.some(task => task.studentId === id && task.week === plan.week && task.submitted)) ? 'Request and collect availability for every participant, or record their response on their behalf.' : ''
    const error = programScheduleError(plan, tasks)
    if (error) return error
    return plan.memberIds.some(id => !tasks.some(task => task.studentId === id && task.confirmedSchedule === scheduleSignature(plan))) ? 'Ask each family to confirm the proposed schedule.' : ''
  }
  if (record.kind === 'enrollment') return enrollmentStepError(record.data.draft, step) || ''
  if (record.kind === 'event') {
    const errors = eventErrors(record.data)
    return errors.filter(error => step === 4 ? true : step === 0 ? /event type|event name|start and end|schedule days/.test(error) : step === 1 ? /activity|activities|age/.test(error) : step === 2 ? /price|Deposit|payment method/.test(error) : !/event type|event name|start and end|schedule days|activity|activities|age|price|Deposit|payment method/.test(error)).join(' ')
  }
  if (record.kind === 'group') {
    if (record.data.formation) {
      if (!record.data.name.trim()) return 'Enter a band name.'
      try { assembleGroup(record.data, context.people, context.staffIds); return '' } catch (error) { return error instanceof Error ? error.message : 'Check band members.' }
    }
    if (step === 0) return !record.data.name.trim() ? 'Enter a group name.' : !context.academy.groupTypes.some(type => type.id === record.data.typeId && type.enabled) ? 'Choose an enabled group type.' : !context.staffIds.includes(record.data.leader) ? 'Choose a teacher or staff member.' : ''
    if (step === 1) return groupScheduleError(record.data)
    if (step === 2) return groupErrors(record.data).filter(error => !error.includes('name')).join(' ')
    if (step === 4 && groupScheduleError(record.data)) return groupScheduleError(record.data)
    try { assembleGroup(record.data, context.people, context.staffIds); return '' } catch (error) { return error instanceof Error ? error.message : 'Check group members.' }
  }
  if (record.kind === 'membership') {
    const group = context.academy.groups.find(group => group.id === record.data.groupId)
    if (step === 0) return !record.data.memberIds.length || new Set(record.data.memberIds).size !== record.data.memberIds.length || record.data.memberIds.some(id => !context.people.some(person => person.id === id && person.enrolled)) ? 'Choose enrolled students.' : ''
    if (step === 1) return !group ? 'Choose a group.' : !group.formation && !group.schedule.trim() ? 'Set a schedule in group management first.' : !group.formation && new Set([...group.memberIds, ...record.data.memberIds]).size > group.capacity ? 'This group does not have enough capacity.' : ''
    return record.data.billingReviewed ? '' : 'Acknowledge that this only updates the prototype roster.'
  }
  const event = context.events.find(event => event.id === record.data.eventId)
  const activityId = event ? eventRegistrationActivity(event, record.data.activityId) : ''
  if (step === 0) return !event?.activities.some(activity => activity.id === activityId) ? 'Choose an event and session.' : activitySpace(event, activityId, context.registrations || []) === 0 ? 'This event or session is full. Choose another.' : ''
  if (step === 1) {
    if (record.data.personId === 'new') return !record.data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.data.email) ? 'Enter a participant name and a valid contact email.' : ''
    if (!context.people.some(person => person.id === record.data.personId)) return 'Choose a participant.'
    if (event && eventAlreadyRegistered(event, context.registrations || [], record.data.personId, activityId)) return 'This student is already registered. Choose another student.'
    return ''
  }
  if (!record.data.agreed) return 'Accept the participation agreement before continuing.'
  const missing = eventQuestions(event).filter(question => !record.data.responses?.[question]?.trim() && !(context.registrationAudience !== 'family' && record.data.policyOverrides?.includes(question)))
  return missing.length ? `Complete the required information: ${missing.join(', ')}.` : ''
}
export function workflowProgress(record: WorkflowDraft, context: WorkflowContext) {
  if (record.kind === 'enrollment') return enrollmentDraftProgress(record.data)
  return reviewedDraftProgress(workflowSteps(record), record.reviewedSteps, index => workflowStepError(record, index, context))
}
export function resumableWorkflowStep(record: WorkflowDraft, context: WorkflowContext) {
  for (let index = 0; index < record.step; index++) if (workflowStepError(record, index, context)) return index
  return record.step
}