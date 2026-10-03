import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  FUNDING_CATALOG_PLAYBOOK_VERSION,
  HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS,
  getFundingCatalogOrganization,
  type FundingCatalogOrganization,
  type FundingOrganizationRole,
} from '@/lib/funding/catalog'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function rpcId(value: unknown, operation: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${operation} did not return an organization ID.`)
  return value
}

export function legacyOrganizationType(role: FundingOrganizationRole) {
  if (role === 'fms') return 'fms'
  if (role === 'funding_source') return 'regional_center'
  return 'other'
}

export function catalogProgramInput(catalogOrganization: FundingCatalogOrganization, organizationType: string) {
  return {
    organization_name: catalogOrganization.name,
    program_name: catalogOrganization.guidance.programName,
    organization_type: organizationType,
    recipient_routing: catalogOrganization.guidance.recipientRouting,
    payment_terms: {
      invoice_cadence: catalogOrganization.guidance.invoiceCadence,
      stated_payment_timing: catalogOrganization.guidance.paymentTiming,
    },
    submission_config: {
      portal_url: catalogOrganization.guidance.portalUrl,
      instructions: catalogOrganization.guidance.instructions,
      affiliation_steps: catalogOrganization.guidance.affiliationSteps.map(step => ({ ...step, media_url: null, action_label: step.actionLabel ?? null, action_url: step.actionUrl ?? null })),
      billing_guidance: catalogOrganization.guidance.billingGuidance.map(step => ({ ...step, media_url: null, action_label: step.actionLabel ?? null, action_url: step.actionUrl ?? null })),
    },
    organization_rules: {},
    onboarding_requirements: {
      program_setup_checkpoints: catalogOrganization.guidance.affiliationSteps.map(step => step.id),
      student_requirements: catalogOrganization.guidance.studentRequirements,
    },
    required_documents: catalogOrganization.guidance.requiredDocuments,
    invoice_requirements: { service_codes: catalogOrganization.guidance.serviceCodes },
    workflow_rules: {},
    field_metadata: {
      catalog_key: catalogOrganization.id,
      catalog_playbook_version: FUNDING_CATALOG_PLAYBOOK_VERSION,
      entity_status: catalogOrganization.entityStatus,
      rule_verification: catalogOrganization.guidance.verification,
      provenance: catalogOrganization.provenance,
      source_urls: catalogOrganization.provenance.sourceUrls,
      last_reviewed_at: catalogOrganization.provenance.verifiedAt,
    },
    verified: catalogOrganization.guidance.verification === 'verified',
  }
}

export async function bootstrapHeadlinerFundingPrograms(tenantId: string, membershipId: string) {
  if (tenantId !== HEADLINER_TENANT_ID) throw new Error('Established program bootstrap is limited to Headliner.')
  const { data: organizations, error } = await supabaseAdmin
    .from('funding_organizations')
    .select('id, catalog_key, profiles:funding_profile_versions(id, status, field_metadata)')
    .eq('tenant_id', tenantId)
    .in('catalog_key', [...HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS])
  if (error) throw error

  const byCatalogKey = new Map((organizations || []).map(organization => [organization.catalog_key, organization]))
  for (const catalogKey of HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS) {
    const catalogOrganization = getFundingCatalogOrganization(catalogKey)
    if (!catalogOrganization) continue
    const organization = byCatalogKey.get(catalogKey)
    const input = catalogProgramInput(catalogOrganization, legacyOrganizationType(catalogOrganization.roles[0]))
    let organizationId = organization?.id

    if (!organizationId) {
      const { data, error: createError } = await supabaseAdmin.rpc('odeon_create_funding_program', { p_tenant_id: tenantId, p_membership_id: membershipId, p_input: input })
      if (createError) throw createError
      organizationId = rpcId(data, `Headliner ${catalogOrganization.name} bootstrap`)
      const { error: catalogError } = await supabaseAdmin.from('funding_organizations').update({
        catalog_key: catalogOrganization.id,
        catalog_provenance: { ...catalogOrganization.provenance, source_label: catalogOrganization.provenance.sourceLabel, entity_status: catalogOrganization.entityStatus },
      }).eq('tenant_id', tenantId).eq('id', organizationId)
      if (catalogError) throw catalogError
    } else {
      const activeProfile = (organization?.profiles || []).find((profile: { status: string }) => profile.status === 'active')
      if (object(activeProfile?.field_metadata).catalog_playbook_version !== FUNDING_CATALOG_PLAYBOOK_VERSION) {
        const { error: profileError } = await supabaseAdmin.rpc('odeon_create_funding_profile_version', {
          p_tenant_id: tenantId, p_funding_organization_id: organizationId, p_profile: input,
          p_change_note: `Applied catalog funding playbook ${FUNDING_CATALOG_PLAYBOOK_VERSION}.`, p_membership_id: membershipId,
        })
        if (profileError) throw profileError
      }
    }

    const { error: roleError } = await supabaseAdmin.from('funding_organization_roles').upsert(catalogOrganization.roles.map(role => ({
      tenant_id: tenantId, funding_organization_id: organizationId, role,
      provenance: { catalog_key: catalogOrganization.id, source: catalogOrganization.provenance.sourceLabel },
    })), { onConflict: 'funding_organization_id,role' })
    if (roleError) throw roleError

    const { data: activeProfile, error: activeProfileError } = await supabaseAdmin.from('funding_profile_versions')
      .select('id').eq('tenant_id', tenantId).eq('funding_organization_id', organizationId).eq('status', 'active').single()
    if (activeProfileError) throw activeProfileError
    const { error: relationshipError } = await supabaseAdmin.from('funding_program_organizations').upsert(catalogOrganization.roles.map((role, index) => ({
      tenant_id: tenantId, funding_profile_version_id: activeProfile.id, funding_organization_id: organizationId, role, is_primary: index === 0,
    })), { onConflict: 'funding_profile_version_id,funding_organization_id,role' })
    if (relationshipError) throw relationshipError
  }
}