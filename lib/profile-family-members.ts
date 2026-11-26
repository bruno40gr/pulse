import type { ContactPresentation } from './contact-presentation'
import { familyHeaderHolder, type DisplayAccountHolder } from './family-account'

type Person = ContactPresentation & { first_name?: string | null; last_name?: string | null }
/** Presentation only: saved family links, never matching names or destinations. */
export function profileFamilyMembers<T extends Person>(people: T[], holders: DisplayAccountHolder[], tenantId: string, currentPersonId?: string, currentAccountId?: string) {
  const local = new Map(people.filter(person => person.tenant_id === tenantId).map(person => [person.id, person]))
  const rows = new Map<string, { id: string; name: string; person?: T; accountId?: string; holder: boolean; student: boolean }>()
  const headerHolder = currentAccountId ? familyHeaderHolder(`account:${currentAccountId}`, holders.map((holder, index) => ({ ...holder, id: String(index) }))) : undefined
  const headerPersonId = headerHolder?.person_id || headerHolder?.display_person_id
  for (const [index, holder] of holders.entries()) {
    const personId = holder.person_id || holder.display_person_id
    if ((currentPersonId && personId === currentPersonId) || headerHolder?.id === String(index)) continue
    const person = personId ? local.get(personId) : undefined
    if (personId && !person) continue
    const id = person ? `person:${person.id}` : holder.account_id ? `account:${holder.account_id}` : null
    if (!id || !holder.name) continue
    rows.set(id, { id, name: person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() : holder.name,
      person, accountId: holder.account_id, holder: true, student: person?.is_student === true || (person?.is_student !== false && !!person?.student_id) })
  }
  for (const person of local.values()) {
    if (person.id === currentPersonId || person.id === headerPersonId || !(person.is_student === true || (person.is_student !== false && person.student_id))) continue
    const id = `person:${person.id}`
    if (!rows.has(id)) rows.set(id, { id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim(), person, holder: false, student: true })
  }
  return [...rows.values()].sort((a, b) => Number(b.holder) - Number(a.holder))
}