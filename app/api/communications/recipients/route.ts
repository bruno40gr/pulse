import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { communicationRecipients, recipientVersion, validContactSelection } from '@/lib/communication-recipient-directory'

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) return NextResponse.json({ error: 'Contact access is required.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (!validContactSelection(body?.contactIds) || !['email', 'sms'].includes(body?.channel)) return NextResponse.json({ error: 'Choose contacts and a valid channel.' }, { status: 400, headers })
  try {
    const result = await communicationRecipients(access.tenantId, body.contactIds, body.channel)
    return NextResponse.json({ ...result, version: recipientVersion(result) }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Recipients unavailable.' }, { status: 409, headers }) }
}