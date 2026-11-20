/**
 * Band roster assembly from imported enrollments.
 *
 * Imported rows put the instrument *track* in `band_name` ("Drums 101",
 * "Voice 101") and the actual band in `session_name`. A name is only a band when
 * it is not an instrument track, so mislabelled rows are re-grouped onto the
 * real band instead of inventing one band per instrument.
 */
export type RosterRow = {
  band_name: string | null
  session_name: string | null
  member_id: string | null
  member_name: string | null
  member_status: string | null
  coach_id: string | null
  coach_name: string | null
}
export type BandMember = { person_id: string; name: string }
export type Band = { name: string; coach: string | null; members: BandMember[] }

const INSTRUMENT_TRACK = /^(bass|drums?|guitar|voice|vocals?|piano|keys|keyboard|percussion|alto|tenor|trumpet|trombone|violin|flute|clarinet|ukulele|cello)\b[\s\S]*?\d/i
const LESSON_SESSION = /\b(level|lesson|private|semi-private|group|class)\b/i

const clean = (value: string | null) => (value || '').trim()

/** "Drums 101" is an instrument track, not an ensemble. */
export function isInstrumentTrack(value: string | null): boolean {
  const name = clean(value)
  return Boolean(name) && INSTRUMENT_TRACK.test(name)
}

/** Band names are the labelled names that are not instrument tracks. */
export function knownBandNames(rows: RosterRow[]): Set<string> {
  return new Set(rows.map(row => clean(row.band_name)).filter(name => name && !isInstrumentTrack(name)))
}

/** Prefer the candidate that is a known band; never promote a lesson session. */
export function bandNameFor(row: RosterRow, known: Set<string>): string | null {
  const candidates = [clean(row.session_name), clean(row.band_name)].filter(Boolean)
  const band = candidates.find(name => known.has(name))
  if (band) return band
  const untracked = candidates.find(name => !isInstrumentTrack(name) && !LESSON_SESSION.test(name))
  return untracked || null
}

export function assembleBandRoster(rows: RosterRow[]): Band[] {
  const known = knownBandNames(rows)
  const bands = new Map<string, Map<string, BandMember>>()
  const coaches = new Map<string, Set<string>>()
  const add = (band: string, member: BandMember) => {
    const members = bands.get(band) || new Map<string, BandMember>()
    if (!members.has(member.person_id)) members.set(member.person_id, member)
    bands.set(band, members)
  }
  for (const row of rows) {
    const band = bandNameFor(row, known)
    if (!band) continue
    if (row.member_id && row.member_name) {
      add(band, { person_id: row.member_id, name: row.member_name })
    }
    // A coach is staff, not a member: it is reported separately so an
    // instructor who plays is listed as a member and one who only coaches is not.
    if (row.coach_name) {
      const names = coaches.get(band) || new Set<string>()
      names.add(row.coach_name)
      coaches.set(band, names)
    }
  }
  return [...bands.entries()].map(([name, members]) => ({
    name,
    coach: [...(coaches.get(name) || [])].sort().join(', ') || null,
    members: [...members.values()].sort((left, right) => left.name.localeCompare(right.name)),
  })).sort((left, right) => left.name.localeCompare(right.name))
}
