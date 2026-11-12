export const NOTE_COLORS: Record<string, string> = {
  yellow: '#FEF08A', orange: '#FED7AA', pink: '#FBCFE8', purple: '#DDD6FE',
  blue: '#BFDBFE', green: '#BBF7D0', gray: '#E5E7EB', white: '#FFFFFF',
}

const DAILY_COLORS = ['yellow', 'orange', 'pink', 'purple', 'blue', 'green']

export function getDailyNoteColor(date = new Date()): string {
  // Local calendar date with UTC arithmetic avoids daylight-saving drift.
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  return DAILY_COLORS[((day % DAILY_COLORS.length) + DAILY_COLORS.length) % DAILY_COLORS.length]
}

export function getNoteBackground(color: string, completed: boolean): string {
  const hex = NOTE_COLORS[color] || NOTE_COLORS.white
  if (!completed) return hex
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  return `rgba(${rgb.join(', ')}, 0.2)`
}