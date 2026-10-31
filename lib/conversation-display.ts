import type { LiveThread } from '@/lib/conversations-live'

export const PROFILE_PANEL_WIDTH = 'min(75vw, 960px)'
export const CONVERSATIONS_HOME_EVENT = 'pulse:conversations-home'
export type ConversationSort = 'name' | 'time' | 'date'
export type ConversationFilter = 'all' | 'sms' | 'email'

/** Project the displayed audience before calculating attention, dates and ordering. */
export function filterConversationChannels<T extends { email?: string; threads: LiveThread[]; newSms: number; newEmails: number }>(people: T[], channel: ConversationFilter): T[] {
  if (channel === 'all') return people
  return people.flatMap(person => {
    const threads = person.threads.filter(thread => thread.channel === channel && thread.messages.length > 0)
    // Email history loads on demand. Do not hide its entry point just because
    // the mailbox summary has not reached this contact's older threads yet.
    return threads.length || (channel === 'email' && person.email?.trim()) ? [{ ...person, threads, newSms: channel === 'sms' ? person.newSms : 0, newEmails: channel === 'email' ? person.newEmails : 0 }] : []
  })
}

/** Reading does not attend a conversation; only a subsequent outbound reply does. */
export function conversationAttention(threads: LiveThread[]) {
  const pending = threads.filter(thread => thread.messages.at(-1)?.direction === 'inbound')
  return {
    unattended: pending.length > 0,
    unread: pending.some(thread => thread.messages.some(message => message.direction === 'inbound' && message.unread)),
    channels: Array.from(new Set(pending.map(thread => thread.channel))),
  }
}

export function lastContactTimestamp(threads: LiveThread[]): string {
  const latest = threads.flatMap(thread => thread.messages).reduce((latest, message) => {
    const timestamp = message.timestamp ? Date.parse(message.timestamp) : NaN
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest
  }, 0)
  return latest ? new Date(latest).toISOString() : ''
}

export function newestEmail(threads: LiveThread[]): LiveThread | undefined {
  return threads.filter(thread => thread.messages.length > 0).slice().sort((a, b) => lastContactTimestamp([b]).localeCompare(lastContactTimestamp([a])))[0]
}

export function compareConversations(a: { name: string; threads: LiveThread[] }, b: { name: string; threads: LiveThread[] }, sort: ConversationSort, direction: 'asc' | 'desc') {
  const left = lastContactTimestamp(a.threads)
  const right = lastContactTimestamp(b.threads)
  // Unknown dates stay at the bottom in either direction.
  if (sort !== 'name' && (!left || !right)) return left ? -1 : right ? 1 : a.name.localeCompare(b.name)
  const value = sort === 'name' ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    : sort === 'date' ? left.slice(0, 10).localeCompare(right.slice(0, 10))
      : left.localeCompare(right)
  return (direction === 'asc' ? value : -value) || a.name.localeCompare(b.name)
}