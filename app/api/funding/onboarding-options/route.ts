import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const [{ data: students, error: studentError }, { data: organizations, error: organizationError }] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, client_status, person:people!inner(first_name, last_name), account:accounts(name)')
        .eq('tenant_id', access.tenantId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('funding_organizations')
        .select('id, name, organization_type, profiles:funding_profile_versions(id, version_number, status, program_name, recipient_routing, payment_terms, submission_config)')
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
          name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unnamed student',
          accountName: account?.name || null,
          status: student.client_status,
        }
      }).sort((a, b) => a.name.localeCompare(b.name)),
      organizations: (organizations || []).map(organization => {
        const profiles = (organization.profiles || []).filter(profile => profile.status === 'active')
        const profile = profiles.sort((a, b) => b.version_number - a.version_number)[0] || null
        return {
          id: organization.id,
          name: organization.name,
          organizationType: organization.organization_type,
          activeProfile: profile ? {
            id: profile.id,
            version: profile.version_number,
            programName: profile.program_name,
            recipientRouting: profile.recipient_routing,
            paymentTerms: profile.payment_terms,
            submissionConfig: profile.submission_config,
          } : null,
        }
      }),
    })
  } catch (error) {
    console.error('[funding][onboarding-options]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}