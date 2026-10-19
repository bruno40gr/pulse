import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { conversationDirectory } from '@/lib/conversations-directory'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const allowed = (permission: typeof PERMISSIONS.contactsRead | typeof PERMISSIONS.leadsRead) =>
    access.context?.roleKey === 'owner' || Boolean(access.context?.permissions.has(permission))
  try {
    return NextResponse.json({ people: await conversationDirectory(access.tenantId, allowed(PERMISSIONS.contactsRead), allowed(PERMISSIONS.leadsRead)) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Conversation recipients could not be loaded.' }, { status: 503 })
  }
}