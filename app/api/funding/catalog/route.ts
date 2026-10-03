import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { FUNDING_ORGANIZATION_CATALOG } from '@/lib/funding/catalog'

export async function GET(request: Request) {
  const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  return NextResponse.json(FUNDING_ORGANIZATION_CATALOG)
}