export type RecipientAccount = { name?: string | null; email?: string | null; phone?: string | null }
export type RecipientContact = {
  id: string; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; opted_out?: boolean | null
  students?: Array<{
    is_minor?: boolean | null; message_routing?: string | null
    accounts?: RecipientAccount | RecipientAccount[] | null
    student_accounts?: Array<{ accounts?: RecipientAccount | RecipientAccount[] | null }> | null
  }> | null
}
export type ResolvedRecipient = { destination: string; name: string; contactIds: string[] }
export type RecipientResolution = { selectedCount: number; recipients: ResolvedRecipient[]; excluded: Array<{ id: string; name: string; reason: string }> }

const array = <T,>(value: T | T[] | null | undefined): T[] => value ? Array.isArray(value) ? value : [value] : []
const emailAddress = (value?: string | null) => {
  const email = value?.trim().toLowerCase() || ''
  return email.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) ? email : ''
}
const phoneNumber = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length === 10 ? `+1${digits}` : digits.length >= 11 && digits.length <= 15 ? `+${digits}` : ''
}

/** One deterministic policy for preview and delivery. Never fall back to a minor's own details. */
export function resolveCommunicationRecipients(contacts: RecipientContact[], channel: 'email' | 'sms', suppressedContacts: RecipientContact[] = []): RecipientResolution {
  const destinations = new Map<string, ResolvedRecipient>()
  const excluded: RecipientResolution['excluded'] = []
  const uniqueContacts = [...new Map(contacts.map(contact => [contact.id, contact])).values()].sort((a, b) => a.id.localeCompare(b.id))
  const blocked = new Set<string>()
  for (const contact of [...uniqueContacts, ...suppressedContacts].filter(contact => contact.opted_out)) {
    const accounts = (contact.students || []).flatMap(student => [...array(student.accounts), ...(student.student_accounts || []).flatMap(link => array(link.accounts))])
    for (const target of [contact, ...accounts]) {
      const destination = channel === 'email' ? emailAddress(target.email) : phoneNumber(target.phone)
      if (destination) blocked.add(destination)
    }
  }
  for (const contact of uniqueContacts) {
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact'
    if (contact.opted_out) { excluded.push({ id: contact.id, name, reason: 'Opted out' }); continue }
    const students = contact.students || []
    const useAccounts = students.some(student => student.is_minor || student.message_routing === 'account_holder')
    const accounts = students.flatMap(student => [
      ...array(student.accounts), ...(student.student_accounts || []).flatMap(link => array(link.accounts)),
    ])
    const targets = useAccounts ? accounts : [{ name, email: contact.email, phone: contact.phone }]
    let reachable = false
    for (const target of targets) {
      const destination = channel === 'email' ? emailAddress(target.email) : phoneNumber(target.phone)
      if (!destination || blocked.has(destination)) continue
      reachable = true
      const existing = destinations.get(destination)
      if (existing) {
        if (!existing.contactIds.includes(contact.id)) existing.contactIds.push(contact.id)
      } else destinations.set(destination, { destination, name: target.name?.trim() || name, contactIds: [contact.id] })
    }
    if (!reachable) excluded.push({ id: contact.id, name, reason: `No ${useAccounts ? 'account-holder ' : ''}${channel === 'email' ? 'email' : 'phone number'} on file` })
  }
  return { selectedCount: uniqueContacts.length, recipients: [...destinations.values()].sort((a, b) => a.destination.localeCompare(b.destination)), excluded }
}