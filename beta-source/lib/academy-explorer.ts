import { createExplorerState, newExplorerEvent } from './event-explorer'

export type AcademyKind = 'music' | 'martial' | 'tutoring'
export type OfferingType = { id: string; name: string; description: string; example: string; settings: string; enabled: boolean }
export type GroupResource = { id: string; name: string; kind: 'Document' | 'Video' | 'Exercise' | 'Link'; url: string }
export type AcademyGroup = { memberInstruments?: Record<string, string>; emailDraft?: { subject: string; html: string }; pendingMemberIds?: string[]; bandNotes?: { id: string; text: string; timestamp: string }[]; stage?: 'Just Created' | 'In Development' | 'Ready for Stage'; formedAt?: string; formation?: boolean; description?: string; goals?: string; dailySchedule?: import('./event-explorer').EventSchedule; id: string; typeId: string; name: string; leader: string; capacity: number; trialMax: number; memberIds: string[]; schedule: string; resources: GroupResource[]; eventIds: string[]; message: string }
export type SingleLessonBooking = { groupId: string; personId: string; date: string; trial: boolean }
export type EventDefaults = Pick<import('./event-explorer').ExplorerEvent, 'access' | 'hold' | 'allocation' | 'cancellation' | 'waiver' | 'questions' | 'paymentMethods' | 'paymentHandling'>
export type AcademySettings = { eventDefaults?: EventDefaults; kind: AcademyKind; name: string; groupTypes: OfferingType[]; eventTypes: OfferingType[]; groups: AcademyGroup[]; trialDiscount: number; singleLessons: SingleLessonBooking[] }
export const academyKinds: { key: AcademyKind; label: string }[] = [{ key: 'music', label: 'Music academy' }, { key: 'martial', label: 'Martial arts academy' }, { key: 'tutoring', label: 'Tutoring academy' }]
const groupSettings = 'Members, staff, schedule, capacity, trial limit, resources and linked events.'
const eventSettings = 'Dates, schedule, ages, capacity, staff, location, registration and pricing.'
export function offeringCatalog(kind: AcademyKind): Pick<AcademySettings, 'groupTypes' | 'eventTypes'> {
  const option = (id: string, name: string, description: string, example: string, settings: string): OfferingType => ({ id, name, description, example, settings, enabled: true })
  const group = (name: string, description: string, example: string) => option('group-type-0', name, description, example, groupSettings)
  const event = (index: number, name: string, description: string, example: string, extra = '') => option(`event-type-${index}`, name, description, example, `${eventSettings}${extra ? ` ${extra}` : ''}`)
  if (kind === 'music') return {
    groupTypes: [group('Band', 'Enrolled students rehearse together on a recurring schedule, building a shared repertoire.', 'A rock band rehearsing weekly for an end-of-term performance.')],
    eventTypes: [
      event(0, 'Camp', 'A themed program with a start and end date, often during school breaks. Participants learn together across scheduled activities.', 'A five-day songwriting camp ending with a student showcase.'),
      event(1, 'Workshop', 'A short event focused on one skill or topic, without ongoing membership.', 'A Saturday improvisation workshop.'),
      event(2, 'Performance', 'A recital or showcase where students and groups present what they have prepared.', 'An end-of-term recital featuring individual students and bands.', 'Link participating groups from their group workspace. Participant registration does not include audience ticketing.'),
    ],
  }
  if (kind === 'martial') return {
    groupTypes: [group('Practice team', 'An ongoing group of enrolled students who train together around shared techniques, learning goals and a recurring practice schedule.', 'A junior team practicing a demonstration sequence each week.')],
    eventTypes: [
      event(0, 'Tournament', 'A dated gathering for friendly competition or demonstrations, with participants organized into activities or divisions. It ends independently of ongoing team membership.', 'A spring tournament with junior and senior divisions.', 'Divisions are activities; selecting this type does not add brackets or scoring.'),
      event(1, 'Training camp', 'A themed, intensive training program with defined start and end dates, often during a school break. Participants work toward shared practice objectives.', 'A three-day summer techniques camp.'),
      event(2, 'Grading event', 'A scheduled assessment gathering for students to demonstrate prepared skills. Choose this for an assessment occasion rather than regular training.', 'A Saturday skills demonstration for eligible students.', 'This organizes attendance; it does not award ranks or implement progression.'),
    ],
  }
  return {
    groupTypes: [group('Study group', 'An ongoing group of enrolled students who follow a shared curriculum, support one another and work toward common learning goals on a recurring schedule.', 'A weekly math problem-solving group working on a shared project.')],
    eventTypes: [
      event(0, 'Workshop', 'A focused, time-limited learning event for a particular topic or skill, without ongoing group membership.', 'A Saturday problem-solving workshop.'),
      event(1, 'Challenge day', 'A dated collaborative learning event where participants tackle themed challenges toward a common objective.', 'A one-day team mathematics challenge.', 'Challenges are scheduled activities; automatic scoring is not included.'),
      event(2, 'Assessment', 'A scheduled occasion for participants to demonstrate learning or review their readiness. Choose this for an assessment rather than a continuing study group.', 'An end-of-term learning review.', 'This organizes participation; it does not calculate grades or change student levels.'),
    ],
  }
}
export function setOfferingEnabled(academy: AcademySettings, key: 'groupTypes' | 'eventTypes', id: string, enabled: boolean, events: ReturnType<typeof createExplorerState>['events']): AcademySettings {
  if (!academy[key].some(type => type.id === id)) throw new Error('Choose an available offering type.')
  if (!enabled) {
    const assigned = key === 'groupTypes' ? academy.groups.some(group => group.typeId === id) : events.some(event => event.typeId === id)
    if (assigned) throw new Error('This type is in use. Keep it available for its existing groups or events.')
    if (academy[key].filter(type => type.enabled).length <= 1) throw new Error('Keep at least one available type in each section.')
  }
  return { ...academy, [key]: academy[key].map(type => type.id === id ? { ...type, enabled } : type) }
}
export function academySettings(kind: AcademyKind): AcademySettings {
  const variants = {
    music: { name: 'Music academy', groupName: 'Northside Band', resource: 'Band practice guide', schedule: 'Thursdays, 4–5 pm' },
    martial: { name: 'Martial arts academy', groupName: 'Junior Practice Team', resource: 'Partner practice sequence', schedule: 'Tuesdays, 5–6 pm' },
    tutoring: { name: 'Tutoring academy', groupName: 'Problem Solvers', resource: 'Collaborative problem set', schedule: 'Wednesdays, 3–4 pm' },
  }[kind]
  return { kind, name: variants.name, ...offeringCatalog(kind), trialDiscount: 50, singleLessons: [], groups: [{ id: `${kind}-group`, typeId: 'group-type-0', name: variants.groupName, leader: kind === 'music' ? 'demo:teacher-3' : '', capacity: 12, trialMax: 2, memberIds: ['sophie', 'ethan'], schedule: variants.schedule, resources: [{ id: 'resource-1', name: variants.resource, kind: 'Exercise', url: '' }], eventIds: [kind === 'music' ? 'music-camp' : `${kind}-event`], message: '' }] }
}
export function academyEventState(kind: AcademyKind): ReturnType<typeof createExplorerState> {
  const state = createExplorerState()
  if (kind === 'music') return state
  const martial = kind === 'martial'
  const event = { ...newExplorerEvent(`${kind}-event`), typeId: 'event-type-0', name: martial ? 'Spring Tournament' : 'Problem-solving Workshop', description: martial ? 'A day of practice, demonstrations and friendly competition.' : 'Solve challenges, share ideas and learn together.', start: '2027-05-22', end: '2027-05-22', schedule: 'Saturday, 10 am–2 pm', activities: [{ id: 'junior', name: martial ? 'Junior division' : 'Junior problem solvers', ages: '8–12', capacity: 12, teacher: 'Jordan Vale', room: martial ? 'Training floor' : 'Learning room', schedule: '' }] }
  return { ...state, people: state.people.map(person => ({ ...person, roles: person.id === 'jules' ? ['Room-booking contact'] : person.id === 'alex' ? ['Session customer'] : person.roles })), events: [event], registrations: [{ id: 'reg-1', eventId: event.id, activityId: 'junior', personId: 'sophie', status: 'Confirmed', attended: false }] }
}
export function availableGroupTrials(group: AcademyGroup, bookedTrials = 0) {
  return Math.max(0, Math.min(group.trialMax - bookedTrials, group.capacity - group.memberIds.length - bookedTrials))
}
export function groupScheduleError(group: AcademyGroup): string {
  if (!group.dailySchedule) return group.schedule.trim() ? '' : 'Enter a recurring schedule.'
  const { days, from, to } = group.dailySchedule
  return !days.length || !from || !to || to <= from ? 'Choose rehearsal days and an end time after the start time.' : ''
}
export function groupErrors(group: AcademyGroup): string[] {
  const errors: string[] = []
  if (!group.name.trim()) errors.push('Enter a group name.')
  if (!group.formation && (!Number.isInteger(group.capacity) || group.capacity < Math.max(1, group.memberIds.length))) errors.push('Capacity must be a whole number at least as large as the membership.')
  if (!group.formation && (!Number.isInteger(group.trialMax) || group.trialMax < 0 || group.trialMax > group.capacity)) errors.push('Trial limit must be between zero and total capacity.')
  return errors
}
export function addGroupMember(group: AcademyGroup, personId: string): AcademyGroup {
  if (!personId) throw new Error('Choose a member.')
  if (group.memberIds.includes(personId)) throw new Error('This person is already a member.')
  if (!group.formation && group.memberIds.length >= group.capacity) throw new Error('This group is full.')
  return { ...group, memberIds: [...group.memberIds, personId] }
}
export function assembleGroup(group: AcademyGroup, people: ReturnType<typeof createExplorerState>['people'], staffIds: string[]): AcademyGroup {
  const errors = groupErrors(group)
  if ((!group.formation || group.leader) && !staffIds.includes(group.leader)) errors.push('Choose a teacher or staff member.')
  if (new Set(group.memberIds).size !== group.memberIds.length) errors.push('Each student can be included only once.')
  if (group.memberIds.some(id => !people.some(person => person.id === id && (group.formation ? !person.roles.some(role => ['Parent', 'Account holder'].includes(role)) : person.enrolled)))) errors.push('Choose enrolled students for ongoing group membership.')
  if (errors.length) throw new Error(errors.join(' '))
  return { ...group, memberIds: [...group.memberIds] }
}
export function lessonTotal(price: number, discount: number) {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Enter a valid price and a discount between 0 and 100%.')
  return Math.round(price * 100 * (1 - discount / 100)) / 100
}
export function safeResourceUrl(value: string): boolean {
  if (!value.trim()) return true
  try { const url = new URL(value); return url.protocol === 'https:' } catch { return false }
}