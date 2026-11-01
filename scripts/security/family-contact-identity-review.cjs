/* Review suggestions only. Names and destinations never authorize a merge. */
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : ''
const phone = value => {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.length === 10 ? digits : ''
}
function reviewContactIdentities({ tenantId, preview, people, clients }) {
  if (!tenantId || preview.metadata?.tenantId !== tenantId || people.some(person => person.tenant_id !== tenantId)) throw Error('Tenant scope mismatch')
  const seen = new Set()
  const reviews = preview.contacts.map(contact => {
    if (!contact.sourcePersonId || seen.has(contact.sourcePersonId)) throw Error('Duplicate or missing source identity')
    seen.add(contact.sourcePersonId)
    const sources = clients.filter(row => row.Id === contact.sourcePersonId)
    const exact = people.filter(person => person.custom_fields?.external_id === contact.sourcePersonId)
    if (sources.length !== 1 || exact.length > 1) return { sourcePersonId: contact.sourcePersonId, disposition: 'blocked_identity_conflict', candidates: [] }
    const source = sources[0]
    const names = new Set([source['Full Name'], ...contact.names].map(normalize).filter(Boolean))
    const email = normalize(source.Email)
    const phones = new Set(['Phone 1', 'Phone 2', 'Phone 3', 'Primary Phone'].map(key => phone(source[key])).filter(Boolean))
    const candidates = people.flatMap(person => {
      const evidence = []
      if (names.has(normalize(`${person.first_name || ''} ${person.last_name || ''}`))) evidence.push('same_normalized_name')
      if (email && email === normalize(person.email)) evidence.push('same_email')
      if (phone(person.phone) && phones.has(phone(person.phone))) evidence.push('same_phone')
      if (!evidence.length || person.id === exact[0]?.id) return []
      return [{ personId: person.id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim(), evidence,
        existingSourceId: person.custom_fields?.external_id || null,
        interpretation: person.custom_fields?.external_id ? 'distinct_source_identity_shared_details_not_a_merge' : 'manual_identity_review_required' }]
    })
    const unresolved = candidates.filter(candidate => !candidate.existingSourceId)
    return { sourcePersonId: contact.sourcePersonId, sourceName: source['Full Name'],
      disposition: exact.length === 1 ? 'reuse_exact_source_identity' : unresolved.length ? 'review_existing_people_without_source_id' : 'creation_candidate_no_unkeyed_overlap_found',
      exactPersonId: exact[0]?.id || null, candidates,
      automaticMerge: false, creationAuthorized: false,
    }
  })
  return { metadata: { tenantId, reviewOnly: true }, limitations: [
    'A same-name, email or phone match is not proof of identity.',
    'No candidate is merged, created or authorized by this review.',
    'Different source IDs remain distinct; shared family destinations are normal.',
    'The older export cannot establish whether current contact details changed.',
  ], summary: Object.fromEntries([...new Set(reviews.map(row => row.disposition))].map(key => [key, reviews.filter(row => row.disposition === key).length])), contacts: reviews }
}
module.exports = { reviewContactIdentities }