import type { PrototypeThread } from '@/lib/conversations-prototype'

export type ConversationPerson = {
  aliases?: string[]
  id: string
  name: string
  email: string
  phone: string
  student: string
  stage: string
  profileType: 'contact' | 'lead' | null
  profileId: string | null
  intakeType?: string
  smsContactId: string | null
}
export type Mailbox = { id: string; email: string }
export type LiveThread = PrototypeThread & {
  providerThreadId?: string
  mailboxId?: string
}
export type ConversationData = {
  people: ConversationPerson[]
  threads: LiveThread[]
}

export function personThread(person: ConversationPerson): LiveThread {
  return {
    id: `${person.id}-sms`, contactId: person.id, channel: 'sms',
    name: person.name, email: person.email, phone: person.phone, student: person.student,
    initials: person.name.split(/\s+/).map(word => word[0]).slice(0, 2).join(''),
    stage: person.stage, interest: '', nextAction: '', note: '', unread: false, messages: [],
  }
}

/** Preserve empty personal conversations and merge provider histories by their stable IDs. */
export function mergeConversationThreads(people: ConversationPerson[], threads: LiveThread[]): LiveThread[] {
  // Email history may omit phone (and SMS history may omit email). Never let
  // whichever channel loads first erase an available routing address.
  const hydrated = threads.map(thread => {
    const person = people.find(person => person.id === thread.contactId)
    return { ...thread,
      phone: thread.phone || person?.phone || threads.find(other => other.contactId === thread.contactId && other.phone)?.phone || '',
      email: thread.email || person?.email || threads.find(other => other.contactId === thread.contactId && other.email)?.email || '',
    }
  })
  return [
    ...hydrated,
    ...people.filter(person => !threads.some(thread => thread.contactId === person.id && thread.channel === 'sms')).map(personThread),
  ]
}