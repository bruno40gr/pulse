/** Service relationships may overlap; these are not acquisition sources or enrollment statuses. */
export const CONTACT_CLIENT_TYPES = ['Lessons', 'Rehearsal space', 'Event attendee', 'Birthday party', 'Studio recording'] as const
export type ContactClientType = typeof CONTACT_CLIENT_TYPES[number]

/** Match any selected service; other contact filter conditions still combine with AND. */
export function matchesClientTypes(storedTypes: unknown, selectedTypes: string): boolean {
  const selected = selectedTypes.split('|').filter(Boolean)
  return selected.length === 0 || (Array.isArray(storedTypes) && selected.some(type => storedTypes.includes(type)))
}