export const COMMUNICATION_TIME_ZONE = 'America/Los_Angeles'

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMMUNICATION_TIME_ZONE,
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
})
const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMMUNICATION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Explicit Pacific time on server and client; stored instants remain unchanged. */
export function formatCommunicationTimestamp(value: string | number): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : timestampFormatter.format(date)
}

export function communicationCalendarDay(date: Date): number {
  const parts = dayFormatter.formatToParts(date)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return Date.UTC(value('year'), value('month') - 1, value('day')) / 86400000
}