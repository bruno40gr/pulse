/** Isolated integration contract, not a mapping of the unverified production schema. */
export type FamilyPerson = {
  id: string; tenantId: string; name: string; email: string; phone: string
  isStudent: boolean; isMinor: boolean | null; optedOut: boolean
  routing: 'direct' | 'authorised_contact' | 'unverified'
}
export type FamilyAccount = { id: string; tenantId: string; name: string }
export type FamilyMembership = {
  accountId: string; personId: string; role: 'account_holder' | 'student' | 'payer' | 'guardian'
}
export type FamilyMessagingGrant = {
  studentId: string; recipientId: string; channel: 'email' | 'sms'; active: boolean
}
export type FamilyIntegrationData = {
  source: 'fictional'; tenantId: string; people: FamilyPerson[]; accounts: FamilyAccount[]
  memberships: FamilyMembership[]; messagingGrants: FamilyMessagingGrant[]
}
export type FamilyTreeGroup = {
  id: string; accountId: string | null; name: string
  holders: FamilyPerson[]; students: FamilyPerson[]; standalone: FamilyPerson | null
}
export type FamilyRecipientProposal = {
  deliveryEnabled: false; selectedCount: number
  recipients: { recipientIds: string[]; name: string; destination: string; studentIds: string[]; studentNames: string[] }[]
  excluded: { personId: string; reason: string }[]
}

export const FAMILY_PRODUCTION_ROUTING_ENABLED = false

export function validateFamilyIntegration(data: FamilyIntegrationData) {
  if (data.source !== 'fictional' || !data.tenantId.startsWith('preview:')) throw new Error('Only isolated fictional family data is supported.')
  const people = new Map(data.people.map(person => [person.id, person]))
  const accounts = new Map(data.accounts.map(account => [account.id, account]))
  if (people.size !== data.people.length || accounts.size !== data.accounts.length) throw new Error('Duplicate identity IDs require review.')
  for (const record of [...data.people, ...data.accounts]) {
    if (record.tenantId !== data.tenantId || !record.id.startsWith('preview:')) throw new Error('Foreign or live identity rejected.')
  }
  for (const person of data.people) {
    if (!['direct', 'authorised_contact', 'unverified'].includes(person.routing) || typeof person.optedOut !== 'boolean'
      || typeof person.isStudent !== 'boolean' || ![true, false, null].includes(person.isMinor)) throw new Error('Identity policy requires explicit verified fields.')
  }
  const links = new Set<string>()
  for (const link of data.memberships) {
    const key = JSON.stringify([link.accountId, link.personId, link.role])
    if (!['account_holder', 'student', 'payer', 'guardian'].includes(link.role) || !accounts.has(link.accountId) || !people.has(link.personId) || links.has(key)) throw new Error('Invalid or duplicate family membership.')
    if (link.role === 'student' && !people.get(link.personId)?.isStudent) throw new Error('Student membership requires an explicit student identity.')
    links.add(key)
  }
  for (const grant of data.messagingGrants) {
    if (!['email', 'sms'].includes(grant.channel) || typeof grant.active !== 'boolean' || !people.get(grant.studentId)?.isStudent || !people.has(grant.recipientId)) throw new Error('Messaging grant references an unavailable identity.')
  }
  return { people, accounts }
}

/** Explicit account membership only. Names and shared addresses never establish family links. */
export function buildContactFamilyTree(data: FamilyIntegrationData, search = ''): FamilyTreeGroup[] {
  const { people } = validateFamilyIntegration(data)
  const represented = new Set<string>()
  const groups: FamilyTreeGroup[] = []
  const byName = (a: FamilyPerson, b: FamilyPerson) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  for (const account of data.accounts) {
    const links = data.memberships.filter(link => link.accountId === account.id)
    const holders = links.filter(link => link.role === 'account_holder').map(link => people.get(link.personId)!).sort(byName)
    const students = links.filter(link => link.role === 'student').map(link => people.get(link.personId)!).sort(byName)
    if (!holders.length && !students.length) continue
    for (const person of [...holders, ...students]) represented.add(person.id)
    groups.push({ id: account.id, accountId: account.id, name: account.name, holders, students, standalone: null })
  }
  for (const person of data.people.filter(person => !represented.has(person.id))) {
    groups.push({ id: person.id, accountId: null, name: person.name, holders: [], students: [], standalone: person })
  }
  const query = search.trim().toLowerCase()
  return groups.filter(group => [group.name, ...group.holders.map(person => person.name), ...group.students.map(person => person.name)]
    .some(name => name.toLowerCase().includes(query))).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

function destination(person: FamilyPerson, channel: 'email' | 'sms') {
  if (channel === 'email') {
    const email = person.email.trim().toLowerCase()
    return email.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) ? email : ''
  }
  const digits = person.phone.replace(/\D/g, '')
  return digits.length === 10 ? `+1${digits}` : digits.length >= 11 && digits.length <= 15 ? `+${digits}` : ''
}

/** Proposals only: account membership, payer and guardian labels NEVER confer messaging authority. */
export function proposeFamilyRecipients(data: FamilyIntegrationData, selectedIds: string[], channel: 'email' | 'sms'): FamilyRecipientProposal {
  const { people } = validateFamilyIntegration(data)
  if (!['email', 'sms'].includes(channel)) throw new Error('Unsupported messaging channel.')
  const selected = [...new Set(selectedIds)].sort()
  const result: FamilyRecipientProposal = { deliveryEnabled: false, selectedCount: selected.length, recipients: [], excluded: [] }
  const blocked = new Set(data.people.filter(person => person.optedOut).map(person => destination(person, channel)).filter(Boolean))
  // Until consent scope is verified, conservatively suppress the adult destination
  // associated with an opted-out student, including unselected siblings.
  for (const grant of data.messagingGrants) {
    if (grant.active && grant.channel === channel && people.get(grant.studentId)?.optedOut) blocked.add(destination(people.get(grant.recipientId)!, channel))
  }
  for (const personId of selected) {
    const person = people.get(personId)
    if (!person) throw new Error('Selected identity is unavailable in this tenant.')
    const exclude = (reason: string) => result.excluded.push({ personId, reason })
    if (person.optedOut) { exclude('Opted out'); continue }
    let targets: FamilyPerson[]
    if (person.routing === 'direct' && person.isMinor === false) targets = [person]
    else if (person.routing === 'authorised_contact' && person.isStudent) {
      targets = [...new Set(data.messagingGrants.filter(grant => grant.studentId === personId && grant.channel === channel && grant.active).map(grant => grant.recipientId))].map(id => people.get(id)!)
      if (targets.length !== 1) { exclude(targets.length ? 'Multiple authorised recipients; choose explicitly before sending' : 'No verified messaging recipient'); continue }
      if (targets[0].id === person.id || targets[0].isMinor !== false) { exclude('Adult messaging recipient must be verified'); continue }
    } else { exclude('Recipient policy requires review'); continue }
    const target = targets[0], address = destination(target, channel)
    if (target.optedOut || blocked.has(address)) { exclude('Recipient destination opted out'); continue }
    if (!address) { exclude(`No valid recipient ${channel === 'email' ? 'email' : 'phone'}`); continue }
    const existing = result.recipients.find(item => item.destination === address)
    if (existing) {
      if (!existing.recipientIds.includes(target.id)) existing.recipientIds.push(target.id)
      if (person.isStudent && !existing.studentIds.includes(personId)) { existing.studentIds.push(personId); existing.studentNames.push(person.name) }
    } else result.recipients.push({ recipientIds: [target.id], name: target.name, destination: address, studentIds: person.isStudent ? [personId] : [], studentNames: person.isStudent ? [person.name] : [] })
  }
  // A shared address is not sufficient evidence that two adults are the same recipient.
  result.recipients = result.recipients.filter(recipient => {
    if (recipient.recipientIds.length === 1) return true
    for (const personId of selected.filter(id => recipient.recipientIds.includes(id) || recipient.studentIds.includes(id))) {
      result.excluded.push({ personId, reason: 'Shared destination has multiple recipient identities; review required' })
    }
    return false
  }).sort((a, b) => a.destination.localeCompare(b.destination))
  return result
}