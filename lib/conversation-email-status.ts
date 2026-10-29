export function conversationEmailStatus(state: string) {
  if (!state || state === 'complete') return ''
  if (state === 'reconnect') return 'Reconnect the academy mailbox in Settings to resume email updates.'
  if (state === 'delayed') return 'Email sync is delayed. Retrying automatically; saved emails remain available.'
  if (state === 'stale') return 'Email updates are behind. Saved emails remain available while background sync catches up.'
  return 'Importing email history for this date range. Saved emails appear as they are imported.'
}