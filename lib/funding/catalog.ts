export type FundingOrganizationRole = 'funding_source' | 'administrator' | 'fms' | 'vendor'

export type FundingStudentField = 'authorization_reference' | 'authorization_start_date' | 'authorization_end_date' | 'service_description' | 'service_code' | 'coverage_percent' | 'coverage_cap' | 'coordinator_contact' | 'family_contact' | 'required_documents'

export interface FundingGuidanceStep {
  id: string
  title: string
  description: string
  /** Optional link back to the official source for this step. */
  actionLabel?: string | null
  actionUrl?: string | null
}

export interface FundingStudentRequirement extends FundingGuidanceStep {
  field: FundingStudentField
  required: boolean
}

export interface FundingCatalogOrganization {
  id: string
  name: string
  aliases: string[]
  roles: FundingOrganizationRole[]
  entityStatus: 'verified' | 'provisional'
  provenance: {
    sourceType: 'correspondence' | 'official_registry' | 'product_research'
    sourceLabel: string
    verifiedAt: string | null
    sourceUrls: string[]
  }
  guidance: {
    programName: string
    recipientRouting: string | null
    invoiceCadence: string | null
    paymentTiming: string | null
    portalUrl: string | null
    instructions: string
    requiredDocuments: string[]
    serviceCodes: string[]
    affiliationSteps: FundingGuidanceStep[]
    studentRequirements: FundingStudentRequirement[]
    billingGuidance: FundingGuidanceStep[]
    verification: 'verified' | 'needs_review'
  }
}

export const FUNDING_CATALOG_PLAYBOOK_VERSION = '2026-10-02-v3'

export const HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS = [
  'alta-california-regional-center',
  'ace-fms',
  'mainsl',
] as const

// Transitional bootstrap only: this allowlist approximates Headliner's tenant-to-program
// affiliations until the product has evidence and requirements for a durable affiliation
// entity. Do not treat membership here as global catalog truth or final domain state.

// Entity identity is catalog-backed. Operational rules remain deliberately empty
// until a product-side review has source evidence for the exact rule and date.
export const FUNDING_ORGANIZATION_CATALOG: FundingCatalogOrganization[] = [
  catalog('alta-california-regional-center', 'Alta California Regional Center', ['ACRC', 'Alta Regional Center'], ['funding_source'], 'official_registry', {
    instructions: 'Vendorization is Alta’s approval process for providing services through a regional center, and it is applied for online through the Department of Developmental Services Provider Directory. Starting March 1, 2026 all new vendor applications must be completed in the Provider Directory. Keep the vendor relationship separate from each student authorization: once the vendor number and service code are issued, assign the student and record the active authorization, service details, and coordinator contact on the funded-student case.',
    affiliationSteps: [
      { id: 'provider-directory-profile', title: 'Create or sign in to your Provider Directory profile', description: 'Open the Provider Directory vendor login. If your business is new to the directory, create a login profile; if your business is already listed, sign in with the existing credentials.', actionLabel: 'Alta: steps to apply', actionUrl: 'https://www.altaregional.org/post/what-are-steps-apply' },
      { id: 'minimum-requirements', title: 'Submit the minimum requirements', description: 'Submit the information that shows your business meets the minimum requirements. Alta reviews the request within 15 calendar days.' },
      { id: 'vendorization-application', title: 'Submit the vendorization application', description: 'If the basic requirements are met, Alta asks for the additional information and documents that support the application. Alta reviews the application for completeness within 30 calendar days; if anything is missing or incorrect you have 30 calendar days to supply it, and that clock pauses for the regional center rather than resetting.' },
      { id: 'vendorization-decision', title: 'Receive the vendorization decision', description: 'Alta makes a vendorization decision within 45 calendar days. Approval issues a vendor number; a denial arrives with a notice and appeal rights. Vendorization does not guarantee referrals or placements (Title 17 CCR §54322(d)(10)).', actionLabel: 'Alta: what vendorization covers', actionUrl: 'https://www.altaregional.org/post/what-vendorization' },
    ],
    studentRequirements: [
      { id: 'authorization', field: 'authorization_reference', required: true, title: 'Authorization reference', description: 'Record the student-specific authorization or purchase-order reference.' },
      { id: 'authorization-dates', field: 'authorization_start_date', required: true, title: 'Covered dates', description: 'Record the authorization start and end dates for the student.' },
      { id: 'service', field: 'service_description', required: true, title: 'Authorized service', description: 'Describe the service approved for this student.' },
      { id: 'coordinator', field: 'coordinator_contact', required: false, title: 'Coordinator contact', description: 'Capture the case-specific coordinator or routing contact when available.' },
      { id: 'documents', field: 'required_documents', required: false, title: 'Authorization document', description: 'Attach or acknowledge the applicable authorization documentation.' },
    ],
    billingGuidance: [
      { id: 'billing-readiness', title: 'Confirm billing readiness', description: 'Review the authorization and case details before billing. Regional Center delays remain case context rather than a separate vendor onboarding workflow.' },
      { id: 'provider-directory-deadline', title: 'Track the Provider Directory deadline', description: 'The Provider Directory digital vendorization process launched in December 2025, and all new vendor applications must be completed in the Provider Directory starting March 1, 2026.', actionLabel: 'DDS: standardized vendor application update', actionUrl: 'https://www.dds.ca.gov/newsletter/standardized-vendor-application-process-update/' },
    ],
    verification: 'verified',
  }, {
    sourceLabel: 'Alta vendorization steps and DDS Provider Directory directive (reviewed February 24, 2026)',
    verifiedAt: '2026-02-24',
    sourceUrls: [
      'https://www.altaregional.org/post/what-are-steps-apply',
      'https://www.altaregional.org/post/what-vendorization',
      'https://www.dds.ca.gov/newsletter/standardized-vendor-application-process-update/',
    ],
  }),
  catalog('mainsl', "Mains'l", ['Mainsl'], ['fms', 'administrator'], 'correspondence', {
    paymentTiming: 'Published amount tiers: up to $500 in 1 week; up to $9,999.99 in 3 weeks; $10,000 or more in 5 weeks.',
    instructions: 'Establish the vendor relationship once, then assign each student with their authorization and service details. Track the family approval or attestation event because payment timing depends on the completed approval workflow.',
    affiliationSteps: [
      { id: 'vendor-affiliation', title: 'Complete vendor setup', description: 'Finish the organization-level approval and retain the reusable vendor details for future students.' },
    ],
    studentRequirements: [
      { id: 'authorization', field: 'authorization_reference', required: true, title: 'Authorization reference', description: 'Record the authorization that covers this student.' },
      { id: 'service', field: 'service_description', required: true, title: 'Service and coverage', description: 'Record the service and applicable coverage for this student.' },
      { id: 'family-contact', field: 'family_contact', required: false, title: 'Family contact', description: 'Capture the family contact responsible for approval or attestation.' },
      { id: 'documents', field: 'required_documents', required: false, title: 'Student documents', description: 'Acknowledge the applicable authorization and approval documents.' },
    ],
    billingGuidance: [
      { id: 'family-approval', title: 'Capture family approval', description: 'Track the required family attestation and preserve its completion time for the payment timeline.' },
      { id: 'payment-window', title: 'Track the amount-based payment window', description: 'Use the submitted amount to calculate the stated one-, three-, or five-week payment window; keep observed timing separate.' },
    ],
  }),
  catalog('ace-fms', 'ACE FMS', ['ACE Financial Management Services'], ['fms', 'administrator'], 'correspondence', {
    paymentTiming: 'Submitted 1st–15th and approved by the 18th: paid the 25th. Submitted 16th–month end and approved by the 3rd: paid the 10th.',
    instructions: 'Complete the ACE vendor workflow once, then reuse the established relationship when assigning students. Keep accepted document alternatives and rejection corrections in the shared profile, while temporary representative instructions stay on the student case.',
    affiliationSteps: [
      { id: 'vendor-agreement', title: 'Complete the ACE vendor workflow', description: 'Finish the external vendor agreement or requested setup task once and retain the resulting reference for reuse.' },
      { id: 'requirements', title: 'Confirm accepted requirements', description: 'Review the current document requirements and accepted alternatives before submission; do not promote one representative’s temporary instruction into a global rule.' },
    ],
    studentRequirements: [
      { id: 'authorization', field: 'authorization_reference', required: true, title: 'Authorization reference', description: 'Record the authorization covering the student.' },
      { id: 'service', field: 'service_description', required: true, title: 'Authorized service', description: 'Describe the service being delivered.' },
      { id: 'service-code', field: 'service_code', required: false, title: 'Service code', description: 'Record the authorized service code when one is supplied.' },
      { id: 'coverage', field: 'coverage_percent', required: false, title: 'Coverage', description: 'Record the applicable percentage or cap.' },
      { id: 'contact', field: 'coordinator_contact', required: false, title: 'Case contact', description: 'Capture the representative or coordinator assigned to this student.' },
      { id: 'documents', field: 'required_documents', required: false, title: 'Student documents', description: 'Acknowledge the documents applicable to this authorization.' },
    ],
    billingGuidance: [
      { id: 'approval-window', title: 'Track approval and payment dates', description: 'Record submission and approval dates so the stated 25th-or-10th payment date can be calculated.' },
    ],
  }),
  catalog('aveanna', 'Aveanna', ['Aveanna Healthcare'], ['fms', 'administrator'], 'correspondence'),
  catalog('on-my-own-independent-living-services', 'On My Own Independent Living Services', ['On My Own', 'OMO'], ['fms', 'administrator'], 'official_registry'),
  catalog('accura-fms', 'Accura FMS', ['Accura Financial Management Services'], ['fms', 'administrator'], 'official_registry'),
  catalog('public-partnerships', 'Public Partnerships', ['PPL', 'Public Partnerships LLC'], ['fms', 'administrator'], 'official_registry'),
]

function catalog(
  id: string,
  name: string,
  aliases: string[],
  roles: FundingOrganizationRole[],
  sourceType: FundingCatalogOrganization['provenance']['sourceType'],
  guidance: Partial<FundingCatalogOrganization['guidance']> = {},
  provenance: Partial<FundingCatalogOrganization['provenance']> = {},
): FundingCatalogOrganization {
  return {
    id,
    name,
    aliases,
    roles,
    entityStatus: 'verified',
    provenance: {
      sourceType,
      sourceLabel: provenance.sourceLabel ?? (sourceType === 'correspondence' ? 'Confirmed in product correspondence review' : 'Confirmed active entity; operational rules not yet reviewed'),
      verifiedAt: provenance.verifiedAt ?? null,
      sourceUrls: provenance.sourceUrls ?? [],
    },
    guidance: {
      programName: name,
      recipientRouting: guidance.recipientRouting ?? null,
      invoiceCadence: guidance.invoiceCadence ?? null,
      paymentTiming: guidance.paymentTiming ?? null,
      portalUrl: guidance.portalUrl ?? null,
      instructions: guidance.instructions || 'Operational guidance is awaiting product-side verification. Record tenant-specific contacts and student exceptions without treating unverified rules as authoritative.',
      requiredDocuments: guidance.requiredDocuments || [],
      serviceCodes: guidance.serviceCodes || [],
      affiliationSteps: guidance.affiliationSteps || [],
      studentRequirements: guidance.studentRequirements || [],
      billingGuidance: guidance.billingGuidance || [],
      verification: guidance.verification || 'needs_review',
    },
  }
}

export function getFundingCatalogOrganization(id: string) {
  return FUNDING_ORGANIZATION_CATALOG.find(item => item.id === id) || null
}

export function isEstablishedFundingAffiliation(tenantId: string, catalogKey: string | null) {
  return tenantId === '00000000-0000-0000-0000-000000000001'
    && Boolean(catalogKey)
    && HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS.includes(catalogKey as typeof HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS[number])
}