import type { ContactPresentation } from './contact-presentation'

type FamilyPerson = ContactPresentation & { account_holders?: { person_id?: string; display_person_id?: string }[] }

export function contactProfileFamilies<T extends FamilyPerson>(roster: T[], tenantId: string, personId?: string, accountId?: string) {
  const local = roster.filter(person => person.tenant_id === tenantId)
  const linkedIds = (person: T) => [person.account_holder_person_id, ...(person.account_holders ?? []).map(holder => holder.person_id || holder.display_person_id)]
  const accounts = new Map<string, T[]>()
  for (const row of local) {
    if (row.is_student === false) continue
    for (const account of new Set([row.family_account_id || row.account_id, ...(row.family_linked_account_ids || row.linked_account_ids || [])].filter((id): id is string => !!id))) {
      const members = accounts.get(account) ?? []
      members.push(row)
      accounts.set(account, members)
    }
  }
  return [...accounts].flatMap(([id, students]) => {
    const ids = new Set(students.flatMap(linkedIds).filter(Boolean))
    const holders = local.filter(person => ids.has(person.id))
    if (id !== accountId && (!personId || (!students.some(row => row.id === personId) && !holders.some(row => row.id === personId)))) return []
    return [{ id, students, holders }]
  })
}