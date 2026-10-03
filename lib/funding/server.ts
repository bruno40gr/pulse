import { PERMISSIONS } from '@/lib/permissions'
import { resolveRequestTenant } from '@/lib/tenant-access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAccessScope, getRequestActor } from '@/lib/access'
import type { FundingCase, FundingInvoice, FundingInvoiceStatusEvent, FundingStudentField, FundingStudentRequirement } from '@/components/funding/types'

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

type FundingPermission = typeof PERMISSIONS.fundingRead | typeof PERMISSIONS.fundingManage | typeof PERMISSIONS.dataMigrationsRun

export async function authorizeFunding(request: Request, permission: FundingPermission) {
  const access = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
  if (!access.ok) return access
  if (!access.context) {
    const actor = await getRequestActor(request)
    const scope = getAccessScope(actor)
    if (!actor || scope.kind !== 'demo' || scope.tenantId !== access.tenantId) return { ok: false as const, status: 403, error: 'Staff account access is required.' }
    const { data: membership, error } = await supabaseAdmin.from('tenant_memberships')
      .select('id, role_id, role:roles!inner(key)')
      .eq('tenant_id', access.tenantId)
      .eq('person_id', actor.personId)
      .eq('status', 'active')
      .maybeSingle()
    if (error) throw error
    const role = Array.isArray(membership?.role) ? membership.role[0] : membership?.role
    if (!membership || role?.key !== 'owner') return { ok: false as const, status: 403, error: 'Staff account access is required.' }
    return {
      ...access,
      context: {
        authSource: 'legacy' as const,
        authUserId: null,
        membershipId: membership.id,
        tenantId: access.tenantId,
        personId: actor.personId,
        roleId: membership.role_id,
        roleKey: 'owner',
        membershipStatus: 'active' as const,
        permissions: new Set<string>(),
        legacyActor: actor,
      },
    }
  }
  if (access.context.roleKey !== 'owner' && !access.context.permissions.has(permission)) {
    return { ok: false as const, status: 403, error: 'You do not have permission to perform this action.' }
  }
  return { ...access, context: access.context }
}

const FUNDING_CASE_SELECT = `
  *,
  student:students (
    id,
    person:people ( id, first_name, last_name ),
    accounts ( name )
  ),
  payer:payers ( id, name, type, program_name ),
  organization:funding_organizations ( id, name, organization_type ),
  current_profile:funding_profile_versions!funding_cases_current_profile_version_id_fkey (
    id, version_number, program_name, recipient_routing, payment_terms, submission_config, organization_rules,
    onboarding_requirements, invoice_requirements
  ),
  invoices:funding_invoices (
    *,
    status_events:funding_invoice_status_events (*)
  ),
  events:funding_case_events (*),
  contacts:funding_case_contacts (
    id, purpose, relationship_snapshot,
    account_contact:account_contacts ( id, name, relationship, email, phone )
  )
`

interface PersonRow { id: string; first_name: string | null; last_name: string | null }
interface AccountRow { name: string | null }
interface StudentRow {
  id: string
  person: PersonRow | PersonRow[] | null
  accounts: AccountRow | AccountRow[] | null
}
interface PayerRow { id: string; name: string; type: string; program_name: string | null }
interface OrganizationRow { id: string; name: string; organization_type: string }
interface ProfileRow {
  id: string
  version_number: number
  program_name: string | null
  recipient_routing: string | null
  payment_terms: Record<string, unknown> | null
  submission_config: Record<string, unknown> | null
  organization_rules: Record<string, unknown> | null
  onboarding_requirements: Record<string, unknown> | null
  invoice_requirements: Record<string, unknown> | null
}
interface InvoiceEventRow {
  id: string
  from_status: FundingInvoiceStatusEvent['fromStatus']
  to_status: FundingInvoiceStatusEvent['toStatus']
  evidence: string | null
  note: string | null
  changed_at: string
}
interface InvoiceRow {
  id: string
  invoice_number: string
  service_period_start: string | null
  service_period_end: string | null
  issued_on: string | null
  due_on: string | null
  amount: number | string
  status: FundingInvoice['status']
  paid_on: string | null
  rejection_evidence: string | null
  created_at: string
  updated_at: string
  status_events: InvoiceEventRow[] | null
}
interface CaseEventRow { id: string; title: string; detail: string | null; created_at: string }
interface AccountContactRow { id: string; name: string; relationship: string | null; email: string | null; phone: string | null }
interface CaseContactRow {
  id: string
  purpose: 'family_contact' | 'coordinator_contact' | 'authorization_contact' | 'other'
  relationship_snapshot: string | null
  account_contact: AccountContactRow | AccountContactRow[] | null
}
interface FundingCaseRow {
  id: string
  student_id: string
  payer_id: string
  funding_organization_id: string | null
  program_type: string
  service_description: string | null
  workflow_status: FundingCase['status']
  waiting_on: FundingCase['owner']
  next_step: string
  next_step_options: unknown
  due_date: string | null
  authorization_reference: string | null
  authorization_start_date: string | null
  authorization_end_date: string | null
  coverage_percent: number | null
  coverage_cap: number | string | null
  invoice_cadence: string | null
  submission_route: string | null
  payment_method: string | null
  instructions: string | null
  lifecycle_status: string | null
  blocker_type: string | null
  service_codes: unknown
  profile_overrides: Record<string, unknown> | null
  updated_at: string
  student: StudentRow | StudentRow[] | null
  payer: PayerRow | PayerRow[] | null
  organization: OrganizationRow | OrganizationRow[] | null
  current_profile: ProfileRow | ProfileRow[] | null
  invoices: InvoiceRow[] | null
  events: CaseEventRow[] | null
  contacts: CaseContactRow[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null
}

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

const STUDENT_FIELDS = new Set<FundingStudentField>(['authorization_reference', 'authorization_start_date', 'authorization_end_date', 'service_description', 'service_code', 'coverage_percent', 'coverage_cap', 'coordinator_contact', 'family_contact', 'required_documents'])

function studentRequirements(value: unknown): FundingStudentRequirement[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    const requirement = object(item)
    const field = requirement.field
    if (typeof field !== 'string' || !STUDENT_FIELDS.has(field as FundingStudentField)) return []
    return [{
      id: typeof requirement.id === 'string' ? requirement.id : `student-requirement-${index + 1}`,
      title: typeof requirement.title === 'string' ? requirement.title : `Requirement ${index + 1}`,
      description: typeof requirement.description === 'string' ? requirement.description : '',
      mediaUrl: null,
      actionLabel: null,
      actionUrl: null,
      field: field as FundingStudentField,
      required: requirement.required === true,
    }]
  })
}

function workflowLabel(status: FundingCase['status'], invoices: FundingInvoice[]) {
  const latest = invoices[0]
  if (latest?.status === 'rejected') return 'Invoice rejected'
  if (latest?.status === 'overdue') return 'Invoice overdue'
  if (latest?.status === 'draft') return 'Invoice needed'
  if (latest?.status === 'pending') return 'Waiting on payer'
  if (latest?.status === 'paid') return 'Paid'
  return status === 'needs_review' ? 'Action needed' : status === 'waiting' ? 'Waiting' : status === 'paid' ? 'Paid' : 'Active'
}

export function serializeFundingCase(row: FundingCaseRow): FundingCase {
  const student = one(row.student)
  const person = one(student?.person)
  const payer = one(row.payer)
  const organization = one(row.organization)
  const profile = one(row.current_profile)
  const onboardingRequirements = object(profile?.onboarding_requirements)
  const invoiceRequirements = object(profile?.invoice_requirements)
  const account = one(student?.accounts)
  const invoices = (row.invoices || []).map((invoice): FundingInvoice => ({
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    servicePeriodStart: dateOnly(invoice.service_period_start),
    servicePeriodEnd: dateOnly(invoice.service_period_end),
    issuedOn: dateOnly(invoice.issued_on),
    dueOn: dateOnly(invoice.due_on),
    amount: Number(invoice.amount),
    status: invoice.status,
    paidOn: dateOnly(invoice.paid_on),
    rejectionEvidence: invoice.rejection_evidence,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
    statusEvents: (invoice.status_events || [])
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
      .map(event => ({
        id: event.id,
        fromStatus: event.from_status,
        toStatus: event.to_status,
        evidence: event.evidence,
        note: event.note,
        changedAt: event.changed_at,
      })),
  })).sort((a, b) => (b.dueOn || b.createdAt).localeCompare(a.dueOn || a.createdAt))
  const amountExpected = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const amountPaid = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0)
  const nextStepOptions = Array.isArray(row.next_step_options)
    ? row.next_step_options.filter((value): value is string => typeof value === 'string')
    : []
  const requirements = studentRequirements(onboardingRequirements.student_requirements)
  const requiredFields = new Set(requirements.filter(requirement => requirement.required).map(requirement => requirement.field))
  const caseContacts = (row.contacts || []).flatMap(contact => {
    const accountContact = one(contact.account_contact)
    if (!accountContact) return []
    return [{
      id: contact.id,
      accountContactId: accountContact.id,
      name: accountContact.name,
      relationship: contact.relationship_snapshot || accountContact.relationship,
      purpose: contact.purpose,
      email: accountContact.email,
      phone: accountContact.phone,
    }]
  })
  const useLegacyCoreRequirements = requirements.length === 0
  const missingDetails = [
    (useLegacyCoreRequirements || requiredFields.has('service_description')) && !row.service_description && 'Add service details',
    requiredFields.has('service_code') && stringList(row.service_codes).length === 0 && 'Add service code',
    (useLegacyCoreRequirements || requiredFields.has('authorization_reference')) && !row.authorization_reference && 'Add authorization or purchase order',
    (useLegacyCoreRequirements || requiredFields.has('authorization_start_date') || requiredFields.has('authorization_end_date')) && (!row.authorization_start_date || !row.authorization_end_date) && 'Add coverage dates',
    requiredFields.has('coverage_percent') && row.coverage_percent === null && 'Add coverage percent',
    requiredFields.has('coverage_cap') && row.coverage_cap === null && 'Add coverage cap',
    requiredFields.has('family_contact') && !caseContacts.some(contact => contact.purpose === 'family_contact') && 'Add family contact',
    requiredFields.has('coordinator_contact') && !caseContacts.some(contact => contact.purpose === 'coordinator_contact') && 'Add coordinator contact',
  ].filter((value): value is string => Boolean(value))
  const onboardingPrompts = ['Add service details', 'Add authorization or purchase order', 'Add coverage dates']
  const incompleteAssignment = invoices.length === 0 && missingDetails.length > 0
  const completedAssignment = invoices.length === 0 && missingDetails.length === 0 && row.lifecycle_status !== 'blocked' && row.workflow_status === 'needs_review'
  const derivedStatus = incompleteAssignment ? 'needs_review' : completedAssignment ? 'active' : row.workflow_status
  const recordedNextStep = onboardingPrompts.includes(row.next_step) && !missingDetails.includes(row.next_step) ? '' : row.next_step
  const derivedNextStep = recordedNextStep || missingDetails[0] || 'No action needed right now.'

  return {
    id: row.id,
    studentId: row.student_id,
    studentPersonId: person?.id || null,
    payerId: row.payer_id,
    fundingOrganizationId: row.funding_organization_id,
    profileVersionId: profile?.id || null,
    profileVersion: profile?.version_number || null,
    student: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unknown student',
    parent: account?.name || 'Not provided',
    fundingOrganization: organization?.name || payer?.name || 'Unknown payer',
    programType: profile?.program_name || row.program_type || organization?.organization_type || payer?.program_name || payer?.type || 'Other',
    service: row.service_description || 'Not provided',
    selectedServiceCodes: stringList(row.service_codes),
    programServiceCodes: stringList(invoiceRequirements.service_codes),
    programStudentRequirements: requirements,
    status: derivedStatus,
    statusLabel: workflowLabel(derivedStatus, invoices),
    owner: row.waiting_on,
    nextStep: derivedNextStep,
    nextStepOptions: nextStepOptions.length ? nextStepOptions : [derivedNextStep, ...missingDetails.filter(item => item !== derivedNextStep)],
    dueDate: dateOnly(row.due_date),
    amountExpected,
    amountPaid,
    outstanding: amountExpected - amountPaid,
    authorization: row.authorization_reference || 'Not provided',
    authorizationStartDate: dateOnly(row.authorization_start_date),
    authorizationEndDate: dateOnly(row.authorization_end_date),
    coveragePercent: row.coverage_percent,
    coverageCap: row.coverage_cap === null ? null : Number(row.coverage_cap),
    invoiceCadence: row.invoice_cadence || String(profile?.payment_terms?.invoice_cadence || 'Not provided'),
    submissionRoute: row.submission_route || profile?.recipient_routing || 'Not provided',
    paymentMethod: row.payment_method || String(profile?.organization_rules?.payment_method || 'Not provided'),
    instructions: row.instructions || String(profile?.submission_config?.instructions || ''),
    updatedAt: row.updated_at,
    invoices,
    activity: (row.events || []).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(event => ({
      id: event.id,
      title: event.title,
      detail: event.detail || '',
      date: event.created_at,
    })),
    contacts: caseContacts,
    missingDetails,
  }
}

export async function loadFundingCases(tenantId: string, caseId?: string, studentPersonId?: string) {
  let query = supabaseAdmin.from('funding_cases').select(FUNDING_CASE_SELECT).eq('tenant_id', tenantId)
  if (caseId) query = query.eq('id', caseId)
  else query = query.is('archived_at', null)
  if (studentPersonId) {
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students').select('id').eq('tenant_id', tenantId).eq('person_id', studentPersonId).maybeSingle()
    if (studentError) throw studentError
    if (!student) return []
    query = query.eq('student_id', student.id)
  }
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error
  return ((data || []) as unknown as FundingCaseRow[]).map(serializeFundingCase)
}

export async function loadFundingCase(tenantId: string, caseId: string) {
  return (await loadFundingCases(tenantId, caseId))[0] || null
}