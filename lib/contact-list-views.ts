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
  return groups.flatMap(group => {
    if (!group.holder) {
      const row = group.members[0]
      if (linkedHolderKeys.has(`${row.tenant_id || ''}:${row.id}`) || !matchIds.has(`${row.tenant_id || ''}:${row.id}`)) return []
      return [{ ...group, parent: row, selectionRows: [row] }]
    }
    const ids = holderIds(group.members)
    const parents = contacts.filter(contact => contact.tenant_id === group.members[0].tenant_id && ids.has(contact.id))
    if (![...group.members, ...parents].some(contact => matchIds.has(`${contact.tenant_id || ''}:${contact.id}`))) return []
    const selectionRows = [...new Map([...group.members, ...parents].filter(contact => matchIds.has(`${contact.tenant_id || ''}:${contact.id}`)).map(contact => [contact.id, contact])).values()]
    const primaryIds = new Set(group.members.map(member => member.account_holder_person_id).filter(Boolean))
    const primary = primaryIds.size === 1 ? parents.find(parent => primaryIds.has(parent.id)) : undefined
    const members = [...new Map([...group.members, ...parents].map(contact => [contact.id, contact])).values()]
    return [{ ...group, members, parent: primary || (parents.length === 1 ? parents[0] : undefined), selectionRows }]
  }).sort((left, right) => {
    // Preserve the active contact sort; families occupy their first matching person's position.
    const rank = (group: { selectionRows: T[] }) => Math.min(...group.selectionRows.map(contact =>
      matchRanks.get(`${contact.tenant_id || ''}:${contact.id}`) ?? Infinity))
    return rank(left) - rank(right)
  })
}

export const isRecordedStudent = (contact: ViewContact) => contact.is_student === true
  || (contact.is_student !== false && Boolean(contact.student_id))

/** Counts describe recorded students in the account, not inferred household size. */
export function accountStudentCount<T extends ViewContact>(members: T[], contacts: T[]) {
  const account = members[0]
  if (!account?.account_id) return 0
  return new Set(contacts.filter(contact => contact.account_id === account.account_id
    && contact.tenant_id === account.tenant_id && isRecordedStudent(contact)).map(contact => contact.id)).size
}