import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding, loadFundingCase, loadFundingCases } from '@/lib/funding/server'
import { fundingOnboardingError, onboardFundingCase, parseOnboardFundingCaseInput } from '@/lib/funding/onboarding'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const studentPersonId = new URL(request.url).searchParams.get('student_person_id') || undefined
    return NextResponse.json(await loadFundingCases(access.tenantId, undefined, studentPersonId))
  } catch (error) {
    console.error('[funding][cases][list]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const parsed = parseOnboardFundingCaseInput(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 })
    const caseId = await onboardFundingCase(access.tenantId, access.context.membershipId, parsed.data)
    const assignments = parsed.data.case.contact_assignments || []
    if (assignments.length > 0) {
      const { error: assignmentError } = await supabaseAdmin.from('funding_case_contacts').insert(assignments.map(assignment => ({
        tenant_id: access.tenantId,
        funding_case_id: caseId,
        account_contact_id: assignment.account_contact_id,
        purpose: assignment.purpose,
        created_by_membership_id: access.context.membershipId,
      })))
      if (assignmentError) {
        const { error: rollbackError } = await supabaseAdmin.from('funding_cases').delete().eq('id', caseId).eq('tenant_id', access.tenantId)
        if (rollbackError) console.error('[funding][cases][create][rollback]', rollbackError)
        throw assignmentError
      }
    }
    const fundingCase = await loadFundingCase(access.tenantId, caseId)
    return NextResponse.json(fundingCase, { status: 201 })
  } catch (error) {
    console.error('[funding][cases][create]', error)
    const response = fundingOnboardingError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}