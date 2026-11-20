import { readLeadStudents } from '@/lib/lead-students'

export type ReconciliationCandidate = { id: string; name: string; sourceName: string }
export type ReconciliationPerson = { id: string; first_name: string | null; last_name: string | null }
export type ReconciliationOpportunity = { id: string; payload: Record<string, unknown> | null; program_label: string | null }

const nameKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

/** Names only produce review suggestions, never verified links or authorization to write. */
export function reconcileBandCandidates(candidates: ReconciliationCandidate[], people: ReconciliationPerson[], opportunities: ReconciliationOpportunity[]) {
  const personIndex = new Map<string, ReconciliationPerson[]>()
  for (const person of people) {
    const key = nameKey([person.first_name, person.last_name].filter(Boolean).join(' '))
    if (key) personIndex.set(key, [...(personIndex.get(key) || []), person])
  }
  const opportunityIndex = new Map<string, Set<string>>()
  for (const opportunity of opportunities) {
    for (const student of readLeadStudents(opportunity.payload || {}, opportunity.program_label)) {
      const key = nameKey(student.name)
      if (!key) continue
      const ids = opportunityIndex.get(key) || new Set<string>()
      ids.add(opportunity.id)
      opportunityIndex.set(key, ids)
    }
  }
  return candidates.map(candidate => {
    const names = [...new Set([nameKey(candidate.name), nameKey(candidate.sourceName)].filter(Boolean))]
    const personIds = [...new Set(names.flatMap(name => (personIndex.get(name) || []).map(person => person.id)))]
    const opportunityIds = [...new Set(names.flatMap(name => [...(opportunityIndex.get(name) || [])]))]
    return { candidateId: candidate.id, personIds, opportunityIds, matchType: 'name_only' as const, requiresReview: true as const }
  })
}