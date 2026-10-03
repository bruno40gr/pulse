import { supabaseAdmin } from '@/lib/supabase/admin'

export const FUNDING_LIFECYCLE_STATUSES = ['discovery', 'blocked', 'active', 'inactive'] as const
export const FUNDING_BLOCKER_TYPES = ['vendor_approval_pending', 'student_linking_pending', 'document_task_pending', 'authorization_pending', 'other'] as const
export const FUNDING_WAITING_OWNERS = ['Vendor', 'Family', 'Funder'] as const
export const FUNDING_RECIPIENT_ROUTES = ['direct_to_fms', 'portal_file_upload', 'portal_manual_entry', 'family_routed', 'card_on_file_charge'] as const

type JsonObject = Record<string, unknown>

export interface OnboardFundingCaseInput {
  student_id: string
  organization: {
    id?: string
    profile_version_id?: string
    name?: string
    organization_type?: string
  }
  profile: {
    program_name?: string
    change_note?: string
    recipient_routing?: string
    payment_terms?: JsonObject
    submission_config?: JsonObject
    organization_rules?: JsonObject
    onboarding_requirements?: JsonObject
    required_documents?: unknown[]
    invoice_requirements?: JsonObject
    workflow_rules?: JsonObject
    field_metadata?: JsonObject
    verified?: boolean
  }
  contact?: {
    name?: string
    role?: string
    email?: string
    phone?: string
    contact_type?: string
    purpose?: string
    notes?: string
  }
  case: {
    service_description?: string
    service_codes?: string[]
    lifecycle_status?: string
    blocker_type?: string
    waiting_on?: string
    next_step?: string
    next_step_options?: string[]
    due_date?: string
    authorization_reference?: string
    authorization_start_date?: string
    authorization_end_date?: string
    authorized_amount?: number
    coverage_cap?: number
    coverage_percent?: number
    case_instructions?: string
    profile_overrides?: JsonObject
    contact_assignments?: Array<{
      account_contact_id: string
      purpose: 'family_contact' | 'coordinator_contact' | 'authorization_contact' | 'other'
    }>
  }
  source: {
    type: 'manual' | 'tracker_import' | 'migration'
    reference?: string
    row_key?: string
    metadata?: JsonObject
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalDate(value: unknown, label: string, errors: string[]) {
  const normalized = text(value)
  if (normalized && !datePattern.test(normalized)) errors.push(`${label} must use YYYY-MM-DD.`)
  return normalized || undefined
}

function optionalNumber(value: unknown, label: string, errors: string[]) {
  if (value === '' || value === null || value === undefined) return undefined
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) errors.push(`${label} must be a non-negative number.`)
  return normalized
}

export function parseOnboardFundingCaseInput(value: unknown): { success: true; data: OnboardFundingCaseInput } | { success: false; errors: string[] } {
  const root = object(value)
  const organization = object(root.organization)
  const profile = object(root.profile)
  const contact = object(root.contact)
  const caseInput = object(root.case)
  const source = object(root.source)
  const errors: string[] = []
  const studentId = text(root.student_id)
  const organizationId = text(organization.id)
  const profileVersionId = text(organization.profile_version_id)
  const organizationName = text(organization.name)
  const serviceDescription = text(caseInput.service_description)
  const lifecycleStatus = text(caseInput.lifecycle_status) || 'active'
  const blockerType = text(caseInput.blocker_type)
  const waitingOn = text(caseInput.waiting_on) || 'Vendor'
  const recipientRouting = text(profile.recipient_routing)
  const sourceType = text(source.type) || 'manual'
  if (!uuidPattern.test(studentId)) errors.push('Choose an existing student.')
  if (organizationId && !uuidPattern.test(organizationId)) errors.push('Choose a valid funding organization.')
  if (profileVersionId && !uuidPattern.test(profileVersionId)) errors.push('Choose a valid funding profile.')
  if (!organizationId && !organizationName) errors.push('Choose or create a funding organization.')
  if (!FUNDING_LIFECYCLE_STATUSES.includes(lifecycleStatus as typeof FUNDING_LIFECYCLE_STATUSES[number])) errors.push('Choose a valid case lifecycle status.')
  if (lifecycleStatus === 'blocked' && !FUNDING_BLOCKER_TYPES.includes(blockerType as typeof FUNDING_BLOCKER_TYPES[number])) errors.push('Choose why the case is blocked.')
  if (!FUNDING_WAITING_OWNERS.includes(waitingOn as typeof FUNDING_WAITING_OWNERS[number])) errors.push('Choose who owns the next action.')
  if (recipientRouting && !FUNDING_RECIPIENT_ROUTES.includes(recipientRouting as typeof FUNDING_RECIPIENT_ROUTES[number])) errors.push('Choose a valid recipient route.')
  if (!['manual', 'tracker_import', 'migration'].includes(sourceType)) errors.push('Choose a valid onboarding source.')
  const coveragePercent = optionalNumber(caseInput.coverage_percent, 'Coverage percent', errors)
  if (coveragePercent !== undefined && coveragePercent > 100) errors.push('Coverage percent cannot exceed 100.')
  const data: OnboardFundingCaseInput = {
    student_id: studentId,
    organization: {
      id: organizationId || undefined,
      profile_version_id: profileVersionId || undefined,
      name: organizationName || undefined,
      organization_type: text(organization.organization_type) || 'other',
    },
    profile: {
      program_name: text(profile.program_name) || undefined,
      change_note: text(profile.change_note) || undefined,
      recipient_routing: recipientRouting || undefined,
      payment_terms: object(profile.payment_terms),
      submission_config: object(profile.submission_config),
      organization_rules: object(profile.organization_rules),
      onboarding_requirements: object(profile.onboarding_requirements),
      required_documents: Array.isArray(profile.required_documents) ? profile.required_documents : [],
      invoice_requirements: object(profile.invoice_requirements),
      workflow_rules: object(profile.workflow_rules),
      field_metadata: object(profile.field_metadata),
      verified: profile.verified === true,
    },
    contact: Object.keys(contact).length ? {
      name: text(contact.name) || undefined,
      role: text(contact.role) || undefined,
      email: text(contact.email) || undefined,
      phone: text(contact.phone) || undefined,
      contact_type: text(contact.contact_type) || undefined,
      purpose: text(contact.purpose) || undefined,
      notes: text(contact.notes) || undefined,
    } : undefined,
    case: {
      service_description: serviceDescription || undefined,
      service_codes: Array.isArray(caseInput.service_codes) ? caseInput.service_codes.map(text).filter(Boolean) : [],
      lifecycle_status: lifecycleStatus,
      blocker_type: blockerType || undefined,
      waiting_on: waitingOn,
      next_step: text(caseInput.next_step) || undefined,
      next_step_options: Array.isArray(caseInput.next_step_options) ? caseInput.next_step_options.map(text).filter(Boolean) : [],
      due_date: optionalDate(caseInput.due_date, 'Due date', errors),
      authorization_reference: text(caseInput.authorization_reference) || undefined,
      authorization_start_date: optionalDate(caseInput.authorization_start_date, 'Authorization start date', errors),
      authorization_end_date: optionalDate(caseInput.authorization_end_date, 'Authorization end date', errors),
      authorized_amount: optionalNumber(caseInput.authorized_amount, 'Authorized amount', errors),
      coverage_cap: optionalNumber(caseInput.coverage_cap, 'Coverage cap', errors),
      coverage_percent: coveragePercent,
      case_instructions: text(caseInput.case_instructions) || undefined,
      profile_overrides: object(caseInput.profile_overrides),
      contact_assignments: Array.isArray(caseInput.contact_assignments)
        ? caseInput.contact_assignments.flatMap(value => {
          const assignment = object(value)
          const contactId = text(assignment.account_contact_id)
          const purpose = text(assignment.purpose)
          if (!uuidPattern.test(contactId)) return []
          if (!['family_contact', 'coordinator_contact', 'authorization_contact', 'other'].includes(purpose)) return []
          return [{ account_contact_id: contactId, purpose: purpose as 'family_contact' | 'coordinator_contact' | 'authorization_contact' | 'other' }]
        })
        : [],
    },
    source: {
      type: sourceType as OnboardFundingCaseInput['source']['type'],
      reference: text(source.reference) || undefined,
      row_key: text(source.row_key) || undefined,
      metadata: object(source.metadata),
    },
  }
  return errors.length ? { success: false, errors } : { success: true, data }
}

export async function onboardFundingCase(tenantId: string, membershipId: string, input: OnboardFundingCaseInput) {
  const { data, error } = await supabaseAdmin.rpc('odeon_onboard_funding_case', {
    p_tenant_id: tenantId,
    p_membership_id: membershipId,
    p_input: input,
  })
  if (error) throw error
  return data as string
}

export function fundingOnboardingError(error: unknown) {
  const candidate = error as { code?: string; message?: string }
  if (candidate.code === '23505') {
    if (candidate.message?.includes('funding_cases_source_row_unique')) return { status: 409, message: 'This import row has already been onboarded.' }
    return { status: 409, message: 'This student is already assigned to that funding program.' }
  }
  return { status: 500, message: candidate.message || 'Could not add the funded student.' }
}