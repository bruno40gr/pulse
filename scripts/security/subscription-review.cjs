/* Pure review only: no database access, mutations, or executable import operations. */
const value = item => typeof item === 'string' ? item.trim() : ''

function reviewSubscriptions({ tenantId, people, students, subscriptions }) {
  if ([...people, ...students].some(row => row.tenant_id !== tenantId)) throw Error('Foreign or missing tenant')
  const byExternal = new Map()
  for (const person of people) {
    const key = value(person.custom_fields?.external_id)
    if (key) byExternal.set(key, [...(byExternal.get(key) || []), person])
  }
  const byPerson = new Map()
  for (const student of students) byPerson.set(student.person_id, [...(byPerson.get(student.person_id) || []), student])
  const groups = new Map()
  for (const row of subscriptions) {
    if (!['active', 'pending'].includes(value(row.Status).toLowerCase())) continue
    const id = value(row['Client Id'])
    const key = id || `missing:${groups.size}`
    groups.set(key, [...(groups.get(key) || []), row])
  }
  const clients = [...groups.values()].map(rows => {
    const id = value(rows[0]['Client Id'])
    const matches = id ? byExternal.get(id) || [] : []
    const studentMatches = matches.length === 1 ? byPerson.get(matches[0].id) || [] : []
    const resolution = !id ? 'missing_source_id' : matches.length === 0 ? 'no_person_by_source_id' : matches.length > 1 ? 'duplicate_source_id' : studentMatches.length === 0 ? 'person_without_student' : studentMatches.length > 1 ? 'multiple_student_records' : 'unique_student_by_source_id'
    return { sourceId: id, names: [...new Set(rows.map(row => value(row['Client Name'])).filter(Boolean))], resolution,
      subscriptions: rows.map(row => ({ status: value(row.Status), service: value(row['Service Name']), plan: value(row['Plan Name']), instructor: value(row['Primary Staff Name']) })) }
  })
  return { clients, summary: { clients: clients.length, rows: clients.reduce((sum, row) => sum + row.subscriptions.length, 0),
    resolutions: Object.fromEntries([...new Set(clients.map(row => row.resolution))].map(key => [key, clients.filter(row => row.resolution === key).length])) } }
}
module.exports = { reviewSubscriptions }

/** One-way diagnostic using a tenant-scoped aggregate snapshot; no phone fields. */
function compareIdentityCounts(subscriptions, counts) {
  const clients = new Map()
  for (const row of subscriptions) {
    if (!['active', 'pending'].includes(value(row.Status).toLowerCase())) continue
    const id = value(row['Client Id'])
    if (!id) throw Error('Missing source client ID')
    const current = clients.get(id) || { sourceId: id, names: [], rows: 0 }
    current.names = [...new Set([...current.names, value(row['Client Name'])].filter(Boolean))]
    current.rows++
    clients.set(id, current)
  }
  const byId = new Map()
  for (const entry of counts) {
    if (!value(entry.external_id) || byId.has(entry.external_id) || !Number.isInteger(entry.people_count) || !Number.isInteger(entry.student_count)) throw Error('Invalid identity snapshot')
    byId.set(entry.external_id, entry)
  }
  const results = [...clients.values()].map(client => {
    const found = byId.get(client.sourceId)
    const resolution = !found ? 'no_person' : found.people_count !== 1 ? 'ambiguous_person' : found.student_count === 0 ? 'no_student' : found.student_count !== 1 ? 'ambiguous_student' : 'matched'
    return { ...client, resolution }
  })
  return { clients: results.length, rows: results.reduce((n, row) => n + row.rows, 0),
    counts: Object.fromEntries(['matched', 'no_person', 'ambiguous_person', 'no_student', 'ambiguous_student'].map(key => [key, results.filter(row => row.resolution === key).length])),
    review: results.filter(row => row.resolution !== 'matched') }
}
module.exports.compareIdentityCounts = compareIdentityCounts