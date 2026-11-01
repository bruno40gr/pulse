/** Fictional preview state only. No database, provider, storage or messaging grants. */
export type PrototypePerson = {
  id: string
  tenant_id?: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  date_of_birth?: string | null
  account_id?: string | null
  account_holder_person_id?: string | null
  account_holder_name: string | null
  account_holder_phone: string | null
  account_holder_email: string | null
  family_name: string | null
  is_minor?: boolean
  custom_fields: Record<string, unknown>
  account_holders?: {
    person_id?: string
    name: string | null
    phone: string | null
    email: string | null
    relationship: string | null
    is_primary: boolean
  }[]
}

export type PrototypeContactEdit = {
  first_name: string
  last_name: string
  phone: string
  email: string
  account_id: string | null
  manager_id: string | null
  holders: { person_id: string; relationship: string }[]
}

export function applyPrototypeContactEdit<T extends PrototypePerson>(people: T[], id: string, edit: PrototypeContactEdit): T[] {
  const subject = people.find(person => person.id === id)
  if (!subject) throw new Error('Contact is no longer available.')
  if (!edit.first_name.trim()) throw new Error('Enter a first name.')
  const local = people.filter(person => person.tenant_id === subject.tenant_id)
  const manager = local.find(person => person.id === edit.manager_id)
  const destination = local.filter(person => person.account_id === edit.account_id && edit.account_id)
  if (edit.account_id) {
    if (!manager || manager.is_minor || manager.custom_fields.is_minor === true) throw new Error('Choose an adult account manager.')
    if (manager.id !== id && manager.account_id !== edit.account_id) throw new Error('Choose a manager from the destination family.')
    if (!destination.length && edit.account_id !== `prototype:family:${id}`) throw new Error('Choose an existing family or create a new one.')
  }
  const holderIds = new Set(edit.holders.map(holder => holder.person_id))
  if (holderIds.size !== edit.holders.length) throw new Error('Each holder can appear only once.')
  for (const holder of edit.holders) {
    const person = local.find(candidate => candidate.id === holder.person_id)
    if (!person || person.is_minor || person.custom_fields.is_minor === true) throw new Error('Choose an adult holder from this preview.')
  }
  const updated = people.map(person => person.id === id ? {
    ...person, first_name: edit.first_name.trim(), last_name: edit.last_name.trim(),
    phone: edit.phone.trim() || null, email: edit.email.trim() || null, account_id: edit.account_id,
  } : { ...person })
  const byId = new Map(updated.map(person => [person.id, person]))
  const holderRow = (personId: string, relationship: string | null, primary: boolean) => {
    const person = byId.get(personId)!
    return { person_id: person.id, name: `${person.first_name} ${person.last_name}`.trim(), phone: person.phone, email: person.email, relationship, is_primary: primary }
  }
  return updated.map(person => {
    if (person.tenant_id !== subject.tenant_id) return person
    const inDestination = Boolean(edit.account_id && person.account_id === edit.account_id)
    // A manager moved out of their old family leaves it explicitly unresolved.
    const oldManagerMoved = person.id !== id && subject.account_id !== edit.account_id && person.account_holder_person_id === id
    const managerId = inDestination ? edit.manager_id : oldManagerMoved || person.id === id ? null : person.account_holder_person_id
    const currentManager = managerId ? byId.get(managerId) : undefined
    let holders = (person.account_holders || []).filter(holder => !oldManagerMoved || holder.person_id !== id)
    if (person.id === id) holders = edit.account_id ? edit.holders.map(holder => holderRow(holder.person_id, holder.relationship || null, holder.person_id === managerId)) : []
    // Refresh explicit holder references after contact details change; never match names.
    holders = holders.map(holder => holder.person_id && byId.has(holder.person_id)
      ? holderRow(holder.person_id, holder.relationship, holder.person_id === managerId) : { ...holder, is_primary: false })
    if (inDestination && managerId && !holders.some(holder => holder.person_id === managerId)) holders = [holderRow(managerId, null, true), ...holders]
    return {
      ...person, account_holder_person_id: managerId ?? null,
      account_holder_name: currentManager ? `${currentManager.first_name} ${currentManager.last_name}`.trim() : null,
      account_holder_phone: currentManager?.phone ?? null, account_holder_email: currentManager?.email ?? null,
      family_name: currentManager ? `${currentManager.last_name || currentManager.first_name} family` : null,
      account_holders: holders,
    }
  })
}