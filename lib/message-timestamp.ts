/** Display message dates in the viewer's local timezone, without seconds. */
export function formatMessageTimestamp(timestamp: string, now = new Date()): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const elapsed = now.getTime() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return 'A moment ago'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const sameDay = (other: Date) => date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate()
  const day = sameDay(now) ? 'Today' : sameDay(yesterday) ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}