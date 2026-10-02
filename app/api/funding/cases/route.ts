import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding, loadFundingCase, loadFundingCases } from '@/lib/funding/server'
import { fundingOnboardingError, onboardFundingCase, parseOnboardFundingCaseInput } from '@/lib/funding/onboarding'

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
    const fundingCase = await loadFundingCase(access.tenantId, caseId)
    return NextResponse.json(fundingCase, { status: 201 })
  } catch (error) {
    console.error('[funding][cases][create]', error)
    const response = fundingOnboardingError(error)
    return NextResponse.json({ error: response.message }, { status: response.status })
  }
}