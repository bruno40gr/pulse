import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { communicationRecipients, recipientVersion, validContactSelection } from '@/lib/communication-recipient-directory'
import { groupEmailSelection } from '@/lib/group-email-selection'
import { organisationSender } from '@/lib/organisation-email'
import { gmailMime } from '@/lib/gmail/conversations'
import { unresolvedEmailPlaceholders } from '@/lib/headliner-email-templates'
import { writeAccountAuditEvent } from '@/lib/account-audit'

const headers = { 'Cache-Control': 'private, no-store' }

/** Explicit shared email only. SMS and default bulk email remain independent deliveries. */
export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || /^(family|student|parent|customer|guardian)$/.test(access.context.roleKey)
    || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) {
    return NextResponse.json({ error: 'Staff contact access is required.' }, { status: 403, headers })
  }
  const input = await request.json().catch(() => null)
  if (!validContactSelection(input?.contactIds) || typeof input.version !== 'string' || typeof input.senderEmail !== 'string'
    || typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 500 || /[\r\n]/.test(input.subject)
    || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 100000
    || typeof input.html !== 'string' || input.html.length > 200000
    || unresolvedEmailPlaceholders(`${input.subject}\n${input.body}\n${input.html}`).length
    || /\{(?:first_name|last_name|student[^}]*|instrument)\}/i.test(`${input.subject}\n${input.body}\n${input.html}`)) {
    return NextResponse.json({ error: 'Choose contacts and complete the email without personal placeholders.' }, { status: 400, headers })
  }
  let deliveryStarted = false
  try {
    const audience = await communicationRecipients(access.tenantId, input.contactIds, 'email')
    if (recipientVersion(audience) !== input.version) return NextResponse.json({ error: 'Recipient details changed. Reopen the composer to review the updated recipients.' }, { status: 409, headers })
    const recipients = groupEmailSelection(input.recipients, audience)
    const mailbox = await organisationSender(access.tenantId, access.context.membershipId, input.senderEmail)
    // An all-BCC audience needs a visible To address, never a secretly exposed band member.
    const raw = gmailMime({ from: mailbox.sender.email, fromName: mailbox.sender.name,
      to: recipients.to.length ? recipients.to : [mailbox.sender.email], cc: recipients.cc, bcc: recipients.bcc,
      subject: input.subject, body: input.body, html: input.html })
    deliveryStarted = true
    // The Gmail read helper retries; sends must never retry after an ambiguous response.
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${mailbox.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') }), signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error('Gmail did not confirm delivery.')
    const sent = await response.json()
    await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: access.context.membershipId,
      eventType: 'communications.email_sent', metadata: { mailbox_id: mailbox.id, provider_message_id: sent.id,
        recipient_count: recipients.to.length + recipients.cc.length + recipients.bcc.length } }).catch(() => false)
    return NextResponse.json({ sent: true }, { headers })
  } catch (error) {
    return NextResponse.json({ error: deliveryStarted ? 'Delivery could not be confirmed. Check the shared mailbox’s Sent folder before sending again.'
      : error instanceof Error ? error.message : 'Email recipients could not be verified.', uncertain: deliveryStarted }, { status: deliveryStarted ? 502 : 409, headers })
  }
}