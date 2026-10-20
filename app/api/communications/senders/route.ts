import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { organisationSenders } from '@/lib/organisation-email'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to send email.' }, { status: 403, headers })
  try {
    const { senders } = await organisationSenders(access.tenantId, access.context.membershipId)
    return NextResponse.json({ senders }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Organisation email unavailable.' }, { status: 409, headers }) }
}