import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isEstablishedFundingAffiliation } from '@/lib/funding/catalog'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const [{ data: students, error: studentError }, { data: organizations, error: organizationError }] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, client_status, account_id, person:people!inner(first_name, last_name), account:accounts(id, name)')
        .eq('tenant_id', access.tenantId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('funding_organizations')
        .select('id, name, organization_type, catalog_key, profiles:funding_profile_versions(id, version_number, status, program_name, recipient_routing, payment_terms, submission_config, onboarding_requirements, required_documents, invoice_requirements)')
        .eq('tenant_id', access.tenantId)
        .eq('status', 'active')
        .order('name'),
    ])
    if (studentError) throw studentError
    if (organizationError) throw organizationError
    return NextResponse.json({
      students: (students || []).map(student => {
        const person = Array.isArray(student.person) ? student.person[0] : student.person
        const account = Array.isArray(student.account) ? student.account[0] : student.account
        return {
          id: student.id,
          accountId: student.account_id || account?.id || null,
          name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unnamed student',
          accountName: account?.name || null,
          status: student.client_status,
        }
      }).sort((a, b) => a.name.localeCompare(b.name)),
      programs: (organizations || []).flatMap(organization => {
        const profiles = (organization.profiles || []).filter(profile => profile.status === 'active')
        const profile = profiles.sort((a, b) => b.version_number - a.version_number)[0] || null
        if (!profile) return []
        const catalogKey = typeof organization.catalog_key === 'string' ? organization.catalog_key : null
        const affiliationStatus = isEstablishedFundingAffiliation(access.tenantId, catalogKey) ? 'established' : 'setup_required'
        if (affiliationStatus !== 'established') return []
        const onboardingRequirements = object(profile.onboarding_requirements)
        const invoiceRequirements = object(profile.invoice_requirements)
        return [{
          id: profile.id,
          organizationId: organization.id,
          organizationName: organization.name,
          organizationType: organization.organization_type,
          name: profile.program_name || organization.name,
          version: profile.version_number,
          affiliationStatus,
          studentRequirements: Array.isArray(onboardingRequirements.student_requirements) ? onboardingRequirements.student_requirements : [],
          requiredDocuments: Array.isArray(profile.required_documents) ? profile.required_documents.filter((value): value is string => typeof value === 'string') : [],
          serviceCodes: Array.isArray(invoiceRequirements.service_codes) ? invoiceRequirements.service_codes.filter((value): value is string => typeof value === 'string') : [],
        }]
      }),
    })
  } catch (error) {
    console.error('[funding][onboarding-options]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}