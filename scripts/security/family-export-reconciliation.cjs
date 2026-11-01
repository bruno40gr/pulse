/* Read-only, pure reconciliation. Source IDs are opaque; names never establish identity. */
const text = value => typeof value === 'string' ? value.trim() : ''
const unique = values => [...new Set(values.filter(Boolean))].sort()
const index = (rows, key) => {
  const result = new Map()
  for (const row of rows) {
    const id = key(row)
    if (id) result.set(id, [...(result.get(id) || []), row])
  }
  return result
}

function reconcileFamilies({ tenantId, people, students, accounts, enrollments, clients, attendance, subscriptions }) {
  for (const rows of [people, students, accounts, enrollments]) {
    if (rows.some(row => row.tenant_id !== tenantId)) throw Error('Foreign or missing tenant in live snapshot')
  }
  const personById = index(people, row => row.id)
  const personByExternal = index(people, row => text(row.custom_fields?.external_id))
  const clientById = index(clients, row => text(row.Id))
  const attendanceById = index(attendance, row => text(row['Client Id']))
  const subscriptionById = index(subscriptions, row => text(row['Client Id']))
  const enrollmentByStudent = index(enrollments, row => row.student_id)
  const accountById = index(accounts, row => row.id)
  const sourcePerson = id => {
    const records = clientById.get(id) || []
    const live = personByExternal.get(id) || []
    return { sourceId: id, sourceName: records.length === 1 ? text(records[0]['Full Name']) : null,
      sourceRecordCount: records.length, livePersonIds: live.map(row => row.id),
      resolution: live.length === 1 ? 'one_live_person_by_source_id' : live.length > 1 ? 'duplicate_live_source_id' : 'no_live_person_by_source_id' }
  }
  const managerEvidence = (rows, source) => {
    const holders = new Map()
    const issues = []
    const signatures = []
    for (const row of rows) {
      const ids = []
      for (const slot of [1, 2]) {
        const id = text(row[`AccountManager ${slot} id`])
        const name = text(row[`AccountManager ${slot} name`])
        if (!id) { if (name) issues.push('manager_name_without_source_id'); continue }
        ids.push(id)
        const value = holders.get(id) || { ...sourcePerson(id), slots: [], names: [], emails: [], phones: [] }
        value.slots = unique([...value.slots, String(slot)])
        value.names = unique([...value.names, name])
        value.emails = unique([...value.emails, text(row[`AccountManager ${slot} email`])])
        value.phones = unique([...value.phones, text(row[`AccountManager ${slot} phone 1`]), text(row[`AccountManager ${slot} phone 2`])])
        holders.set(id, value)
      }
      signatures.push(unique(ids).join('|'))
    }
    return { source, rows: rows.length, managers: [...holders.values()],
      observedManagerSets: unique(signatures.map(signature => signature || '(none)')),
      issues: unique(issues) }
  }
  const studentReports = students.map(student => {
    const flags = []
    const linkedPeople = personById.get(student.person_id) || []
    const person = linkedPeople.length === 1 ? linkedPeople[0] : null
    if (!person) flags.push('missing_or_duplicate_live_person')
    const sourceId = text(person?.custom_fields?.external_id)
    if (!sourceId) flags.push('missing_source_client_id')
    if (sourceId && personByExternal.get(sourceId)?.length !== 1) flags.push('duplicate_live_source_id')
    const clientRows = sourceId ? clientById.get(sourceId) || [] : []
    if (clientRows.length !== 1) flags.push(clientRows.length ? 'duplicate_source_client_id' : 'missing_source_client_record')
    const clientEvidence = managerEvidence(clientRows, 'clients_export')
    const attendanceEvidence = managerEvidence(sourceId ? attendanceById.get(sourceId) || [] : [], 'attendance_export')
    const preferred = clientRows.length === 1 ? clientEvidence.managers : []
    if (clientRows.length === 1 && !preferred.length) flags.push('no_manager_ids_in_client_record')
    if (preferred.some(holder => holder.sourceId === sourceId)) flags.push('self_manager_reference')
    if (preferred.some(holder => holder.sourceRecordCount !== 1)) flags.push('manager_missing_or_ambiguous_in_clients_export')
    if (preferred.some(holder => holder.resolution === 'duplicate_live_source_id')) flags.push('ambiguous_live_manager_identity')
    if (preferred.some(holder => holder.resolution === 'no_live_person_by_source_id')) flags.push('manager_not_yet_a_live_person_by_source_id')
    if (attendanceEvidence.rows && !attendanceEvidence.managers.length && attendanceEvidence.issues.includes('manager_name_without_source_id')) flags.push('attendance_manager_ids_unavailable')
    if (attendanceEvidence.managers.length && clientRows.length === 1 && attendanceEvidence.observedManagerSets.some(signature => signature !== (unique(preferred.map(holder => holder.sourceId)).join('|') || '(none)'))) flags.push('manager_sets_differ_between_exports')
    flags.push(...clientEvidence.issues, ...attendanceEvidence.issues)
    const liveAccounts = accountById.get(student.account_id) || []
    if (liveAccounts.length !== 1) flags.push('missing_or_duplicate_live_account')
    const payerEvidence = (sourceId ? subscriptionById.get(sourceId) || [] : []).map(row => ({
      sourceSubscriptionId: text(row.Id), sourcePayerId: text(row['Payer Id']), payerName: text(row['Payer Name']),
      sourceStatus: text(row.Status), plan: text(row['Plan Name']), autoPay: text(row['Auto Pay']),
      payerIdentity: text(row['Payer Id']) ? sourcePerson(text(row['Payer Id'])) : null,
      liveEnrollmentMatch: 'unresolved_no_verified_subscription_crosswalk',
    }))
    return { liveStudentId: student.id, livePersonId: student.person_id, sourceClientId: sourceId || null,
      studentName: person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() : null,
      liveStatus: student.client_status, memberOrActive: ['member', 'active'].includes(student.client_status),
      liveAccountId: student.account_id, liveAccountName: liveAccounts.length === 1 ? liveAccounts[0].name : null,
      identityMatch: sourceId && linkedPeople.length === 1 && personByExternal.get(sourceId)?.length === 1 && clientRows.length === 1 ? 'unique_exact_source_id' : 'unresolved',
      clientEvidence, attendanceEvidence, sourceManagerIds: preferred.map(holder => holder.sourceId),
      sourceClientName: clientRows.length === 1 ? text(clientRows[0]['Full Name']) : null,
      payerEvidence, liveEnrollmentIds: (enrollmentByStudent.get(student.id) || []).map(row => row.id), flags: unique(flags) }
  })
  const familyReports = [...index(studentReports, row => row.liveAccountId)].map(([accountId, members]) => {
    const signatures = unique(members.map(row => unique(row.sourceManagerIds).join('|') || '(none)'))
    return { liveAccountId: accountId, liveAccountName: members[0].liveAccountName,
      liveStudentIds: members.map(row => row.liveStudentId), memberOrActiveCount: members.filter(row => row.memberOrActive).length,
      sourceManagerIds: unique(members.flatMap(row => row.sourceManagerIds)),
      managerSetsVaryByStudent: signatures.length > 1,
      requiresReview: signatures.length > 1 || members.some(row => row.flags.length > 0),
      decision: 'review_only_no_account_wide_contact_grants_inferred' }
  })
  const summaryFor = rows => ({
    students: rows.length, accounts: new Set(rows.map(row => row.liveAccountId)).size,
    uniqueExactSourceIdMatches: rows.filter(row => row.identityMatch === 'unique_exact_source_id').length,
    withOneSourceManager: rows.filter(row => row.sourceManagerIds.length === 1).length,
    withTwoSourceManagers: rows.filter(row => row.sourceManagerIds.length === 2).length,
    withNoSourceManager: rows.filter(row => !row.sourceManagerIds.length).length,
    flagCounts: Object.fromEntries(unique(rows.flatMap(row => row.flags)).map(flag => [flag, rows.filter(row => row.flags.includes(flag)).length])),
  })
  return { limitations: [
    'Historical exports are evidence, not confirmation of current permissions or enrollment.',
    'Manager slot 1 does not establish primary contact, legal guardianship, payer status or consent.',
    'Payer links are subscription evidence only; no payment methods or billing mandates are inferred.',
    'No names, email addresses or phone numbers are used to establish identity.',
    'No writes or executable migration operations are produced.',
  ], summary: { allStudents: summaryFor(studentReports), memberOrActive: summaryFor(studentReports.filter(row => row.memberOrActive)),
    accountsWithVaryingManagerSets: familyReports.filter(row => row.managerSetsVaryByStudent).length,
    memberOrActiveAccountsWithVaryingManagerSets: familyReports.filter(row => row.memberOrActiveCount && row.managerSetsVaryByStudent).length },
    families: familyReports, students: studentReports }
}

module.exports = { reconcileFamilies }