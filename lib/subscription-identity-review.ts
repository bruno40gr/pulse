import Papa from 'papaparse'

type Person = { id: string; custom_fields: Record<string, unknown> | null }
type Student = { id: string; person_id: string }
type Row = Record<string, string>

/** Compare source IDs only. A missing or ambiguous identity is never an instruction to create a person. */
export function reviewSubscriptionIdentities(csv: string, people: Person[], students: Student[]) {
  const parsed = Papa.parse<Row>(csv, { header: true, skipEmptyLines: 'greedy', transformHeader: name => name.trim() })
  if (parsed.errors.length || !['Client Id', 'Client Name', 'Status'].every(field => parsed.meta.fields?.includes(field))) throw new Error('Invalid subscription export')
  const source = new Map<string, Row[]>()
  for (const row of parsed.data) {
    if (!['active', 'pending'].includes((row.Status || '').trim().toLowerCase())) continue
    const id = (row['Client Id'] || '').trim()
    if (!id) throw new Error('Subscription client ID missing')
    source.set(id, [...(source.get(id) || []), row])
  }
  const matches = [...source].map(([sourceId, rows]) => {
    const persons = people.filter(person => person.custom_fields?.external_id === sourceId)
    const studentRows = persons.length === 1 ? students.filter(student => student.person_id === persons[0].id) : []
    const resolution = persons.length === 0 ? 'no_person' : persons.length > 1 ? 'duplicate_person' : studentRows.length === 0 ? 'no_student' : studentRows.length > 1 ? 'duplicate_student' : 'matched'
    return { sourceId, names: [...new Set(rows.map(row => (row['Client Name'] || '').trim()).filter(Boolean))], resolution, subscriptionCount: rows.length }
  })
  return { clients: matches.length, subscriptions: matches.reduce((sum, row) => sum + row.subscriptionCount, 0),
    counts: Object.fromEntries(['matched', 'no_person', 'duplicate_person', 'no_student', 'duplicate_student'].map(key => [key, matches.filter(row => row.resolution === key).length])),
    review: matches.filter(row => row.resolution !== 'matched') }
}