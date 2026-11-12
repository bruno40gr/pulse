type SummaryInput = { actor_name: string; title: string; body: string | null; link: string }

export function notificationSummary(item: SummaryInput): string {
  const parts = item.actor_name.trim().split(/\s+/).filter(Boolean)
  const actor = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || 'Someone'
  const isReply = /reply|comment/i.test(item.title)
  const place = item.link.startsWith('/dashboard/notes')
    ? isReply ? 'a sticky note comment' : 'a sticky note'
    : item.link.startsWith('/dashboard/leads') ? 'a lead contact card'
      : item.link.startsWith('/dashboard/contacts') ? 'a contact card' : 'a note'
  const action = /new reply/i.test(item.title) ? `replied to ${place}` : `mentioned you in ${place}`
  const body = item.body?.replace(/\u00a0/g, ' ').trim()
  return `${actor} ${action}${body ? `: “${body.slice(0, 120)}${body.length > 120 ? '…' : ''}”` : ''}`
}