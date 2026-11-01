/* Pure destination policy. Classifies routing risk; never authorizes sending. */
const digits = value => {
  const raw = String(value || '').replace(/\D/g, '')
  return raw.length === 11 && raw.startsWith('1') ? raw.slice(1) : raw.length === 10 ? raw : ''
}
const email = value => (value || '').trim().toLowerCase()
const name = value => (value || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Manager classes come from the source export, never from a name guess alone. */
function classifyManager({ sourceClient, isStudentClient, isInstructorName }) {
  if (!sourceClient) return 'manager_source_row_missing'
  if (isStudentClient) return 'manager_is_also_student_client'
  if (isInstructorName) return 'manager_also_instructor'
  if ((sourceClient.Status || '').trim()) return 'manager_has_member_status'
  return 'manager_likely_adult_contact'
}

function classifyStudentDestinations({ tenantId, previewTenantId, students, people, accounts, instructors, preview, sourceClients, ownerDecisions = [] }) {
  if (!tenantId || previewTenantId !== tenantId || preview.metadata?.tenantId !== tenantId) throw Error('Tenant mismatch')
  for (const rows of [students, people, accounts, instructors]) {
    if (rows.some(row => row.tenant_id !== tenantId)) throw Error('Foreign tenant row')
  }
  const studentPersonIds = new Set(students.map(row => row.person_id))
  const instructorPersonIds = new Set(instructors.map(row => row.person_id))
  const approvals = new Map()
  for (const decision of ownerDecisions) {
    if (decision.tenantId !== tenantId || decision.action !== 'approve_responsible_adult_destination'
      || decision.approvedBy !== 'owner' || !decision.studentId || !decision.personId || !decision.reason
      || studentPersonIds.has(decision.personId) || approvals.has(decision.studentId)) throw Error('Invalid owner destination decision')
    approvals.set(decision.studentId, decision)
  }
  const personById = new Map(people.map(row => [row.id, row]))
  const accountById = new Map(accounts.map(row => [row.id, row]))
  const phoneOwners = new Map(), emailOwners = new Map()
  for (const person of people) {
    const phone = digits(person.phone)
    if (phone) phoneOwners.set(phone, [...(phoneOwners.get(phone) || []), person.id])
    const address = email(person.email)
    if (address) emailOwners.set(address, [...(emailOwners.get(address) || []), person.id])
  }
  const sourceById = new Map(sourceClients.map(row => [row.Id, row]))
  const instructorNames = new Set(sourceClients.flatMap(row => [1, 2, 3, 4, 5].map(index => name(row[`Staff ${index} name`]))).filter(Boolean))
  const managerByStudent = new Map()
  for (const contact of preview.contacts) {
    for (const studentId of contact.studentIds) {
      managerByStudent.set(studentId, [...(managerByStudent.get(studentId) || []), contact.sourcePersonId])
    }
  }
  const decisions = students.map(student => {
    const account = accountById.get(student.account_id)
    const person = personById.get(student.person_id)
    if (!account || !person) return { studentId: student.id, status: 'blocked_missing_student_or_account_record', reasons: ['incomplete_local_reference'], messagingAuthorized: false }
    const reasons = [], ownerPersonIds = new Set()
    const accountPhone = digits(account.phone), accountEmail = email(account.email)
    if (accountPhone) for (const id of phoneOwners.get(accountPhone) || []) ownerPersonIds.add(id)
    if (accountEmail) for (const id of emailOwners.get(accountEmail) || []) ownerPersonIds.add(id)
    const own = Boolean((accountPhone && accountPhone === digits(person.phone)) || (accountEmail && accountEmail === email(person.email)))
    if (own) reasons.push('account_destination_is_students_own_details')
    const otherStudents = [...ownerPersonIds].filter(id => id !== person.id && studentPersonIds.has(id))
    if (otherStudents.length) reasons.push('account_destination_owned_by_another_student')
    const instructorOnly = [...ownerPersonIds].filter(id => id !== person.id && !studentPersonIds.has(id) && instructorPersonIds.has(id))
    if (instructorOnly.length) reasons.push('account_destination_owned_by_instructor_only')
    const managerIds = managerByStudent.get(student.id) || []
    const managerClasses = managerIds.map(id => classifyManager({
      sourceClient: sourceById.get(id),
      isStudentClient: preview.students.some(row => row.sourceClientId === id),
      isInstructorName: instructorNames.has(name(sourceById.get(id)?.['Full Name'])),
    }))
    for (const managerClass of managerClasses) reasons.push(`manager:${managerClass}`)
    return { student, person, ownerPersonIds, instructorOnly, managerIds, managerClasses, reasons, accountPhone, accountEmail }
  })
  const results = decisions.map(decision => {
    if (decision.status) return decision
    const { student, ownerPersonIds, instructorOnly, managerIds, managerClasses, reasons, accountPhone, accountEmail } = decision
    const approval = approvals.get(student.id)
    const approvalValid = Boolean(approval && ownerPersonIds.has(approval.personId) && !studentPersonIds.has(approval.personId))
    if (approval && !approvalValid) reasons.push('owner_destination_decision_target_mismatch')
    const siblingOwned = reasons.includes('account_destination_owned_by_another_student')
    const duplicatesStudent = reasons.includes('account_destination_is_students_own_details')
    const mismatch = reasons.includes('owner_destination_decision_target_mismatch')
    const reviewSignals = instructorOnly.length > 0 || managerClasses.some(managerClass => ['manager_source_row_missing', 'manager_is_also_student_client', 'manager_has_member_status', 'manager_also_instructor'].includes(managerClass))
    const missingDestination = !accountPhone && !accountEmail
    const status = missingDestination ? 'blocked_no_destination_on_file'
      : mismatch ? 'blocked_owner_decision_target_mismatch'
        : siblingOwned ? 'blocked_destination_owned_by_another_student'
          : duplicatesStudent ? 'review_destination_duplicates_student_record'
            : approvalValid ? 'owner_approved_adult_destination'
              : reviewSignals ? 'owner_decision_required' : 'no_blocking_signal_found_guardianship_not_inferred'
    return { studentId: student.id, accountId: student.account_id, isMinorFlag: student.is_minor ?? null,
      minorFlagTrusted: false, routingValuePresent: student.message_routing ?? null,
      managerSourceIds: managerIds, managerClasses, accountDestinationOwnerPersonIds: [...ownerPersonIds],
      destinationMatchedStudentOrInstructor: { own: reasons.includes('account_destination_is_students_own_details'),
        anotherStudent: reasons.includes('account_destination_owned_by_another_student') ? 1 : 0,
        instructorOnly: instructorOnly.length },
      status, reasons, ownerApprovalPresent: approvalValid,
      guardianshipInferred: false, activateMessaging: false, messagingAuthorized: false }
  })
  const summary = {}
  for (const result of results) summary[result.status] = (summary[result.status] || 0) + 1
  return { tenantId, mode: 'classification_only_no_send', summary, decisions: results,
    limitations: [
      'A destination belonging to an adult-looking record is not proof of guardianship, consent or payment responsibility.',
      'The source export cannot distinguish an adult account manager from a student sibling acting as account manager.',
      'Owner approval records a decision; it does not enable sending, change is_minor or set message_routing.',
      'Live messaging still requires a separately gated resolver and schema change.',
    ] }
}
module.exports = { classifyStudentDestinations, classifyManager }
