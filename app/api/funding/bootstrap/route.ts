import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { bootstrapHeadlinerFundingPrograms } from '@/lib/funding/program-bootstrap'

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.dataMigrationsRun)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    await bootstrapHeadlinerFundingPrograms(access.tenantId, access.context.membershipId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[funding][bootstrap]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}