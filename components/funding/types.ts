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
  invoiceCadence: string
  submissionRoute: string
  paymentMethod: string
  instructions: string
  updatedAt: string
  invoices: FundingInvoice[]
  activity: FundingActivity[]
}

export interface FundingProgram {
  id: string
  name: string
  type: string
  routing: string
  cadence: string
  activeCases: number
  outstanding: number
  observedPayment: string
  verification: string
}