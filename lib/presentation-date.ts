// Match the browser-local calendar convention used by notes and inbox.
// UTC arithmetic on local date parts avoids 23/25-hour daylight-saving days.
function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

export function formatPresentationDate(timestamp: string, now = new Date()): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(timestamp)
  const date = dateOnly ? new Date(`${timestamp}T00:00:00`) : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const daysAgo = calendarDay(now) - calendarDay(date)
  if (daysAgo === 0 && !dateOnly) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .replace(/\s/g, '').toLowerCase()
  }
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo === 2) return '2 days ago'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatFullTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}