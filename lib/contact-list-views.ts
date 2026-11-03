import type { TablePersonView } from '@/components/ui/TablePersonViewToggle'
import { groupContactFamilies } from './family-list'

export const CONTACT_LIST_VIEWS = [
  { value: 'none', label: 'Students' },
  { value: 'family', label: 'Families' },
] as const
export type ContactListView = TablePersonView

type ViewContact = Parameters<typeof groupContactFamilies>[0][number] & {
  account_holder_person_id?: string | null
  account_holders?: { person_id?: string; name: string | null }[]
  is_minor?: boolean | null
  message_routing?: string | null
}

/** Search matches choose accounts; related people are context, never extra selection. */
export function contactViewGroups<T extends ViewContact>(matches: T[], contacts: T[], view: ContactListView) {
  if (view === 'none') return matches.map(contact => ({ id: `contact:${contact.id}`, holder: null, members: [contact], parent: contact, selectionRows: [contact] }))
  const matchIds = new Set(matches.map(contact => `${contact.tenant_id || ''}:${contact.id}`))
  const holderIds = (members: T[]) => new Set(members.flatMap(member => [member.account_holder_person_id,
    ...(member.account_holders || []).map(holder => holder.person_id)].filter((id): id is string => Boolean(id))))
  const groups = groupContactFamilies(contacts)
  const linkedHolderKeys = new Set(groups.filter(group => group.holder).flatMap(group =>
    [...holderIds(group.members)].map(id => `${group.members[0].tenant_id || ''}:${id}`)))
  const matchRanks = new Map(matches.map((contact, index) => [`${contact.tenant_id || ''}:${contact.id}`, index]))
  const key = (contact: ViewContact) => `${contact.tenant_id || ''}:${contact.id}`
  const built = groups.flatMap(group => {
    if (!group.holder) {
      const row = group.members[0]
      if (linkedHolderKeys.has(key(row)) || !matchIds.has(key(row))) return []
      return [{ rank: matchRanks.get(key(row)) ?? Infinity, value: { ...group, parent: row, selectionRows: [row] } }]
    }
    const ids = holderIds(group.members)
    const parents = contacts.filter(contact => contact.tenant_id === group.members[0].tenant_id && ids.has(contact.id))
    const members = [...new Map([...group.members, ...parents].map(contact => [contact.id, contact])).values()]
    const matched = members.filter(contact => matchIds.has(key(contact)))
    if (!matched.length) return []
    // Header selection uses explicit holders, or matching records as transport IDs
    // for an account summary. Delivery resolves those IDs; they do not expose child checkboxes.
    const selectionRows = parents.length ? parents : matched
    const primaryIds = new Set(group.members.map(member => member.account_holder_person_id).filter(Boolean))
    const primary = primaryIds.size === 1 ? parents.find(parent => primaryIds.has(parent.id)) : undefined
    return [{ rank: Math.min(...matched.map(contact => matchRanks.get(key(contact)) ?? Infinity)),
      value: { ...group, members, parent: primary || (parents.length === 1 ? parents[0] : undefined), selectionRows } }]
  })
  // Preserve the active contact sort; families occupy their first matching person's position.
  return built.sort((left, right) => left.rank - right.rank).map(entry => entry.value)
}

export const isRecordedStudent = (contact: ViewContact) => contact.is_student === true
  || (contact.is_student !== false && Boolean(contact.student_id))

/** View changes translate the same selected accounts, not unrelated visible rows. */
export function mapContactViewSelection<T extends ViewContact>(contacts: T[], selected: ReadonlySet<string>, from: ContactListView, to: ContactListView): Set<string> {
  if (from === to) return new Set(selected)
  const families = contactViewGroups(contacts, contacts, 'family')
  return new Set(families.flatMap(group => {
    const source = from === 'family' ? group.selectionRows : group.members
    if (!source.some(row => selected.has(row.id))) return []
    if (to === 'family') return group.selectionRows.map(row => row.id)
    const students = group.members.filter(isRecordedStudent)
    return (students.length ? students : group.selectionRows).map(row => row.id)
  }))
}

export function contactViewSelectionCount<T extends ViewContact>(contacts: T[], selected: ReadonlySet<string>, view: ContactListView) {
  if (view === 'none') return selected.size
  return contactViewGroups(contacts, contacts, 'family').filter(group => group.selectionRows.some(row => selected.has(row.id))).length
}

/** Counts describe recorded students in the account, not inferred household size. */
export function accountStudentCount<T extends ViewContact>(members: T[], contacts: T[]) {
  const account = members[0]
  if (!account?.account_id) return 0
  return new Set(contacts.filter(contact => contact.account_id === account.account_id
    && contact.tenant_id === account.tenant_id && isRecordedStudent(contact)).map(contact => contact.id)).size
}