/** Read-only planning for existing-student opportunities. This does not create records. */
export type OpportunityStudent = { id: string; tenant_id: string; first_name: string; last_name: string; student_id: string | null }
export type ExistingStudentOpportunity = { id: string; tenant_id: string; student_person_id: string; service_key: string; status: string }

export function planStudentOpportunities(input: {
  tenantId: string
  personIds: string[]
  students: OpportunityStudent[]
  existing: ExistingStudentOpportunity[]
  serviceKey: string
}) {
  const serviceKey = input.serviceKey.trim().toLowerCase()
  if (!input.tenantId || !serviceKey || !input.personIds.length || new Set(input.personIds).size !== input.personIds.length) throw new Error('Invalid opportunity selection.')
  if (input.students.some(row => row.tenant_id !== input.tenantId) || input.existing.some(row => row.tenant_id !== input.tenantId)) throw new Error('Invalid account data.')
  return input.personIds.map(personId => {
    const people = input.students.filter(row => row.id === personId)
    if (people.length !== 1 || !people[0].student_id) return { personId, decision: 'invalid_student' as const, opportunityIds: [] as string[] }
    const matches = input.existing.filter(row => row.student_person_id === personId && row.service_key.trim().toLowerCase() === serviceKey && !['won', 'lost', 'ghosted_us', 'ghosted', 'spam'].includes(row.status))
    return { personId, decision: matches.length ? 'review_existing' as const : 'eligible' as const, opportunityIds: matches.map(row => row.id) }
  })
}