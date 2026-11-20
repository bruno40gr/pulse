import type { PerformancePreview } from './performance-preview'

/** Fictional exploration only. No live messaging or payment adapters. */
export type PeopleView = 'students' | 'customers' | 'participants' | 'all' | 'leads'
export type InquiryStage = 'New' | 'Contacted' | 'Booked' | 'Processing' | 'Won' | 'Enrolled' | 'Lost' | 'Spam' | 'Ghosted us' | 'Disenrolled'
export type ExplorerInquiry = { enrollmentSentAt?: string; serviceType?: 'band'; bandId?: string; accountId?: string; programId?: string; proposalId?: string; origin?: 'staff_initiated' | 'family_inquiry'; source?: string; createdAt?: string; updatedAt?: string; winbackStatus?: 'to_contact' | 'contacted' | 'interested' | 're_enrolled' | 'closed'; id: string; personId: string; interest: string; stage: InquiryStage; category: string; followUp: string; note: string }
export const explorerClientTypes = ['Lessons', 'Rehearsal space', 'Event attendee', 'Birthday party', 'Studio recording'] as const
export type ExplorerClientType = typeof explorerClientTypes[number]
export type ExplorerPerson = { subscriptions?: { instrument: string; status: 'active' | 'pending' | 'cancelled'; recurring: boolean }[]; clientTypes?: ExplorerClientType[]; source?: string; accountId?: string; instruments?: string[]; id: string; name: string; email: string; family: string; roles: string[]; enrolled: boolean; customer: boolean }
export type ExplorerActivity = { rooms?: string[]; multipleRooms?: boolean; id: string; name: string; ages: string; capacity: number; teacher: string; room: string; schedule: string }
export type EventSchedule = { days: string[]; from: string; to: string }
export type ExplorerEvent = { performancePreview?: PerformancePreview; multipleSessions?: boolean; scheduleMode?: 'single' | 'multiple'; sessionPrice?: string; paymentHandling?: Record<string, 'online' | 'manual'>; dailySchedule?: EventSchedule; paymentMethods?: string[]; questionChoices?: string[]; typeId?: string; id: string; name: string; description: string; image: string; start: string; end: string; schedule: string; location: string; published: boolean; activities: ExplorerActivity[]; signup: string; payment: string; price: string; deposit: string; access: string; approval: boolean; hold: string; allocation: string; cancellation: string; waiver: string; questions: string; message: string }
export type ExplorerRegistration = { id: string; eventId: string; activityId: string; personId: string; status: 'Confirmed' | 'Awaiting approval' | 'Awaiting payment' | 'Waitlisted' | 'Cancelled'; attended: boolean; responses?: Record<string, string>; policyOverrides?: string[] }
export const explorerPeople: ExplorerPerson[] = [
  { id: 'sophie', subscriptions: [{ instrument: 'Guitar', status: 'active', recurring: true }], accountId: 'kim', instruments: ['Guitar', 'Voice'], name: 'Sophie Kim', email: 'sam.kim@example.invalid', family: 'Kim family · Sam Kim (parent)', roles: ['Student'], enrolled: true, customer: false },
  { id: 'ethan', subscriptions: [{ instrument: 'Drums', status: 'active', recurring: true }], accountId: 'kim', instruments: ['Drums'], name: 'Ethan Kim', email: 'sam.kim@example.invalid', family: 'Kim family · Sam Kim (parent)', roles: ['Student'], enrolled: true, customer: false },
  { id: 'alex', clientTypes: ['Studio recording'], name: 'Alex Morgan', email: 'alex@example.invalid', family: 'Self', roles: ['Recording customer'], enrolled: false, customer: true },
  { id: 'jules', clientTypes: ['Rehearsal space'], name: 'Jules Rivera', email: 'jules@example.invalid', family: 'Rehearsal contact for The Satellites', roles: ['Band representative'], enrolled: false, customer: true },
  { id: 'mia', accountId: 'chen', instruments: ['Piano'], name: 'Mia Chen', email: 'mia@example.invalid', family: 'Chen family · Lee Chen (parent)', roles: ['One-off learner'], enrolled: false, customer: true },
  { id: 'leo', accountId: 'patel', instruments: ['Bass'], name: 'Leo Patel', email: 'patel@example.invalid', family: 'Patel family · Jo Patel (parent)', roles: [], enrolled: false, customer: false },
  { id: 'sam', accountId: 'kim', name: 'Sam Kim', email: 'sam.kim@example.invalid', family: 'Kim family · Account holder', roles: ['Parent'], enrolled: false, customer: false },
]
export const explorerInquiries: ExplorerInquiry[] = [
  { id: 'inq-1', personId: 'sophie', interest: 'Summer camp', stage: 'Contacted', category: 'Lesson requests', followUp: '2027-05-19', note: 'Parent requested camp dates and availability.' },
  { id: 'inq-2', personId: 'jules', interest: 'Weekly rehearsal room', stage: 'New', category: 'Service inquiries', followUp: '', note: '' },
  { id: 'inq-3', personId: 'mia', interest: 'Weekly piano lessons', stage: 'New', category: 'Lesson requests', followUp: '', note: '' },
  { id: 'inq-5', personId: 'alex', interest: 'Former weekly recording sessions', stage: 'Disenrolled', winbackStatus: 'to_contact', category: 'Service inquiries', followUp: '', note: 'Fictional former-service client for re-enrollment review.' },
  { id: 'inq-6', personId: 'leo', interest: 'Private bass lessons', stage: 'Lost', category: 'Lesson requests', followUp: '', note: 'Fictional closed inquiry; event participation remains separate.' },
  { id: 'inq-4', personId: 'sophie', interest: 'Weekly piano lessons (original inquiry)', stage: 'Enrolled', category: 'Enrolled', followUp: '', note: 'Original lesson inquiry completed.' },
]
export function activeInquiry(inquiry: ExplorerInquiry) { return ['New', 'Contacted', 'Booked', 'Processing'].includes(inquiry.stage) }
export function inquiriesForView(inquiries: ExplorerInquiry[], view: string) {
  if (view === 'Active inquiries') return inquiries.filter(activeInquiry)
  if (view === 'All inquiries') return inquiries
  if (['Enrolled', 'Lost', 'Disenrolled'].includes(view)) return inquiries.filter(inquiry => inquiry.stage === view)
  return inquiries.filter(inquiry => inquiry.category === view && activeInquiry(inquiry))
}
export function newExplorerEvent(id: string): ExplorerEvent {
  return { id, name: '', description: '', image: '', start: '', end: '', schedule: '', location: 'Main academy', published: false, activities: [], signup: 'Whole event', payment: 'Full payment', price: '250', deposit: '50', access: 'Open registration', approval: false, hold: '10', allocation: 'All selected sessions must have space', cancellation: 'Use academy default', waiver: 'Standard participation agreement', questions: 'Emergency contact; accessibility or support needs', message: '' }
}
export function createExplorerState(): { events: ExplorerEvent[]; registrations: ExplorerRegistration[]; people: ExplorerPerson[] } {
  const camp: ExplorerEvent = { ...newExplorerEvent('music-camp'), typeId: 'event-type-0', name: 'Summer Music Camp', description: 'A week of playing, creating and performing together. Choose a group that fits your child.', image: '/images/services/guitar.jpg', start: '2027-07-12', end: '2027-07-16', schedule: 'Monday–Friday, 9 am–12 pm', published: true, signup: 'Whole event, days or sessions', activities: [
    { id: 'young', name: 'Young music makers', ages: '6–9', capacity: 12, teacher: 'Maya Chen', room: 'Studio 1', schedule: '' },
    { id: 'band', name: 'Band lab', ages: '10–14', capacity: 8, teacher: 'Owen Reed', room: 'Rehearsal room', schedule: 'Monday–Friday, 1–4 pm' },
  ] }
  const workshop: ExplorerEvent = { ...newExplorerEvent('studio-workshop'), typeId: 'event-type-1', name: 'Recording Workshop', description: 'Explore microphones, recording and mixing in a hands-on studio session.', image: '/images/services/voice.jpg', start: '2027-05-22', end: '2027-05-22', activities: [{ id: 'recording', name: 'Studio introduction', ages: '16+', capacity: 6, teacher: 'Robin Ellis', room: 'Recording studio', schedule: 'Saturday, 10 am–1 pm' }] }
  return { events: [camp, workshop], people: explorerPeople.map(person => ({ ...person, roles: [...person.roles] })), registrations: [
    { id: 'reg-1', eventId: camp.id, activityId: 'young', personId: 'sophie', status: 'Confirmed', attended: false },
    { id: 'reg-2', eventId: camp.id, activityId: 'band', personId: 'ethan', status: 'Awaiting approval', attended: false },
    { id: 'reg-3', eventId: camp.id, activityId: 'young', personId: 'leo', status: 'Waitlisted', attended: false },
  ] }
}
export function eventScheduleMode(event: ExplorerEvent): 'single' | 'multiple' {
  return event.scheduleMode || (event.start && event.start === event.end ? 'single' : 'multiple')
}
export function eventTypeScheduleMode(name: string): 'single' | 'multiple' {
  return /workshop|performance|birthday party|open mic/i.test(name) ? 'single' : 'multiple'
}
/** Keep the single-date UI and legacy date/schedule fields in sync. */
export function updateEventSchedule(event: ExplorerEvent, change: Partial<ExplorerEvent>): ExplorerEvent {
  const next = { ...event, ...change }
  if (eventScheduleMode(next) === 'single') {
    next.end = next.start
    const date = new Date(`${next.start}T12:00:00Z`)
    const day = Number.isFinite(date.getTime()) ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()] : ''
    next.dailySchedule = { ...(next.dailySchedule || { from: '', to: '' }), days: day ? [day] : [] }
  }
  if (next.dailySchedule) next.schedule = `${next.dailySchedule.days.join(', ')} · ${next.dailySchedule.from}–${next.dailySchedule.to}`
  return next
}
/** Count offered calendar dates inclusively, without timezone/DST drift. */
export function eventOfferedDays(event: ExplorerEvent): number {
  const start = Date.parse(`${event.start}T00:00:00Z`), end = Date.parse(`${event.end}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  const total = Math.floor((end - start) / 86400000) + 1
  if (!event.dailySchedule) return total
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const selected = new Set(event.dailySchedule.days)
  const first = new Date(start).getUTCDay()
  return weekdays.reduce((count, day, index) => count + (selected.has(day) ? Math.floor(total / 7) + ((index - first + 7) % 7 < total % 7 ? 1 : 0) : 0), 0)
}
/** Derived at read time so changing dates, weekdays or total never leaves a stale price. */
export function eventSessionPrice(event: ExplorerEvent): string {
  const days = eventOfferedDays(event)
  return days && event.price.trim() && Number.isFinite(Number(event.price)) && Number(event.price) >= 0 ? (Number(event.price) / days).toFixed(2) : ''
}
export function eventAgeBounds(ages: string = ''): { minimum: string; maximum: string } {
  const range = ages.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (range) return { minimum: range[1], maximum: range[2] }
  const minimum = ages.trim().match(/^(\d+)\+$/)
  if (minimum) return { minimum: minimum[1], maximum: '' }
  const maximum = ages.trim().match(/^Up to (\d+)$/i)
  if (maximum) return { minimum: '', maximum: maximum[1] }
  const single = ages.trim().match(/^\d+$/)
  return single ? { minimum: single[0], maximum: single[0] } : { minimum: '', maximum: '' }
}
export function eventAges(minimum: string, maximum: string): string {
  return minimum && maximum ? `${minimum}–${maximum}` : minimum ? `${minimum}+` : maximum ? `Up to ${maximum}` : ''
}
export function eventIsPaid(event: ExplorerEvent): boolean {
  return event.payment !== 'Free' && Number(event.price) !== 0
}
export function eventPaymentHandling(event: Pick<ExplorerEvent, 'paymentHandling'>, method: string): 'online' | 'manual' {
  return event.paymentHandling?.[method] || (method === 'Cash' || method === 'Zelle' ? 'manual' : 'online')
}
export function eventPaymentTiming(event: ExplorerEvent): string {
  if (!eventIsPaid(event)) return event.approval ? 'Staff approval required; no payment is due.' : 'No payment is due.'
  return event.approval ? 'Students register first. Payment is requested only after staff approval.' : 'Payment is requested after registration.'
}
export function eventErrors(event: ExplorerEvent): string[] {
  const errors: string[] = []
  if (event.scheduleMode && !event.typeId) errors.push('Choose an event type.')
  if (!event.name.trim()) errors.push('Add an event name.')
  if (!event.start || !event.end || event.end < event.start) errors.push('Choose a valid start and end date.')
  if (event.dailySchedule && (!event.dailySchedule.days.length || !event.dailySchedule.from || !event.dailySchedule.to || event.dailySchedule.to <= event.dailySchedule.from)) errors.push('Choose schedule days and an end time after the start time.')
  if (!event.activities.length) errors.push('Add at least one activity.')
  if (event.activities.some(activity => !activity.name.trim() || !Number.isInteger(activity.capacity) || activity.capacity < 1)) errors.push('Each activity needs a name and a positive whole-number capacity.')
  if (event.activities.some(activity => {
    const { minimum, maximum } = eventAgeBounds(activity.ages)
    return [minimum, maximum].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) || (minimum !== '' && maximum !== '' && Number(minimum) > Number(maximum))
  })) errors.push('Minimum age must not exceed maximum age.')
  if (event.activities.some(activity => activity.multipleRooms && (activity.rooms || []).filter(Boolean).length !== new Set((activity.rooms || []).filter(Boolean)).size)) errors.push('Each activity must use different rooms.')
  if (!Number.isInteger(Number(event.hold)) || Number(event.hold) < 0) errors.push('Space hold must be a whole number of minutes, or 0 for no hold.')
  if (event.payment !== 'Free' && (!event.price.trim() || !Number.isFinite(Number(event.price)) || Number(event.price) < 0)) errors.push('Enter a valid sample price.')
  if (eventIsPaid(event) && event.signup !== 'Whole event' && !eventOfferedDays(event)) errors.push('Choose at least one offered day to calculate the session price.')
  if (eventIsPaid(event) && event.paymentMethods && !event.paymentMethods.length) errors.push('Choose at least one payment method in School Setup.')
  if (eventIsPaid(event) && event.payment === 'Deposit' && (!event.deposit.trim() || !Number.isFinite(Number(event.deposit)) || Number(event.deposit) <= 0 || Number(event.deposit) > Number(event.price) || (event.signup !== 'Whole event' && eventSessionPrice(event) !== '' && Number(event.deposit) > Number(eventSessionPrice(event))))) errors.push('Deposit must be greater than zero and no more than the event or session price.')
  return errors
}
export function activitySpace(event: ExplorerEvent, activityId: string, registrations: ExplorerRegistration[]) {
  const activity = event.activities.find(item => item.id === activityId)
  const reserved = registrations.filter(item => item.eventId === event.id && item.activityId === activityId && !['Waitlisted', 'Cancelled'].includes(item.status)).length
  return Math.max(0, (activity?.capacity || 0) - reserved)
}
export function peopleInView(people: ExplorerPerson[], registrations: ExplorerRegistration[], view: PeopleView, search = '', inquiries: ExplorerInquiry[] = explorerInquiries) {
  const labels = { all: '', leads: 'Lead', students: 'Student', customers: 'Client', participants: 'Event participant' }
  return people.filter(person => (view === 'all' || contactRelationships(person, registrations, inquiries).includes(labels[view])) && `${person.name} ${person.email} ${person.family}`.toLowerCase().includes(search.toLowerCase()))
}
export function isExplorerStudent(person: ExplorerPerson): boolean {
  return person.enrolled || person.roles.includes('Student') || person.roles.includes('One-off learner') || Boolean(person.clientTypes?.includes('Lessons'))
}
/** Multiple service relationships on one identity; never acquisition provenance. */
export function clientTypesForPerson(person: ExplorerPerson, registrations: ExplorerRegistration[]): ExplorerClientType[] {
  return [...new Set<ExplorerClientType>([
    ...(person.clientTypes || []),
    ...(isExplorerStudent(person) ? ['Lessons' as const] : []),
    ...(registrations.some(item => item.personId === person.id && item.status !== 'Cancelled') ? ['Event attendee' as const] : []),
  ])]
}
/** Relationships overlap; recurring enrollment is not required for student membership. */
export function contactRelationships(person: ExplorerPerson, registrations: ExplorerRegistration[], inquiries: ExplorerInquiry[]): string[] {
  const student = isExplorerStudent(person)
  const participant = registrations.some(item => item.personId === person.id && item.status !== 'Cancelled')
  return [
    ...(inquiries.some(inquiry => inquiry.personId === person.id && activeInquiry(inquiry)) ? ['Lead'] : []),
    ...(student ? ['Student'] : []),
    ...(student || person.customer || participant || person.clientTypes?.length ? ['Client'] : []),
    ...(participant ? ['Event participant'] : []),
  ]
}
export function registerExplorerPerson(event: ExplorerEvent, registrations: ExplorerRegistration[], personId: string, activityId: string): ExplorerRegistration[] {
  if (!event.activities.some(activity => activity.id === activityId)) throw new Error('Choose an activity.')
  if (registrations.some(item => item.eventId === event.id && item.activityId === activityId && item.personId === personId && item.status !== 'Cancelled')) throw new Error('This student is already registered. Choose another student.')
  const status = activitySpace(event, activityId, registrations) === 0 ? 'Waitlisted' : event.approval ? 'Awaiting approval' : !eventIsPaid(event) ? 'Confirmed' : 'Awaiting payment'
  return [...registrations, { id: `registration-${personId}-${activityId}-${registrations.length}`, personId, activityId, eventId: event.id, status, attended: false }]
}
export const eventParticipantQuestions = ['Emergency contact', 'Allergies or medical needs', 'Accessibility or support needs', 'Authorized pickup person', 'Drop-off and pickup instructions', 'Photo and media consent', 'Participation disclaimer']
export function eventQuestions(event?: Pick<ExplorerEvent, 'questionChoices' | 'questions'>): string[] {
  return event?.questionChoices ?? eventParticipantQuestions.filter(question => event?.questions.toLowerCase().includes(question.toLowerCase()))
}
export function eventHasMultipleSessions(event: ExplorerEvent) {
  return event.multipleSessions ?? event.activities.length > 1
}
export function eventRegistrationActivity(event: ExplorerEvent, activityId: string) {
  return eventHasMultipleSessions(event) ? activityId : event.activities[0]?.id || ''
}
export function eventAlreadyRegistered(event: ExplorerEvent, registrations: ExplorerRegistration[], personId: string, activityId: string) {
  return registrations.some(registration => registration.eventId === event.id && registration.personId === personId && registration.activityId === eventRegistrationActivity(event, activityId) && registration.status !== 'Cancelled')
}
