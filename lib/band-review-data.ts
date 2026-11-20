import Papa from 'papaparse'

type Row = Record<string, string>
const parse = (text: string) => Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: name => name.trim() }).data
const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const label = (value?: string) => value?.trim() || 'Not recorded'

export function assembleBandReview(attendance: string, subscriptions: string, interest: string) {
  const lessons = parse(attendance)
  const plans = parse(subscriptions)
  const candidates = parse(interest).filter(row => row.Name?.trim())
  const aliases: Record<string, string> = { ralpwalton: 'Ralph Walton', liefbryant: 'Leif Bryant', adaincavanna: 'Aiden Cavanna', lodnynmorris: 'Londyn Morris', ignaciodelagdo: 'Ignacio Delgado' }
  const names = new Map<string, Map<string, string>>()
  for (const row of [...lessons, ...plans]) {
    if (!row['Client Name'] || !row['Client Id']) continue
    const lookup = key(row['Client Name'])
    const matches = names.get(lookup) ?? new Map()
    matches.set(row['Client Id'], row['Client Name'])
    names.set(lookup, matches)
  }
  const pool = candidates.map((row, index) => {
    const sourceName = row.Name.trim()
    const corrected = aliases[key(sourceName)]
    const matches = names.get(key(corrected || sourceName))
    const matchedId = matches?.size === 1 ? [...matches.keys()][0] : undefined
    return { id: `candidate-${index}`, name: matchedId ? matches!.get(matchedId)! : sourceName, sourceName,
      age: label(row.Age), instrument: label(row.Instrument),
      placementReported: key(row['Placed in a band'] || '') === 'yes',
      bands: matchedId ? [...new Set(plans.filter(plan => plan['Client Id'] === matchedId && plan.Status === 'Active' && plan['Service Name'] === 'Band (60 min)' && plan.Class).map(plan => plan.Class))] : [] }
  })
  // Each filled cell describes an independent possible grouping for its row;
  // column number alone does not connect unrelated students across rows.
  const proposals = candidates.flatMap((row, i) => Array.from({ length: 5 }, (_, index) => {
    const entry = Object.entries(row).find(([column]) => key(column) === `potentialband${index + 1}`)?.[1]?.trim()
    if (!entry) return null
    const related = pool.filter(candidate => key(candidate.sourceName) === key(entry) || key(candidate.name.split(' ')[0]) === key(entry) || key(candidate.name) === key(entry))
    return { id: `potential-${i + 1}-${index + 1}`, name: `Potential Band ${index + 1} · ${pool[i].name}`, candidateIds: [...new Set([pool[i].id, ...(related.length === 1 ? [related[0].id] : [])])] }
  }).filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null))
  const openings = [...new Set(candidates.map(row => row['Free times for bands']?.trim()).filter(Boolean))]
    .map(entry => { const [window, teacher] = entry.split(/\s+with\s+/i); return { window, teacher: teacher || 'Not recorded' } })
  const members = [...new Map(plans.filter(row => row.Class === 'SunKast' && row.Status === 'Active' && row['Service Name'] === 'Band (60 min)').map(row => [row['Client Id'], row])).values()]
    .map(row => {
      const sessions = lessons.filter(lesson => lesson['Client Id'] === row['Client Id'] && lesson['Appt/Class Name'] === 'SunKast')
      return { name: row['Client Name'], instructor: row['Primary Staff Name'], attended: sessions.filter(item => item.Attendance === 'Attended').length,
        missed: sessions.filter(item => item.Attendance === 'No show').length }
    }).sort((a, b) => a.name.localeCompare(b.name))
  const rooms = [...new Set(lessons.filter(row => row['Appt/Class Name'] === 'SunKast' && row.Room).map(row => row.Room))]
  return { members, rooms, pool, proposals, openings }
}

export type BandReviewData = ReturnType<typeof assembleBandReview>