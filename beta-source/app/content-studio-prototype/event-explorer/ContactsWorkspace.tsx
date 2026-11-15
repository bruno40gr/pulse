'use client'

import { useMemo } from 'react'
import ContactsView from '@/app/dashboard/contacts/page'
import { ContactSampleContext, ContactPrototypeContext } from '@/components/contacts/ContactPrototypeContext'
import { explorerContactDirectory } from '@/beta-source/lib/academy-explorer-contacts'
import { type ExplorerPerson, type ExplorerRegistration } from '@/beta-source/lib/event-explorer'

export default function ContactsWorkspace({ people, registrations, onBook, onCreate, onCreateBand }: {
  people: ExplorerPerson[]; registrations: ExplorerRegistration[];
  onBook: (id: string) => void; onCreate: (ids: string[]) => void; onCreateBand?: (ids: string[]) => void;
}) {
  const directory = useMemo(() => explorerContactDirectory(people, people.map(person => person.id), registrations), [people, registrations])
  const students = (ids: string[]) => [...new Set(ids.flatMap(id => {
    const family = directory.views.families.find(family => family.contactId === id)
    return family?.studentIds.length ? family.studentIds : [id]
  }))]
  return <ContactPrototypeContext.Provider value>
    <ContactSampleContext.Provider value={{ contacts: directory.contacts, onEnroll: ids => onBook(students(ids)[0] || ''), onCreateOpportunity: ids => onCreate(students(ids)), onCreateBand: onCreateBand ? ids => onCreateBand(students(ids)) : undefined }}><ContactsView /></ContactSampleContext.Provider>
  </ContactPrototypeContext.Provider>
}
