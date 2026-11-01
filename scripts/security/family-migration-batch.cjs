/* Pure guarded batch planner. No live apply transport or executable SQL. */
/* eslint-disable @typescript-eslint/no-require-imports -- Node offline planner. */
const { createHash } = require('node:crypto')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function planFamilyBatch({ preview, identityReview, snapshot, applied = [], identityDecisions = [], relationshipDecisions = [], recipientPolicy = null }) {
  const tenantId = preview.metadata?.tenantId
  if (!tenantId || identityReview.metadata?.tenantId !== tenantId || snapshot.tenantId !== tenantId) throw Error('Tenant mismatch')
  if (recipientPolicy && (recipientPolicy.tenantId !== tenantId || !Array.isArray(recipientPolicy.decisions))) throw Error('Recipient policy tenant mismatch')
  const allowedRelationships = ['sibling', 'parent', 'guardian', 'child', 'self', 'other']
  const relationshipsByStudent = new Map()
  for (const decision of relationshipDecisions) {
    if (decision.tenantId !== tenantId || decision.action !== 'set_holder_relationship' || decision.approvedBy !== 'owner'
      || !decision.studentId || !decision.personId || !allowedRelationships.includes(decision.relationship) || !decision.reason) {
      throw Error('Invalid owner relationship decision')
    }
    const existing = relationshipsByStudent.get(decision.studentId) || []
    if (existing.some(row => row.personId === decision.personId)) throw Error('Duplicate owner relationship decision')
    relationshipsByStudent.set(decision.studentId, [...existing, { personId: decision.personId, relationship: decision.relationship, reason: decision.reason }])
  }
  const policyByStudent = new Map()
  for (const decision of recipientPolicy?.decisions || []) {
    if (policyByStudent.has(decision.studentId)) throw Error('Duplicate recipient policy decision')
    policyByStudent.set(decision.studentId, decision)
  }
  for (const rows of [snapshot.people, snapshot.students, snapshot.accounts]) {
    if (rows.some(row => row.tenant_id !== tenantId)) throw Error('Foreign snapshot row')
  }
  const decisions = new Map()
  const overrides = new Map()
  const targets = new Set()
  for (const decision of identityDecisions) {
    if (decision.tenantId !== tenantId || decision.action !== 'reuse_existing_preserve_details'
      || decision.approvedBy !== 'owner' || !decision.sourcePersonId || !decision.personId || !decision.reason
      || overrides.has(decision.sourcePersonId) || targets.has(decision.personId)) throw Error('Invalid owner identity decision')
    overrides.set(decision.sourcePersonId, decision)
    targets.add(decision.personId)
  }
  for (const row of identityReview.contacts) {
    if (decisions.has(row.sourcePersonId)) throw Error('Duplicate identity review')
    decisions.set(row.sourcePersonId, row)
  }
  for (const sourceId of overrides.keys()) {
    if (!preview.contacts.some(row => row.sourcePersonId === sourceId)) throw Error('Owner decision outside preview')
  }
  const operations = [], deferred = []
  const add = (kind, key, expected, proposal) => {
    const operation = { tenantId, kind, key, expected, proposal }
    const fingerprint = digest(operation)
    const prior = applied.filter(row => row.tenantId === tenantId && row.key === key)
    if (prior.length > 1 || prior.some(row => row.fingerprint !== fingerprint)) throw Error('Previously applied operation differs')
    if (!prior.length) operations.push({ ...operation, fingerprint })
  }
  const available = new Set()
  const resolvedPersonBySource = new Map()
  for (const contact of preview.contacts) {
    const review = decisions.get(contact.sourcePersonId)
    const override = overrides.get(contact.sourcePersonId)
    let resolvedPersonId = null
    if (override) {
      const target = snapshot.people.filter(row => row.id === override.personId)
      const candidate = review?.candidates?.find(row => row.personId === override.personId && !row.existingSourceId)
      if (review?.disposition !== 'review_existing_people_without_source_id' || !candidate
        || target.length !== 1 || target[0].custom_fields?.external_id) throw Error('Owner decision target changed; refresh review')
      resolvedPersonId = override.personId
    }
    if (!override && (!review || !['reuse_exact_source_identity', 'creation_candidate_no_unkeyed_overlap_found'].includes(review.disposition))) {
      deferred.push({ sourcePersonId: contact.sourcePersonId, reason: 'manual_identity_review' }); continue
    }
    const exact = snapshot.people.filter(row => row.custom_fields?.external_id === contact.sourcePersonId)
    if (override) {
      if (exact.length) throw Error('Owner decision source identity changed; refresh review')
    } else if (review.disposition === 'reuse_exact_source_identity') {
      if (exact.length !== 1 || exact[0].id !== review.exactPersonId) throw Error('Live identity changed since review')
    } else if (exact.length) throw Error('Creation candidate already has a live identity; refresh review')
    available.add(contact.sourcePersonId)
    resolvedPersonBySource.set(contact.sourcePersonId, resolvedPersonId || exact[0]?.id || null)
    add('identity_resolution', `source-person:${contact.sourcePersonId}`, {
      matchingPersonIds: exact.map(row => row.id),
      ...(override ? { ownerSelectedPersonId: resolvedPersonId, selectedPersonExternalId: null } : {}),
    }, {
      sourcePersonId: contact.sourcePersonId, personId: resolvedPersonId || exact[0]?.id || null,
      action: override || exact.length ? 'reuse_existing_person' : 'stage_contact_creation_candidate',
      ...(override ? { identityDecision: override, preserveExistingDetails: true, preserveExistingRoles: true } : {}),
      activation: 'requires_transactional_writer_and_source_record_validation',
    })
  }
  for (const student of preview.students) {
    if (student.status !== 'proposed') { deferred.push({ studentId: student.studentId, reason: 'preview_blocked' }); continue }
    const live = snapshot.students.filter(row => row.id === student.studentId)
    const account = snapshot.accounts.filter(row => row.id === student.accountId)
    const person = snapshot.people.filter(row => row.id === student.personId)
    if (live.length !== 1 || account.length !== 1 || person.length !== 1
      || live[0].person_id !== student.personId || live[0].account_id !== student.accountId
      || person[0].custom_fields?.external_id !== student.sourceClientId) throw Error('Student/account identity changed; refresh preview')
    if (student.proposedManagerSourceIds.some(id => !available.has(id))) {
      deferred.push({ studentId: student.studentId, reason: 'manager_identity_review_pending' }); continue
    }
    const managerPersonIds = new Set(student.proposedManagerSourceIds.map(id => resolvedPersonBySource.get(id)).filter(Boolean))
    const holderRelationships = relationshipsByStudent.get(student.studentId) || []
    if (holderRelationships.some(row => !managerPersonIds.has(row.personId))) {
      throw Error('Owner relationship target is not a resolved manager for the student')
    }
    add('student_contact_plan', `student:${student.studentId}`, {
      personId: live[0].person_id, accountId: live[0].account_id,
      sourceClientId: person[0].custom_fields.external_id,
    }, {
      accountId: student.accountId, managerSourceIds: [...student.proposedManagerSourceIds].sort(),
      routing: student.proposedRouting, reason: student.routingReason,
      recipientPolicyStatus: policyByStudent.get(student.studentId)?.status || 'unclassified',
      holderRelationships,
      relationshipSource: holderRelationships.length ? 'owner_confirmed' : 'not_asserted',
      ageVerified: false, updateMinorFlag: false, primary: null,
      preserveStudentAndInstructorRoles: true, activateMessaging: false,
    })
  }
  operations.sort((a, b) => a.key.localeCompare(b.key))
  const recipientPolicyStatuses = {}
  for (const operation of operations.filter(row => row.kind === 'student_contact_plan')) {
    const status = operation.proposal.recipientPolicyStatus
    recipientPolicyStatuses[status] = (recipientPolicyStatuses[status] || 0) + 1
  }
  return { tenantId, mode: 'rehearsal_plan_only', operations, deferred,
    batchFingerprint: digest(operations),
    recipientPolicyStatuses,
    summary: { identityPlans: operations.filter(row => row.kind === 'identity_resolution').length,
      studentPlans: operations.filter(row => row.kind === 'student_contact_plan').length,
      deferred: deferred.length, liveWrites: 0 },
    gates: ['No live writer implemented', 'No consent, primary or age inference',
      'Recipient destination status is recorded, never auto-approved for sending',
      'Student-specific contact links need a tenant-validated schema before activation',
      'Revalidate identity, destination, opt-out and routing provenance before messaging'],
  }
}
module.exports = { planFamilyBatch }