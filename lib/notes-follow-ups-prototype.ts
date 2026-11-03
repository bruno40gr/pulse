/** Fictional, browser-local review model. Not a production task or privacy API. */
export type RelatedPerson = { id: string; name: string; kind: 'lead' | 'contact' }
export type FollowUp = { title: string; personId: string | null; ownerId: string; dueDate: string }
export type PrototypeNote = { id: string; title: string; body: string; color: string; followUp: FollowUp | null; completedAt: string | null; pinned?: boolean; isPrivate?: boolean; createdAt?: string; replies?: string[] }
export type FollowUpFilter = 'all' | 'today' | 'upcoming' | 'completed' | 'notes'
export const PROTOTYPE_STORAGE_KEY = 'pulse_notes_follow_ups_review_v1'
export const REVIEW_PEOPLE: RelatedPerson[] = [
  { id: 'lead-michelle', name: 'Michelle Morgan', kind: 'lead' },
  { id: 'contact-alexandra', name: 'Alexandra Brooks', kind: 'contact' },
  { id: 'contact-shauna', name: 'Shauna Parker', kind: 'contact' },
]
export const REVIEW_OWNERS = [{ id: 'admin', name: 'Alex (me)' }, { id: 'jordan', name: 'Jordan' }]

export function localReviewDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function reviewDateOffset(days: number, today = new Date()): string {
  const date = new Date(today)
  date.setDate(date.getDate() + days)
  return localReviewDate(date)
}
export function initialReviewNotes(today = new Date()): PrototypeNote[] {
  return [
    { id: 'sticky-call', title: 'Tuesday might work better', body: 'Michelle asked about moving to Tuesday. Check availability before calling her back.', color: 'yellow', followUp: null, completedAt: null },
    { id: 'sticky-desk', title: 'A note for the front desk', body: 'The spare music stands are in the back cupboard. Nothing to action, just useful to know.', color: 'blue', followUp: null, completedAt: null },
    { id: 'task-time', title: 'Confirm Alexandra’s lesson time', body: 'She can arrive after 4pm. Confirm the revised time before changing her schedule.', color: 'pink', followUp: { title: 'Confirm Alexandra’s lesson time', personId: 'contact-alexandra', ownerId: 'admin', dueDate: localReviewDate(today) }, completedAt: null },
    { id: 'task-first', title: 'First outreach to Michelle', body: 'New lesson inquiry. Ask about experience and preferred lesson days.', color: 'green', followUp: { title: 'First outreach to Michelle', personId: 'lead-michelle', ownerId: 'jordan', dueDate: reviewDateOffset(-1, today) }, completedAt: null },
    { id: 'task-funding', title: 'Check Shauna’s paperwork', body: 'Confirm which supporting documents are still needed.', color: 'purple', followUp: { title: 'Check Shauna’s paperwork', personId: 'contact-shauna', ownerId: 'admin', dueDate: reviewDateOffset(3, today) }, completedAt: null },
    { id: 'task-done', title: 'Share practice resources', body: 'Sent the requested practice guide. Keeping the context with the completed action.', color: 'orange', followUp: { title: 'Share practice resources', personId: 'contact-alexandra', ownerId: 'admin', dueDate: reviewDateOffset(-1, today) }, completedAt: today.toISOString() },
  ]
}
export function promoteReviewNote(note: PrototypeNote, followUp: FollowUp): PrototypeNote {
  if (!followUp.title.trim() || !REVIEW_OWNERS.some(owner => owner.id === followUp.ownerId) || !isReviewDate(followUp.dueDate)
    || (followUp.personId !== null && !REVIEW_PEOPLE.some(person => person.id === followUp.personId))) throw new Error('Choose an action, owner and due date.')
  return { ...note, followUp: { ...followUp, title: followUp.title.trim() }, completedAt: note.followUp ? note.completedAt : null }
}
function isReviewDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function matchesReviewFilter(note: PrototypeNote, filter: FollowUpFilter, today: string): boolean {
  if (filter === 'all') return !note.completedAt
  if (filter === 'notes') return !note.followUp && !note.completedAt
  if (filter === 'completed') return !!note.completedAt
  if (!note.followUp || note.completedAt) return false
  return filter === 'today' ? note.followUp.dueDate <= today : note.followUp.dueDate > today
}
export function readReviewNotes(value: unknown): PrototypeNote[] | null {
  if (!Array.isArray(value) || !value.every(note => note && typeof note.id === 'string' && typeof note.title === 'string' && typeof note.body === 'string'
    && typeof note.color === 'string' && (note.completedAt === null || typeof note.completedAt === 'string')
    && (note.pinned === undefined || typeof note.pinned === 'boolean') && (note.isPrivate === undefined || typeof note.isPrivate === 'boolean')
    && (note.createdAt === undefined || (typeof note.createdAt === 'string' && !Number.isNaN(Date.parse(note.createdAt))))
    && (note.replies === undefined || (Array.isArray(note.replies) && note.replies.every((reply: unknown) => typeof reply === 'string')))
    && (note.followUp === null || (note.followUp && typeof note.followUp.title === 'string' && typeof note.followUp.dueDate === 'string' && isReviewDate(note.followUp.dueDate)
      && REVIEW_OWNERS.some(owner => owner.id === note.followUp.ownerId) && (note.followUp.personId === null || REVIEW_PEOPLE.some(person => person.id === note.followUp.personId)))))) return null
  return value
}