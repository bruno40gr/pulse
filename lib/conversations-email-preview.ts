import { personThread, type ConversationPerson, type LiveThread } from '@/lib/conversations-live'

/** Staging-only sample history. Never persisted or submitted to Gmail. */
export function createConversationEmailPreview(people: ConversationPerson[]): LiveThread[] {
  return people.filter(person => person.email.trim()).map(person => {
    const subject = 'Lesson availability'
    const messages = [
      { direction: 'inbound' as const, body: `Hi, I would like to learn more about your lessons. What afternoon times are available?\n\nThank you,\n${person.name}`, timestamp: '2026-10-14T18:00:00.000Z', unread: false },
      { direction: 'outbound' as const, body: `Hi ${person.name.split(' ')[0]},\n\nThanks for reaching out! We would be happy to help you find a lesson time. Which weekdays work best for you?\n\nHeadliner Music Academy`, timestamp: '2026-10-14T18:15:00.000Z', unread: false },
      { direction: 'inbound' as const, body: 'Thank you! Tuesdays or Thursdays after school would work best. Could you share the next available times?', timestamp: '2026-10-15T17:30:00.000Z', unread: true },
    ]
    return {
      ...personThread(person), id: `preview-email:${person.id}`, channel: 'email', subject, unread: true,
      messages: messages.map((message, index) => ({
        ...message, id: `preview-email:${person.id}:${index}`, channel: 'email', subject, simulated: true,
        time: new Date(message.timestamp).toLocaleString('en-US'),
        emailTo: [message.direction === 'inbound' ? 'preview@example.com' : person.email], emailCc: [],
      })),
    }
  })
}