/* Pure planning only: no network, environment, SQL, or database writes. */
function previewFamilyMigration(report) {
  if (!report.metadata?.tenantId) throw Error('A tenant-scoped report is required')
  const contacts = new Map()
  const studentPlans = report.students.map(student => {
    const blockers = student.flags.filter(flag => [
      'missing_or_duplicate_live_person', 'missing_source_client_id', 'duplicate_live_source_id',
      'duplicate_source_client_id', 'missing_source_client_record', 'missing_or_duplicate_live_account',
      'ambiguous_live_manager_identity', 'manager_missing_or_ambiguous_in_clients_export',
    ].includes(flag))
    if (student.identityMatch !== 'unique_exact_source_id') blockers.push('identity_not_confirmed')
    // Only the unique client record establishes absence. Missing export records or
    // names without IDs must never become an orphan/adult-routing assumption.
    if (student.clientEvidence.issues.length) blockers.push('incomplete_client_manager_identity')
    const status = blockers.length ? 'blocked' : 'proposed'
    for (const holder of student.clientEvidence.managers) {
      if (holder.sourceId === student.sourceClientId) continue
      const contact = contacts.get(holder.sourceId) || {
        sourcePersonId: holder.sourceId, names: [], livePersonIds: [], accountIds: [],
        studentIds: [], candidateResolution: holder.resolution,
        preserveExistingRoles: true, primary: null, permissions: 'not_inferred',
      }
      contact.names = [...new Set([...contact.names, holder.sourceName, ...holder.names].filter(Boolean))]
      contact.livePersonIds = [...new Set([...contact.livePersonIds, ...holder.livePersonIds])]
      contact.accountIds = [...new Set([...contact.accountIds, student.liveAccountId])]
      contact.studentIds = [...new Set([...contact.studentIds, student.liveStudentId])]
      contacts.set(holder.sourceId, contact)
    }
    const otherManagers = student.sourceManagerIds.filter(id => id !== student.sourceClientId)
    const orphan = student.sourceManagerIds.length === 0
    return {
      studentId: student.liveStudentId, personId: student.livePersonId,
      accountId: student.liveAccountId, sourceClientId: student.sourceClientId,
      studentName: student.studentName, memberOrActive: student.memberOrActive,
      status, blockers: [...new Set(blockers)],
      proposedRouting: status === 'blocked' ? null : otherManagers.length ? 'account_holder' : 'student',
      routingReason: orphan ? 'owner_approved_no_source_manager_direct_contact_assumption'
        : otherManagers.length ? 'explicit_source_manager_links' : 'self_manager_direct_contact',
      ageVerification: 'unknown_preserve_birthdate_and_do_not_assert_adulthood',
      modifyMinorFlag: false,
      recipientPolicyNeedsUpdate: status === 'proposed' && !otherManagers.length,
      proposedManagerSourceIds: otherManagers,
      preserveStudentRole: true, preserveInstructorRoles: true,
      preserveAccount: true, billingChanges: [],
    }
  })
  const contactPlans = [...contacts.values()].map(contact => ({ ...contact,
    status: contact.livePersonIds.length > 1 ? 'blocked_duplicate_live_identity' : 'proposed',
    action: contact.livePersonIds.length === 1 ? 'reuse_person_add_holder_role' : 'propose_person_for_source_identity',
    requiresIdentityReviewBeforeCreation: contact.livePersonIds.length !== 1,
  }))
  return {
    metadata: { tenantId: report.metadata.tenantId, sourceReadAt: report.metadata.readAt, previewOnly: true },
    policy: {
      rolesMayOverlap: ['student', 'account_holder', 'instructor'],
      noManagerRouting: 'direct_contact_owner_approved_assumption_not_age_verification',
      noFamilySplits: true, noAccountWideCommunicationGrants: true,
      noAutomaticPrimary: true, noConsentInference: true, noBillingChanges: true,
      implementationGate: 'Existing minor-first recipient resolvers must support the explicit routing assumption before activation.',
      contactCreationGate: 'No exact source-ID match does not prove a new person; review identities lacking source IDs before creation.',
    },
    summary: {
      students: studentPlans.length,
      proposed: studentPlans.filter(row => row.status === 'proposed').length,
      blocked: studentPlans.filter(row => row.status === 'blocked').length,
      directContactAssumptions: studentPlans.filter(row => row.status === 'proposed' && row.proposedRouting === 'student').length,
      memberOrActiveDirectContactAssumptions: studentPlans.filter(row => row.memberOrActive && row.status === 'proposed' && row.proposedRouting === 'student').length,
      uniqueManagerPeople: contactPlans.length,
      existingManagerPeopleToReuse: contactPlans.filter(row => row.action === 'reuse_person_add_holder_role').length,
      sourceManagerPeopleToPropose: contactPlans.filter(row => row.action === 'propose_person_for_source_identity').length,
      accountsToSplit: 0, billingChanges: 0,
    },
    contacts: contactPlans, students: studentPlans,
    families: report.families.map(family => ({ accountId: family.liveAccountId,
      preserveAccount: true, mixedRolesAreNormal: true,
      studentSpecificLinks: studentPlans.filter(row => row.accountId === family.liveAccountId)
        .map(row => ({ studentId: row.studentId, managerSourceIds: row.proposedManagerSourceIds, status: row.status })),
    })),
  }
}
module.exports = { previewFamilyMigration }