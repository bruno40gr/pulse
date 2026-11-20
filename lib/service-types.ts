import { LESSON_INSTRUMENT_OPTIONS } from './lead-lesson-details'

/**
 * Opus exports carry one service label per enrolment, one service per class, and
 * one per ensemble. Many of those labels stopped meaning anything in Odeon: the
 * delivery mode on its own ("band", "group", "private"), a band's name, or a
 * session with its rehearsal slot glued on ("Rock City - SAT 9:30 AM").
 *
 * Filters and rosters only need the thing being taught, so every stored label is
 * reduced to a canonical service. Anything carrying no service value is dropped
 * rather than offered as a filter option.
 */
const DELIVERY_ONLY = new Set(['band', 'group', 'private', 'semi-private', 'semiprivate', 'semi private', 'lesson', 'lessons', 'makeup', 'make-up', 'trial', 'drop-in'])

const ALIASES: Record<string, string> = {
  voice: 'Voice', vocals: 'Voice', vocal: 'Voice', 'voice & vocals': 'Voice', 'voice and vocals': 'Voice', singing: 'Voice',
  sax: 'Saxophone', 'alto saxophone': 'Saxophone', 'tenor saxophone': 'Saxophone',
  keys: 'Piano', keyboard: 'Piano', keyboards: 'Piano',
  guitar: 'Guitar', bass: 'Bass', 'bass guitar': 'Bass', drums: 'Drums', drumkit: 'Drums', 'drum kit': 'Drums',
  violin: 'Violin', viola: 'Violin', cello: 'Cello', ukulele: 'Ukulele', flute: 'Flute', clarinet: 'Clarinet', trumpet: 'Trumpet', trombone: 'Other', tuba: 'Other',
}

/** Named programs whose instrument is fixed, so the program label is the service. */
const PROGRAMS: { match: RegExp; service: string }[] = [
  { match: /tiny keys|kids n keys|foundations of piano/i, service: 'Piano' },
  { match: /foundations of guitar|little rockers/i, service: 'Guitar' },
  { match: /beat making|songwriting|composition/i, service: 'Other' },
]

const INSTRUMENTS = LESSON_INSTRUMENT_OPTIONS.filter(option => option !== 'Other').sort((a, b) => b.length - a.length)

function tidy(raw: string) {
  return raw.replace(/\s+/g, ' ').trim()
}

function withoutSchedule(label: string) {
  // "… - SAT 9:30 AM", "… - Wednesday @ 5:00 PM", "… - WED 2:30 PM"
  return label.replace(/\s*[-–—]\s*(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b.*$/i, '').trim()
}

function withoutLevel(label: string) {
  return label.replace(/\s*[-–—]\s*level\s*\d+.*$/i, '').replace(/\s*\((group|make-?up|semi-?private)\)\s*$/i, '').trim()
}

export function canonicalServiceType(raw?: string | null): string | null {
  if (!raw) return null
  const label = withoutLevel(withoutSchedule(tidy(raw)))
  if (!label) return null
  const key = label.toLowerCase()
  if (DELIVERY_ONLY.has(key)) return null
  const program = PROGRAMS.find(entry => entry.match.test(label))
  if (program) return program.service
  const alias = ALIASES[key]
  if (alias) return alias
  const instrument = INSTRUMENTS.find(option => new RegExp(`(^|\\W)${option.toLowerCase()}(\\W|$)`, 'i').test(label))
  if (instrument) return instrument
  // A person, band or room name carries no service value.
  return null
}

export function canonicalServiceTypes(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map(canonicalServiceType).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
}

/** True when a stored label means the canonical service, e.g. "Piano - Level 2 (30 min)" for "Piano". */
export function serviceTypeMatches(stored: string | null | undefined, canonical: string) {
  return canonicalServiceType(stored) === canonical
}
