/** Read-model helpers only: business roles never confer tenant access or messaging grants. */
export type ContactPresentation = {
  id: string
  tenant_id?: string
  student_id?: string | null
  is_student?: boolean
  account_id?: string | null
  account_holder_person_id?: string | null
  is_minor?: boolean
  message_routing?: string | null
  phone?: string | null
  email?: string | null
  account_holder_name?: string | null
  account_holder_phone?: string | null
  account_holder_email?: string | null
  custom_fields?: Record<string, unknown>
}

export function usesAccountHolder(contact: ContactPresentation) {
  return contact.is_minor === true || contact.custom_fields?.is_minor === true
    || contact.message_routing === 'account_holder' || contact.custom_fields?.message_routing === 'account_holder'
}

export function contactDestination(contact: ContactPresentation) {
  const holder = usesAccountHolder(contact)
  return {
    holder,
    name: holder ? contact.account_holder_name : null,
    phone: holder ? contact.account_holder_phone : contact.phone,
    email: holder ? contact.account_holder_email : contact.email,
  }
}

/** A holder/person mapping must be explicit, unanimous and tenant-local. Never match names. */
export function familyHolderPerson<T extends ContactPresentation>(members: T[]): T | undefined {
  const ids = new Set(members.map(member => member.account_holder_person_id).filter(Boolean))
  if (ids.size !== 1) return undefined
  const holder = members.find(member => member.id === [...ids][0])
  if (!holder || holder.is_minor === true || holder.custom_fields?.is_minor === true) return undefined
  return members.every(member => member.tenant_id === holder.tenant_id) ? holder : undefined
}