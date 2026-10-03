import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getFundingCatalogOrganization,
  isEstablishedFundingAffiliation,
} from '@/lib/funding/catalog'
import { catalogProgramInput, legacyOrganizationType } from '@/lib/funding/program-bootstrap'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function rpcId(value: unknown, operation: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${operation} did not return an organization ID.`)
  return value
}

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { data, error } = await supabaseAdmin
      .from('funding_organizations')
      .select('*, profiles:funding_profile_versions(*), contacts:funding_organization_contacts(*), roles:funding_organization_roles(role)')
      .eq('tenant_id', access.tenantId)
      .order('name')
    if (error) throw error
    return NextResponse.json((data || []).flatMap(organization => {
      const profiles = (organization.profiles || []).filter((profile: { status: string }) => profile.status === 'active')
      const profile = profiles.sort((a: { version_number: number }, b: { version_number: number }) => b.version_number - a.version_number)[0]
      if (!profile) return []
      const submission = object(profile.submission_config)
      const paymentTerms = object(profile.payment_terms)
      const organizationRules = object(profile.organization_rules)
      const onboardingRequirements = object(profile.onboarding_requirements)
      const invoiceRequirements = object(profile.invoice_requirements)
      const fieldMetadata = object(profile.field_metadata)
      const affiliationSteps = Array.isArray(submission.affiliation_steps) ? submission.affiliation_steps : []
      const studentRequirements = Array.isArray(onboardingRequirements.student_requirements) ? onboardingRequirements.student_requirements : []
      const billingGuidance = Array.isArray(submission.billing_guidance) ? submission.billing_guidance : []
      return [{
        id: profile.id,
        organizationId: organization.id,
        profileVersionId: profile.id,
        name: profile.program_name || organization.name,
        organizationName: organization.name,
        type: organization.organization_type,
        routing: profile.recipient_routing || 'Not configured',
        cadence: typeof paymentTerms.invoice_cadence === 'string' ? paymentTerms.invoice_cadence : 'Not configured',
        activeCases: 0,
        outstanding: 0,
        observedPayment: typeof paymentTerms.observed_payment_timing === 'string' ? paymentTerms.observed_payment_timing : 'Not enough data',
        verification: profile.verified_at ? 'Reviewed' : 'Product review needed',
        affiliationStatus: isEstablishedFundingAffiliation(access.tenantId, typeof organization.catalog_key === 'string' ? organization.catalog_key : null) ? 'established' : 'setup_required',
        catalogKey: typeof organization.catalog_key === 'string' ? organization.catalog_key : null,
        roles: (organization.roles || []).map((item: { role: string }) => item.role),
        provenanceLabel: typeof object(organization.catalog_provenance).source_label === 'string' ? String(object(organization.catalog_provenance).source_label) : null,
        portalUrl: typeof submission.portal_url === 'string' ? submission.portal_url : null,
        instructions: typeof submission.instructions === 'string' ? submission.instructions : '',
        requiredDocuments: Array.isArray(profile.required_documents) ? profile.required_documents.filter((item: unknown): item is string => typeof item === 'string') : [],
        serviceCodes: Array.isArray(invoiceRequirements.service_codes) ? invoiceRequirements.service_codes.filter((item: unknown): item is string => typeof item === 'string') : [],
        paymentTiming: typeof paymentTerms.stated_payment_timing === 'string' ? paymentTerms.stated_payment_timing : null,
        lastReviewedAt: typeof fieldMetadata.last_reviewed_at === 'string' ? fieldMetadata.last_reviewed_at : null,
        affiliationSteps: serializeSteps(affiliationSteps),
        studentRequirements: studentRequirements.map((requirement: unknown, index: number) => {
          const value = object(requirement)
          return {
            id: typeof value.id === 'string' ? value.id : `requirement-${index + 1}`,
            title: typeof value.title === 'string' ? value.title : `Requirement ${index + 1}`,
            description: typeof value.description === 'string' ? value.description : '',
            field: typeof value.field === 'string' ? value.field : 'service_description',
            required: value.required === true,
            mediaUrl: null,
            actionLabel: null,
            actionUrl: null,
          }
        }),
        billingGuidance: serializeSteps(billingGuidance),
        contacts: (organization.contacts || []).filter((contact: { is_active: boolean }) => contact.is_active).map((contact: { id: string; name: string; role: string | null; email: string | null; phone: string | null }) => ({
          id: contact.id, name: contact.name, role: contact.role, email: contact.email, phone: contact.phone,
        })),
        profilePayload: {
          program_name: profile.program_name,
          recipient_routing: profile.recipient_routing,
          payment_terms: paymentTerms,
          submission_config: submission,
          organization_rules: organizationRules,
          onboarding_requirements: onboardingRequirements,
          required_documents: profile.required_documents,
          invoice_requirements: invoiceRequirements,
          workflow_rules: profile.workflow_rules,
          field_metadata: fieldMetadata,
          verified: Boolean(profile.verified_at),
        },
      }]
    }))
  } catch (error) {
    console.error('[funding][organizations][list]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

function serializeSteps(steps: unknown[]) {
  return steps.map((step: unknown, index: number) => {
          const value = object(step)
          return {
            id: typeof value.id === 'string' ? value.id : `step-${index + 1}`,
            title: typeof value.title === 'string' ? value.title : `Step ${index + 1}`,
            description: typeof value.description === 'string' ? value.description : '',
            mediaUrl: typeof value.media_url === 'string' ? value.media_url : null,
            actionLabel: typeof value.action_label === 'string' ? value.action_label : null,
            actionUrl: typeof value.action_url === 'string' ? value.action_url : null,
          }
  })
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const body = object(await request.json())
    const catalogId = typeof body.catalog_id === 'string' ? body.catalog_id.trim() : ''
    const catalogOrganization = getFundingCatalogOrganization(catalogId)
    if (!catalogOrganization) return NextResponse.json({ error: 'Choose a known funding organization.' }, { status: 400 })
    const primaryRole = catalogOrganization.roles[0]
    const organizationType = legacyOrganizationType(primaryRole)
    const input = catalogProgramInput(catalogOrganization, organizationType)
    const { data: existingOrganization, error: existingOrganizationError } = await supabaseAdmin
      .from('funding_organizations')
      .select('id')
      .eq('tenant_id', access.tenantId)
      .eq('catalog_key', catalogOrganization.id)
      .is('archived_at', null)
      .maybeSingle()
    if (existingOrganizationError) throw existingOrganizationError
    if (existingOrganization) return NextResponse.json({ error: 'This funding organization is already in your programs.' }, { status: 409 })
    const { data, error } = await supabaseAdmin.rpc('odeon_create_funding_program', {
      p_tenant_id: access.tenantId,
      p_membership_id: access.context.membershipId,
      p_input: input,
    })
    if (error) throw error
    const organizationId = rpcId(data, 'Funding program creation')
    const { error: organizationUpdateError } = await supabaseAdmin.from('funding_organizations').update({
      catalog_key: catalogOrganization.id,
      catalog_provenance: {
        ...catalogOrganization.provenance,
        source_label: catalogOrganization.provenance.sourceLabel,
        entity_status: catalogOrganization.entityStatus,
      },
    }).eq('tenant_id', access.tenantId).eq('id', organizationId)
    if (organizationUpdateError) throw organizationUpdateError
    const { error: roleError } = await supabaseAdmin.from('funding_organization_roles').upsert(
      catalogOrganization.roles.map(role => ({
        tenant_id: access.tenantId,
        funding_organization_id: organizationId,
        role,
        provenance: { catalog_key: catalogOrganization.id, source: catalogOrganization.provenance.sourceLabel },
      })),
      { onConflict: 'funding_organization_id,role' },
    )
    if (roleError) throw roleError
    const { data: activeProfile, error: profileError } = await supabaseAdmin.from('funding_profile_versions')
      .select('id').eq('tenant_id', access.tenantId).eq('funding_organization_id', organizationId).eq('status', 'active').single()
    if (profileError) throw profileError
    const { error: relationshipError } = await supabaseAdmin.from('funding_program_organizations').upsert(
      catalogOrganization.roles.map((role, index) => ({
        tenant_id: access.tenantId,
        funding_profile_version_id: activeProfile.id,
        funding_organization_id: organizationId,
        role,
        is_primary: index === 0,
      })),
      { onConflict: 'funding_profile_version_id,funding_organization_id,role' },
    )
    if (relationshipError) throw relationshipError
    return NextResponse.json({ organizationId }, { status: 201 })
  } catch (error) {
    console.error('[funding][organizations][create]', error)
    const candidate = error as { code?: string; message?: string }
    const conflict = candidate.code === '23505'
    return NextResponse.json({ error: conflict ? 'This funding organization is already in your programs.' : candidate.message }, { status: conflict ? 409 : 500 })
  }
}
