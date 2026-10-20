import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { headlinerEmailTemplates, HEADLINER_TEMPLATE_TENANT } from '@/lib/headliner-email-templates'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  return NextResponse.json({ templates: access.tenantId === HEADLINER_TEMPLATE_TENANT ? headlinerEmailTemplates : [] }, { headers })
}