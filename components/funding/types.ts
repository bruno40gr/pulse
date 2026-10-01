export type FundingCaseStatus = 'needs_review' | 'waiting' | 'active' | 'paid'
export type FundingOwner = 'Vendor' | 'Family' | 'Funder'

export interface FundingActivity {
  id: string
  title: string
  detail: string
  date: string
}

export interface FundingCase {
  id: string
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