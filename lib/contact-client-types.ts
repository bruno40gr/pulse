import { SERVICE_TYPE_OPTIONS } from './lead-value'

/** Lesson intake plus the same service catalog used by lead intake. */
export const CONTACT_CLIENT_TYPES = ['Lessons', ...SERVICE_TYPE_OPTIONS.map(option => option.label)]
export type ContactClientType = typeof CONTACT_CLIENT_TYPES[number]

// Preserve matches for the earlier prototype labels without writing contact records.
const legacyLabels: Record<string, string> = {
  'Rehearsal space': 'Rehearsal room',
  'Studio recording': 'Recording studio',
  'Birthday party': 'Private events & parties',
}

/** Match any selected service; other contact filter conditions still combine with AND. */
export function matchesClientTypes(storedTypes: unknown, selectedTypes: string): boolean {
  const selected = selectedTypes.split('|').filter(Boolean)
  return selected.length === 0 || (Array.isArray(storedTypes) && selected.some(type => storedTypes.some(stored =>
    typeof stored === 'string' && (legacyLabels[stored] || stored) === (legacyLabels[type] || type),
  )))
}