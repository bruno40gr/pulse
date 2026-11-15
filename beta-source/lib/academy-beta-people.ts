import type { FamilyPreviewData } from './academy-family-preview'
import type { ExplorerPerson } from './event-explorer'

/** Project existing Beta identities, never create a second contact directory. */
export function betaEnrollmentPeople(data: FamilyPreviewData): ExplorerPerson[] {
  const people = new Map<string, ExplorerPerson>()
  const contacts = new Map(data.contacts?.map(person => [person.id, person]))
  const students = new Map(data.students.map(student => [student.id, student]))
  for (const account of data.accounts) {
    const contact = contacts.get(account.holderId)
    people.set(account.holderId, {
      id: account.holderId, accountId: account.id, name: account.holderName,
      email: contact?.email || account.email, family: account.name,
      roles: ['Account holder'], enrolled: false, customer: false,
    })
    for (const id of account.studentIds) {
      const student = students.get(id)
      if (!student) continue
      const active = student.enrollments.filter(enrollment => enrollment.status === 'active' && !enrollment.lifecycle)
      people.set(id, {
        id, accountId: account.id, name: `${student.firstName} ${student.lastName}`.trim(),
        email: student.email || account.email, family: account.name, roles: ['Student'],
        enrolled: active.length > 0, customer: false,
        instruments: [...new Set(active.map(enrollment => enrollment.program))],
        subscriptions: active.map(enrollment => ({ instrument: enrollment.program, status: 'active', recurring: enrollment.frequency === 'Weekly' })),
      })
    }
  }
  return [...people.values()]
}