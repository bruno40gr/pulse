import type { LiveThread } from '@/lib/conversations-live'

/** A database page can split a thread; never replace its earlier message page. */
export function mergeEmailPages(current: LiveThread[], page: LiveThread[]) {
  const merged = new Map(current.map(thread => [thread.id, thread]))
  for (const thread of page) {
    const previous = merged.get(thread.id)
    const messages = [...new Map([...(previous?.messages || []), ...thread.messages].map(message => [message.id, message])).values()]
      .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    merged.set(thread.id, { ...thread, messages, unread: messages.some(message => message.unread) })
  }
  return [...merged.values()]
}