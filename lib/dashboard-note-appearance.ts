/** Dashboard Notes palette; shared contact and lead note surfaces are unchanged. */
export const NOTE_COLORS: Record<string, string> = {
  yellow: '#FFE299', orange: '#FFD3A6', pink: '#FFD0E5', purple: '#DDD6FE',
  blue: '#CBE5FF', green: '#BAEDC8', gray: '#E5E7EB', white: '#FFFFFF',
}

export const NOTE_INK = '#29231B'
export const NOTE_MUTED_INK = '#504638'

export function noteBackground(color: string, completed = false, focused = false): string {
  const hex = NOTE_COLORS[color] || NOTE_COLORS.white
  // Darken toward the same hue, not muddy gray/brown. Completed notes stay readable.
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
  const channels = rgb.map(channel => completed ? Math.round(channel + (255 - channel) * 0.5) : focused ? Math.round(channel * 0.96) : channel)
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}