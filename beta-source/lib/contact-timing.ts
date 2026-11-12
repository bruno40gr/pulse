/** Calendar-day grouping follows lead inbound activity, with elapsed hours today. */
export function formatContactTiming(value: string | number | null | undefined, now = new Date()): string {
  if (!value) return 'Not contacted yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const start = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const dayDifference = Math.round((start(now) - start(date)) / 86400000)
  const hours = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 3600000)
  if (dayDifference === 0 && hours === 0) return 'A moment ago'
  if (dayDifference === 0 && hours < 12) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (dayDifference === 0) return 'Today'
  if (dayDifference === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}