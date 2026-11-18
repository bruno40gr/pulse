import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { communicationRecipients, recipientVersion, validContactSelection } from '@/lib/communication-recipient-directory'
import { showcaseRecovery } from '@/lib/showcase-email-recovery-server'
import { showcaseRecoveryOpen } from '@/lib/showcase-email-recovery'

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) return NextResponse.json({ error: 'Contact access is required.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (body?.recoveryOf != null) {
    if (typeof body.recoveryOf !== 'string' || body.channel !== 'email') return NextResponse.json({ error: 'Invalid follow-up selection.' }, { status: 400, headers })
    if (!showcaseRecoveryOpen()) return NextResponse.json({ error: 'The first Showcase date has passed. This invitation is closed.' }, { status: 409, headers })
    try {
      const { resolution, recoveryAttempts } = await showcaseRecovery(access.tenantId, body.recoveryOf)
      const available = resolution.recipients.filter(row => !recoveryAttempts[row.destination])
      return NextResponse.json({ ...resolution, recipients: available, selectedCount: available.length, version: recipientVersion(resolution) }, { headers })
    } catch { return NextResponse.json({ error: 'The follow-up audience could not be verified.' }, { status: 409, headers }) }
  }
  if (!validContactSelection(body?.contactIds) || !['email', 'sms'].includes(body?.channel)) return NextResponse.json({ error: 'Choose contacts and a valid channel.' }, { status: 400, headers })
  try {
    const result = await communicationRecipients(access.tenantId, body.contactIds, body.channel)
    return NextResponse.json({ ...result, version: recipientVersion(result) }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Recipients unavailable.' }, { status: 409, headers }) }
}