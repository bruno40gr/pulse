import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const BASE_URL = process.env.PULSE_TEST_BASE_URL || 'http://127.0.0.1:3000'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const created = { cases: [], organizations: [], studentPayers: [], payers: [] }

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function accessCookie(actor) {
  const payload = Buffer.from(JSON.stringify({ actor, expiresAt: Date.now() + 60 * 60 * 1000 })).toString('base64url')
  const secret = process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026'
  return `pulse_access=${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

async function request(path, cookie, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie, ...init.headers },
  })
  const contentType = response.headers.get('content-type') || ''
  const rawBody = await response.text()
  let body = {}
  if (rawBody) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = {}
    }
  }
  return { status: response.status, body, rawBody, contentType, setCookie: response.headers.get('set-cookie') || '' }
}

function responseError(response) {
  if (response.body && typeof response.body.error === 'string' && response.body.error) return response.body.error
  if (response.rawBody) return `${response.contentType || 'unknown content type'}: ${response.rawBody.slice(0, 1200)}`
  return `empty response (${response.contentType || 'unknown content type'})`
}

async function ownerActor() {
  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('person_id, role:roles!inner(key), person:people!inner(first_name, last_name)')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .in('status', ['unclaimed', 'invited', 'active'])
    .eq('role.key', 'owner')
  if (error) throw error

  for (const membership of memberships || []) {
    const { data: instructor, error: instructorError } = await supabase
      .from('instructors').select('id').eq('tenant_id', HEADLINER_TENANT_ID).eq('person_id', membership.person_id).maybeSingle()
    if (instructorError) throw instructorError
    if (!instructor) continue
    const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
    return {
      instructorId: instructor.id,
      personId: membership.person_id,
      fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      displayName: `${person.first_name || 'Owner'} ${(person.last_name || '').slice(0, 1)}.`.trim(),
      access: { kind: 'headliner' },
    }
  }
  throw new Error('No Headliner Owner with an instructor record was found.')
}

async function firstStudent(tenantId) {
  const { data, error } = await supabase.from('students').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No student exists for verifier tenant ${tenantId}.`)
  return data.id
}

async function createPayerLink(tenantId, studentId, suffix) {
  const { data: payer, error: payerError } = await supabase.from('payers').insert({
    tenant_id: tenantId,
    name: `Funding verifier ${suffix}`,
    type: 'other',
    program_name: 'Verification program',
  }).select('id').single()
  if (payerError) throw payerError
  created.payers.push(payer.id)

  const { data: link, error: linkError } = await supabase.from('student_payers').insert({
    student_id: studentId,
    payer_id: payer.id,
    coverage_percent: 100,
  }).select('id').single()
  if (linkError) throw linkError
  created.studentPayers.push(link.id)
  return { payerId: payer.id, studentPayerId: link.id }
}

async function createOtherTenantCase(studentId, link, suffix) {
  const { data, error } = await supabase.from('funding_cases').insert({
    tenant_id: OTHER_TENANT_ID,
    student_id: studentId,
    payer_id: link.payerId,
    student_payer_id: link.studentPayerId,
    program_type: 'Verification',
    service_description: 'Cross-tenant verification',
    next_step: 'Do not expose this record.',
  }).select('id').single()
  if (error) throw error
  created.cases.push(data.id)

  const { data: invoice, error: invoiceError } = await supabase.from('funding_invoices').insert({
    tenant_id: OTHER_TENANT_ID,
    funding_case_id: data.id,
    invoice_number: `OTHER-${suffix}`,
    amount: 75,
    status: 'pending',
  }).select('id').single()
  if (invoiceError) throw invoiceError
  return { caseId: data.id, invoiceId: invoice.id }
}

async function cleanup() {
  const { data: verifierCases, error: verifierCaseLookupError } = await supabase
    .from('funding_cases')
    .select('id, student_payer_id')
    .like('source_reference', 'verifier-%')
  if (verifierCaseLookupError) throw verifierCaseLookupError
  const directCaseIds = [...new Set([...(verifierCases || []).map(item => item.id), ...created.cases])]
  const directStudentPayerIds = (verifierCases || []).map(item => item.student_payer_id).filter(Boolean)
  if (directCaseIds.length) {
    const { data: trackedCases, error: trackedCaseError } = await supabase.from('funding_cases').select('student_payer_id').in('id', directCaseIds)
    if (trackedCaseError) throw trackedCaseError
    directStudentPayerIds.push(...(trackedCases || []).map(item => item.student_payer_id).filter(Boolean))
    const { error: directCaseError } = await supabase.from('funding_cases').delete().in('id', directCaseIds)
    if (directCaseError) throw directCaseError
  }
  if (directStudentPayerIds.length) {
    const { error: directLinkError } = await supabase.from('student_payers').delete().in('id', [...new Set(directStudentPayerIds)])
    if (directLinkError) throw directLinkError
  }

  const { data: verifierOrganizations, error: organizationLookupError } = await supabase
    .from('funding_organizations')
    .select('id, legacy_payer_id')
    .like('name', 'Funding verifier %')
  if (organizationLookupError && organizationLookupError.code !== 'PGRST205') throw organizationLookupError
  const organizationIds = [...new Set([...(verifierOrganizations || []).map(item => item.id), ...created.organizations])]
  let trackedOrganizations = verifierOrganizations || []
  if (organizationIds.length) {
    const { data, error } = await supabase.from('funding_organizations').select('id, legacy_payer_id').in('id', organizationIds)
    if (error) throw error
    trackedOrganizations = data || []
  }
  const canonicalPayerIds = trackedOrganizations.map(item => item.legacy_payer_id).filter(Boolean)

  const { data: verifierPayers, error: payerLookupError } = await supabase
    .from('payers')
    .select('id')
    .like('name', 'Funding verifier %')
  if (payerLookupError) throw payerLookupError

  const payerIds = [...new Set([...(verifierPayers || []).map(payer => payer.id), ...canonicalPayerIds, ...created.payers])]

  let verifierLinks = []
  if (payerIds.length) {
    const { data, error } = await supabase.from('student_payers').select('id').in('payer_id', payerIds)
    if (error) throw error
    verifierLinks = data || []
  }

  const studentPayerIds = [...new Set([...(verifierLinks || []).map(link => link.id), ...created.studentPayers])]
  if (studentPayerIds.length) {
    const { error: caseError } = await supabase.from('funding_cases').delete().in('student_payer_id', studentPayerIds)
    if (caseError) throw caseError
    const { error: linkError } = await supabase.from('student_payers').delete().in('id', studentPayerIds)
    if (linkError) throw linkError
  }

  if (organizationIds.length) {
    const { error: relationshipError } = await supabase.from('funding_program_organizations').delete().in('funding_organization_id', organizationIds)
    if (relationshipError) throw relationshipError
    const { error: organizationError } = await supabase.from('funding_organizations').delete().in('id', organizationIds)
    if (organizationError) throw organizationError
  }

  if (payerIds.length) {
    const { error: payerError } = await supabase.from('payers').delete().in('id', payerIds)
    if (payerError) throw payerError
  }

  created.cases.length = 0
  created.organizations.length = 0
  created.studentPayers.length = 0
  created.payers.length = 0
}

async function main() {
  const schemaCheck = await supabase.from('funding_cases').select('id, funding_organization_id, current_profile_version_id').limit(1)
  if (schemaCheck.error) {
    if (['PGRST204', 'PGRST205'].includes(schemaCheck.error.code) || /schema cache|does not exist|could not find/i.test(schemaCheck.error.message)) {
      throw new Error('Durable funding onboarding schema is unavailable. Apply scripts/migration-019-funding-onboarding-foundation.sql to an approved development Supabase environment first.')
    }
    throw schemaCheck.error
  }
  const catalogSchemaCheck = await supabase.from('funding_organization_roles').select('id').limit(1)
  if (catalogSchemaCheck.error) {
    if (['PGRST204', 'PGRST205'].includes(catalogSchemaCheck.error.code) || /schema cache|does not exist|could not find/i.test(catalogSchemaCheck.error.message)) {
      throw new Error('Catalog-backed funding schema is unavailable. Apply scripts/migration-023-funding-catalog-roles.sql to the verification database first.')
    }
    throw catalogSchemaCheck.error
  }

  await cleanup()

  const suffix = randomUUID().slice(0, 8)
  const cookie = accessCookie(await ownerActor())
  const studentId = await firstStudent(HEADLINER_TENANT_ID)

  const bootstrap = await request(`/api/funding/bootstrap?tenant=${HEADLINER_TENANT_ID}`, cookie, { method: 'POST' })
  assert(bootstrap.status === 200, `Headliner funding bootstrap failed (${bootstrap.status}): ${responseError(bootstrap)}`)

  const catalog = await request(`/api/funding/catalog?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(catalog.status === 200 && Array.isArray(catalog.body), `Funding catalog failed (${catalog.status}): ${responseError(catalog)}`)
  const existingPrograms = await request(`/api/funding/organizations?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(existingPrograms.status === 200 && Array.isArray(existingPrograms.body), `Funding program listing failed (${existingPrograms.status}): ${responseError(existingPrograms)}`)
  const establishedPrograms = existingPrograms.body.filter(item => item.affiliationStatus === 'established')
  assert(establishedPrograms.length === 3, 'Headliner must expose its three established programs as ready to use.')
  assert(establishedPrograms.every(item => Array.isArray(item.affiliationSteps) && Array.isArray(item.studentRequirements) && Array.isArray(item.billingGuidance)),
    'Established programs must expose affiliation, student, and billing guidance as separate scopes.')
  const existingCatalogKeys = new Set(existingPrograms.body.map(item => item.catalogKey).filter(Boolean))
  const catalogOrganization = catalog.body.find(item => !existingCatalogKeys.has(item.id))
  assert(catalogOrganization, 'Every funding catalog organization is already configured for the verifier tenant. Remove one disposable catalog program before running this destructive verifier.')

  const createdProgram = await request(`/api/funding/organizations?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({ catalog_id: catalogOrganization.id }),
  })
  assert(createdProgram.status === 201, `Catalog program creation failed (${createdProgram.status}): ${responseError(createdProgram)}`)
  created.organizations.push(createdProgram.body.organizationId)

  const onboardingOptionsBeforeCase = await request(`/api/funding/onboarding-options?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(onboardingOptionsBeforeCase.status === 200, `Onboarding options failed (${onboardingOptionsBeforeCase.status}): ${responseError(onboardingOptionsBeforeCase)}`)
  assert(!onboardingOptionsBeforeCase.body.programs?.some(item => item.organizationId === createdProgram.body.organizationId),
    'A newly added setup-required program must not be assignable before vendor setup is complete.')
  const persistedProgram = onboardingOptionsBeforeCase.body.programs?.[0]
  assert(persistedProgram?.id && persistedProgram.affiliationStatus === 'established', 'An established Headliner program must be immediately assignable.')
  const establishedProgram = establishedPrograms.find(item => item.profileVersionId === persistedProgram.id)
  assert(establishedProgram, 'The assignable profile must correspond to an established Headliner program.')

  const createdContact = await request(`/api/funding/organizations/${createdProgram.body.organizationId}/contacts?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({ name: 'Verifier Coordinator', role: 'Vendor support', email: `verifier-${suffix}@example.com`, notes: 'Disposable verifier contact.' }),
  })
  assert(createdContact.status === 201, `Tenant contact creation failed (${createdContact.status}): ${responseError(createdContact)}`)

  const onboardingPayload = {
    student_id: studentId,
    organization: { id: persistedProgram.organizationId, profile_version_id: persistedProgram.id },
    profile: {},
    case: {
      service_description: 'Verifier service',
      service_codes: ['VERIFY-101'],
      authorization_reference: `AUTH-${suffix}`,
      lifecycle_status: 'active',
      waiting_on: 'Vendor',
      next_step: 'Verify the invoice workflow.',
      next_step_options: ['Verify the invoice workflow.'],
      coverage_percent: 100,
      profile_overrides: {},
    },
    source: { type: 'tracker_import', reference: `verifier-${suffix}.csv`, row_key: 'row-1', metadata: { verifier: true } },
  }

  const createdCase = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify(onboardingPayload),
  })
  assert(createdCase.status === 201, `Case creation failed (${createdCase.status}): ${responseError(createdCase)}`)
  created.cases.push(createdCase.body.id)
  assert(createdCase.body.fundingOrganizationId, 'Canonical onboarding must reference a funding organization.')
  assert(createdCase.body.fundingOrganizationId === persistedProgram.organizationId, 'Student assignment must use the established catalog-backed organization selected by the verifier.')
  assert(createdCase.body.profileVersion > 0 && createdCase.body.profileVersionId, 'Canonical onboarding must reference an immutable active profile version.')
  assert(createdCase.body.authorization === `AUTH-${suffix}`, 'Student-specific authorization must remain on the case.')

  const duplicateCase = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST', body: JSON.stringify(onboardingPayload),
  })
  assert(duplicateCase.status === 409, 'Replaying the same student, organization, and source row must be rejected idempotently.')

  const createdInvoice = await request(`/api/funding/cases/${createdCase.body.id}/invoices?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({ invoice_number: `VERIFY-${suffix}`, amount: 125, status: 'pending', due_on: '2026-10-15' }),
  })
  assert(createdInvoice.status === 201, `Invoice creation failed (${createdInvoice.status}): ${responseError(createdInvoice)}`)
  const invoice = createdInvoice.body.invoices?.[0]
  assert(invoice?.status === 'pending', 'Created invoice must be pending.')
  assert(invoice.statusEvents?.length === 1 && invoice.statusEvents[0].fromStatus === null, 'Invoice creation must create initial status history atomically.')
  const { data: persistedInvoice, error: persistedInvoiceError } = await supabase
    .from('funding_invoices')
    .select('funding_profile_version_id, case_configuration_snapshot, generation_snapshot')
    .eq('id', invoice.id)
    .single()
  if (persistedInvoiceError) throw persistedInvoiceError
  assert(persistedInvoice.funding_profile_version_id === createdCase.body.profileVersionId, 'Invoice must reference the governing profile version.')
  assert(persistedInvoice.case_configuration_snapshot.authorization_reference === `AUTH-${suffix}`, 'Invoice must snapshot case authorization configuration.')
  assert(persistedInvoice.generation_snapshot.profile_version_id === createdCase.body.profileVersionId, 'Invoice generation must snapshot the governing profile ID.')
  assert(Array.isArray(persistedInvoice.generation_snapshot.invoice_requirements.service_codes)
    && persistedInvoice.generation_snapshot.invoice_requirements.service_codes.length === 0,
  'Invoice generation must preserve catalog-backed guidance without inventing service-code requirements.')

  const tenantProfileEdit = await request(`/api/funding/organizations/${createdCase.body.fundingOrganizationId}/profiles?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({
      change_note: 'Verifier routing change.',
      profile: { program_name: 'Verification program', recipient_routing: 'direct_to_fms', payment_terms: { invoice_cadence: 'Monthly' } },
    }),
  })
  assert(tenantProfileEdit.status === 403, 'Tenant administrators must not be able to author product-managed funding guidance.')
  const { error: immutableError } = await supabase.from('funding_profile_versions').update({ program_name: 'Mutated in place' }).eq('id', createdCase.body.profileVersionId)
  assert(immutableError, 'Active funding profile versions must reject in-place mutation.')
  const { data: invoiceAfterProfileChange, error: invoiceAfterProfileChangeError } = await supabase
    .from('funding_invoices').select('funding_profile_version_id, generation_snapshot').eq('id', invoice.id).single()
  if (invoiceAfterProfileChangeError) throw invoiceAfterProfileChangeError
  assert(invoiceAfterProfileChange.funding_profile_version_id === createdCase.body.profileVersionId, 'A later profile version must not rewrite invoice history.')

  const onboardingOptions = await request(`/api/funding/onboarding-options?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(onboardingOptions.status === 200, `Onboarding options failed (${onboardingOptions.status}).`)
  const programOption = onboardingOptions.body.programs?.find(item => item.organizationId === createdCase.body.fundingOrganizationId)
  assert(programOption?.id === createdCase.body.profileVersionId,
    'Onboarding options must expose the active reusable funding program.')

  assert(catalog.body.some?.(item => item.id === catalogOrganization.id),
    'Funding catalog must expose known organizations without exposing unverified tenant-authored guidance.')

  const organizations = await request(`/api/funding/organizations?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(organizations.status === 200, `Funding program listing failed (${organizations.status}).`)
  const listedProgram = organizations.body.find?.(item => item.organizationId === createdCase.body.fundingOrganizationId)
  assert(listedProgram?.profileVersionId === createdCase.body.profileVersionId && listedProgram.catalogKey === establishedProgram.catalogKey
    && listedProgram.name === establishedProgram.name && listedProgram.affiliationStatus === 'established',
    'Funding program listing must expose the active immutable profile as a reusable program.')
  const listedSetupProgram = organizations.body.find?.(item => item.organizationId === createdProgram.body.organizationId)
  assert(listedSetupProgram?.affiliationStatus === 'setup_required', 'A newly added catalog program must remain setup-required.')
  assert(listedSetupProgram.contacts?.some(contact => contact.id === createdContact.body.id),
    'Funding program listing must expose the tenant-specific contact without changing global guidance.')

  const rejectedWithoutEvidence = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'rejected' }),
  })
  assert(rejectedWithoutEvidence.status === 400, 'Rejection without evidence must return 400.')

  const rejectionEvidence = 'Verifier payer response: authorization code mismatch.'
  const rejected = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'rejected', evidence: rejectionEvidence, note: 'Verifier rejection.' }),
  })
  assert(rejected.status === 200, `Evidence-backed rejection failed (${rejected.status}).`)
  assert(rejected.body.status === 'needs_review', 'Rejected invoice must move the case to Needs review.')
  assert(rejected.body.outstanding === 125, 'Rejected invoice must preserve outstanding value.')
  assert(rejected.body.invoices[0].rejectionEvidence === rejectionEvidence, 'Rejection evidence must be persisted.')
  assert(rejected.body.invoices[0].statusEvents.length === 2, 'Rejection must append invoice status history.')
  assert(rejected.body.activity.some(event => event.title === 'Invoice Rejected'), 'Rejection must append case activity.')

  const returnedPending = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'pending', note: 'Corrected invoice submitted.' }),
  })
  assert(returnedPending.status === 200 && returnedPending.body.status === 'waiting', 'Resubmission must return the case to Waiting.')

  const paid = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'paid', paid_on: '2026-10-01', note: 'Verifier payment.' }),
  })
  assert(paid.status === 200, `Paid transition failed (${paid.status}).`)
  assert(paid.body.status === 'paid' && paid.body.outstanding === 0 && paid.body.amountPaid === 125, 'Paid transition must reconcile the case totals.')

  const archived = await request(`/api/funding/cases/${createdCase.body.id}?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ lifecycle_status: 'archived', note: 'Verifier archive test.' }),
  })
  assert(archived.status === 200, `Case archive failed (${archived.status}).`)
  assert(archived.body.activity.some(event => event.title === 'Funding relationship archived'), 'Archiving must append funding activity.')

  const activeCases = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(activeCases.status === 200, `Funding case listing failed (${activeCases.status}).`)
  assert(!activeCases.body.some(item => item.id === createdCase.body.id), 'Archived cases must leave normal dashboard lists.')

  const archivedById = await request(`/api/funding/cases/${createdCase.body.id}?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(archivedById.status === 200 && archivedById.body.id === createdCase.body.id,
    'Archived cases must remain retrievable by ID for audit history.')

  const reusedOrganizationPayload = {
    student_id: studentId,
    organization: {
      id: createdCase.body.fundingOrganizationId,
      profile_version_id: createdCase.body.profileVersionId,
    },
    profile: {},
    case: { lifecycle_status: 'active', waiting_on: 'Vendor' },
    source: { type: 'manual', metadata: { verifier: true, reused_organization: true } },
  }
  const reusedCase = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST', body: JSON.stringify(reusedOrganizationPayload),
  })
  if (reusedCase.status === 500 && /service_description.*not-null|service_description.*not null/i.test(reusedCase.body.error || '')) {
    throw new Error('Minimal funded-student assignment requires scripts/migration-022-funding-program-workflow.sql in the verification database.')
  }
  assert(reusedCase.status === 201, `Existing organization reuse failed (${reusedCase.status}): ${responseError(reusedCase)}`)
  created.cases.push(reusedCase.body.id)
  assert(reusedCase.body.fundingOrganizationId === createdCase.body.fundingOrganizationId && reusedCase.body.profileVersionId === createdCase.body.profileVersionId,
    'Minimal assignment must reference the selected reusable funding program.')
  assert(reusedCase.body.status === 'needs_review' && reusedCase.body.statusLabel === 'Action needed',
    'A minimal student and program assignment must immediately appear with Action needed.')
  assert(reusedCase.body.service === 'Not provided' && reusedCase.body.authorization === 'Not provided',
    'Minimal assignment must not fabricate service or authorization values.')
  assert(reusedCase.body.coveragePercent === null && reusedCase.body.coverageCap === null,
    'Minimal assignment must preserve unknown student-specific coverage.')
  const { data: minimalCaseRow, error: minimalCaseError } = await supabase
    .from('funding_cases').select('student_payer_id, service_description, coverage_percent').eq('id', reusedCase.body.id).single()
  if (minimalCaseError) throw minimalCaseError
  const { data: minimalLink, error: minimalLinkError } = await supabase
    .from('student_payers').select('coverage_percent').eq('id', minimalCaseRow.student_payer_id).single()
  if (minimalLinkError) throw minimalLinkError
  assert(minimalCaseRow.service_description === null && minimalCaseRow.coverage_percent === null && minimalLink.coverage_percent === null,
    'Migration 022 must persist unknown service and coverage as null rather than placeholders or 100%.')

  const duplicateReusedCase = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST', body: JSON.stringify(reusedOrganizationPayload),
  })
  assert(duplicateReusedCase.status === 409, 'A second active student and organization case must be rejected.')

  const otherStudentId = await firstStudent(OTHER_TENANT_ID)
  const otherLink = await createPayerLink(OTHER_TENANT_ID, otherStudentId, `${suffix}-other`)
  const other = await createOtherTenantCase(otherStudentId, otherLink, suffix)
  const crossTenantCase = await request(`/api/funding/cases/${other.caseId}?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(crossTenantCase.status === 404, 'A cross-tenant funding case ID must return 404.')
  const crossTenantInvoice = await request(`/api/funding/invoices/${other.invoiceId}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'paid', paid_on: '2026-10-01' }),
  })
  assert(crossTenantInvoice.status === 404, 'A cross-tenant invoice ID must return 404.')

  const demoSession = await request('/api/access/demo', '', { method: 'POST', body: JSON.stringify({ tenantId: OTHER_TENANT_ID }) })
  assert(demoSession.status === 200 && demoSession.setCookie.includes('pulse_access='), `Demo session creation failed (${demoSession.status}).`)
  const demoCookie = demoSession.setCookie.split(';')[0]
  const demoFunding = await request(`/api/funding/organizations?tenant=${OTHER_TENANT_ID}`, demoCookie)
  assert(demoFunding.status === 200 && Array.isArray(demoFunding.body), 'A valid signed demo session must be able to read funding data for its own tenant.')
  assert(demoFunding.body.every(item => item.affiliationStatus !== 'established'), 'Demo tenants must not inherit Headliner established affiliations.')
  const demoCrossTenant = await request(`/api/funding/organizations?tenant=${HEADLINER_TENANT_ID}`, demoCookie)
  assert(demoCrossTenant.status === 403, 'A demo funding session must remain bound to its signed demo tenant.')

  console.log('Funding program scopes, demo isolation, and invoice workflow verification passed.')
}

try {
  await main()
} finally {
  await cleanup()
}