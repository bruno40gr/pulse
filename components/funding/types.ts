export type FundingCaseStatus = 'needs_review' | 'waiting' | 'active' | 'paid'
export type FundingOwner = 'Vendor' | 'Family' | 'Funder'
export type FundingInvoiceStatus = 'draft' | 'pending' | 'overdue' | 'rejected' | 'paid'

export interface FundingInvoiceStatusEvent {
  id: string
  fromStatus: FundingInvoiceStatus | null
  toStatus: FundingInvoiceStatus
  evidence: string | null
  note: string | null
  changedAt: string
}

export interface FundingInvoice {
  id: string
  invoiceNumber: string
  servicePeriodStart: string | null
  servicePeriodEnd: string | null
  issuedOn: string | null
  dueOn: string | null
  amount: number
  status: FundingInvoiceStatus
  paidOn: string | null
  rejectionEvidence: string | null
  createdAt: string
  updatedAt: string
  statusEvents: FundingInvoiceStatusEvent[]
}

export interface FundingActivity {
  id: string
  title: string
  detail: string
  date: string
}

export interface FundingCaseContact {
  id: string
  accountContactId: string
  name: string
  relationship: string | null
  purpose: 'family_contact' | 'coordinator_contact' | 'authorization_contact' | 'other'
  email: string | null
  phone: string | null
}

export interface FundingCase {
  id: string
  studentId?: string
  studentPersonId?: string | null
  payerId?: string
  fundingOrganizationId?: string | null
  profileVersionId?: string | null
  profileVersion?: number | null
  student: string
  parent: string
  fundingOrganization: string
  programType: string
  service: string
  selectedServiceCodes?: string[]
  programServiceCodes?: string[]
  programStudentRequirements?: FundingStudentRequirement[]
  status: FundingCaseStatus
  statusLabel: string
  owner: FundingOwner
  nextStep: string
  nextStepOptions: string[]
  dueDate: string | null
  amountExpected: number
  amountPaid: number
  outstanding: number
  authorization: string
  authorizationStartDate: string | null
  authorizationEndDate: string | null
  coveragePercent: number | null
  coverageCap: number | null
  invoiceCadence: string
  submissionRoute: string
  paymentMethod: string
  instructions: string
  updatedAt: string
  invoices: FundingInvoice[]
  activity: FundingActivity[]
  contacts: FundingCaseContact[]
  missingDetails: string[]
}

export interface FundingGuideStep {
  id: string
  title: string
  description: string
  mediaUrl: string | null
  actionLabel: string | null
  actionUrl: string | null
}

export type FundingStudentField = 'authorization_reference' | 'authorization_start_date' | 'authorization_end_date' | 'service_description' | 'service_code' | 'coverage_percent' | 'coverage_cap' | 'coordinator_contact' | 'family_contact' | 'required_documents'

export interface FundingStudentRequirement extends FundingGuideStep {
  field: FundingStudentField
  required: boolean
}

export interface FundingProgramContact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
}

export interface FundingProgram {
  id: string
  organizationId: string
  profileVersionId: string
  name: string
  organizationName: string
  type: string
  routing: string
  cadence: string
  activeCases: number
  outstanding: number
  observedPayment: string
  verification: string
  affiliationStatus: 'established' | 'setup_required'
  catalogKey: string | null
  roles: string[]
  provenanceLabel: string | null
  portalUrl: string | null
  instructions: string
  requiredDocuments: string[]
  serviceCodes: string[]
  paymentTiming: string | null
  lastReviewedAt: string | null
  affiliationSteps: FundingGuideStep[]
  studentRequirements: FundingStudentRequirement[]
  billingGuidance: FundingGuideStep[]
  contacts: FundingProgramContact[]
  profilePayload?: Record<string, unknown>
}