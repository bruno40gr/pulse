import evidence from './holder-display-identity-evidence.json'

/** Reviewed opaque source IDs only. Display identity is NOT a messaging grant. */
export function holderDisplayPersonId(tenantId: string, accountId: string, people: { id: string; tenant_id: string; custom_fields?: { external_id?: string } }[]) {
  if (tenantId !== evidence.tenant_id) return undefined
  const source = evidence.accounts.find(row => row.account_id === accountId)?.source_person_id
  if (!source) return undefined
  const matches = people.filter(person => person.tenant_id === tenantId && person.custom_fields?.external_id === source)
  return matches.length === 1 ? matches[0].id : undefined
}