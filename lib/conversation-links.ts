import type { ConversationPerson } from '@/lib/conversations-live'

export type ConversationChannel = 'sms' | 'email'

export function conversationComposeHref(tenant: string, recipient: string, channel: ConversationChannel) {
  return `/dashboard/inbox?${new URLSearchParams({ tenant, recipient, channel, compose: '1' })}`
}

/** IDs only: never trust a routing address supplied in a URL. */
export function resolveConversationRecipient(people: ConversationPerson[], recipient: string) {
  return people.find(person => person.id === recipient || person.aliases?.includes(recipient))
}