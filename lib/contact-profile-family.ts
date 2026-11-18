import type { ContactPresentation } from './contact-presentation'

type FamilyPerson = ContactPresentation & { account_holders?: { person_id?: string }[] }

export function contactProfileFamilies<T extends FamilyPerson>(roster: T[], tenantId: string, personId?: string, accountId?: string) {
  const local = roster.filter(person => person.tenant_id === tenantId)
  const linkedIds = (person: T) => [person.account_holder_person_id, ...(person.account_holders ?? []).map(holder => holder.person_id)]
  const accounts = new Map<string, T[]>()
  for (const row of local) {
    if (!row.account_id || row.is_student === false) continue
    const members = accounts.get(row.account_id) ?? []
    members.push(row)
    accounts.set(row.account_id, members)
  }
  return [...accounts].flatMap(([id, students]) => {
    const ids = new Set(students.flatMap(linkedIds).filter(Boolean))
    const holders = local.filter(person => ids.has(person.id))
    if (id !== accountId && (!personId || (!students.some(row => row.id === personId) && !holders.some(row => row.id === personId)))) return []
    return [{ id, students, holders }]
  })
}