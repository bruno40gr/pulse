import type { Contact } from '@/app/dashboard/contacts/page'
type ContactViews = { families: { contactId: string; studentIds: string[] }[]; studentIds: string[]; matchingIds?: string[] }
import { activeInquiry, clientTypesForPerson, isExplorerStudent, type ExplorerInquiry, type ExplorerPerson, type ExplorerRegistration } from './event-explorer'

export const explorerLeadWorklists = ['Lesson requests', 'Service inquiries', 'Enrolled', 'Lost', 'Disenrolled'] as const
export type ExplorerLeadWorklist = typeof explorerLeadWorklists[number]
export function inquiryStatus(inquiry: ExplorerInquiry) {
  return inquiry.stage === 'Enrolled' ? 'won' : inquiry.stage.toLowerCase().replaceAll(' ', '_')
}
export function inquiriesInWorklist(inquiries: ExplorerInquiry[], worklist: ExplorerLeadWorklist) {
  if (worklist === 'Enrolled') return inquiries.filter(inquiry => inquiryStatus(inquiry) === 'won')
  if (worklist === 'Lost') return inquiries.filter(inquiry => ['lost', 'ghosted_us', 'spam'].includes(inquiryStatus(inquiry)))
  if (worklist === 'Disenrolled') return inquiries.filter(inquiry => inquiry.stage === 'Disenrolled')
  return inquiries.filter(inquiry => activeInquiry(inquiry) && (worklist === 'Service inquiries' ? inquiry.category === worklist : inquiry.category !== 'Service inquiries'))
}
/** Explicit family IDs and holder roles only; never group unrelated people by shared email. */
export function explorerContactDirectory(people: ExplorerPerson[], matchingIds: string[], registrations: ExplorerRegistration[] = []): { contacts: Contact[]; views: ContactViews } {
  const families = [...new Set(people.map(person => person.accountId || person.id))].map(accountId => {
    const members = people.filter(person => (person.accountId || person.id) === accountId)
    const holder = members.find(person => person.roles.includes('Parent') || person.roles.includes('Account holder'))
    return { contactId: holder?.id || (members.length === 1 && (!members[0].accountId || members[0].family === 'Self') ? members[0].id : `holder:${accountId}`), studentIds: members.filter(person => person.id !== holder?.id).map(person => person.id) }
  })
  const contacts: Contact[] = people.map(person => {
    const family = families.find(family => family.contactId === person.id || family.studentIds.includes(person.id))!
    const holder = people.find(person => person.id === family.contactId)
    const [first_name, ...last] = person.name.split(' ')
    return { tenant_id: 'explorer-local', account_id: person.accountId || person.id,
      is_student: isExplorerStudent(person), student_id: isExplorerStudent(person) ? person.id : null,
      account_holder_person_id: holder?.id || family.contactId,
      id: person.id, first_name, last_name: last.join(' '), phone: null, email: person.email, client_status: person.enrolled ? 'active' : 'inactive', opted_out: false, last_attended: null, notes: null, family_name: null, account_holder_name: holder?.name || (family.contactId.startsWith('holder:') ? person.family.replace(/.* · /, '').replace(/\s*\(parent\)$/, '') : null), account_holder_phone: null, account_holder_email: holder?.email || null, custom_fields: { client_types: clientTypesForPerson(person, registrations), instrument: person.instruments?.join(', ') || '', source: person.source || '' }, funded: false }
  })
  for (const family of families.filter(family => !contacts.some(contact => contact.id === family.contactId))) {
    const student = people.find(person => family.studentIds.includes(person.id))!
    const name = student.family.replace(/.* · /, '').replace(/\s*\(parent\)$/, '')
    const [first_name, ...last] = name.split(' ')
    contacts.push({ tenant_id: 'explorer-local', account_id: student.accountId || student.id, is_student: false, id: family.contactId, first_name, last_name: last.join(' '), phone: null, email: student.email, client_status: 'inactive', opted_out: false, last_attended: null, notes: null, family_name: null, account_holder_name: null, account_holder_phone: null, account_holder_email: null, custom_fields: {}, funded: false })
  }
  return { contacts, views: { families, studentIds: people.map(person => person.id), matchingIds } }
}