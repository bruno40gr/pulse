import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { communicationRecipients, recipientVersion, validContactSelection } from '@/lib/communication-recipient-directory'
import { organisationSender } from '@/lib/organisation-email'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { gmailMime } from '@/lib/gmail/conversations'
import { unresolvedEmailPlaceholders } from '@/lib/headliner-email-templates'
import { writeAccountAuditEvent } from '@/lib/account-audit'

export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) return NextResponse.json({ error: 'Contact access is required.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (!validContactSelection(body?.contactIds) || typeof body.senderEmail !== 'string' || typeof body.version !== 'string' || typeof body.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.operationId)
    || typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 500 || /[\r\n]/.test(body.subject)
    || typeof body.body !== 'string' || !body.body.trim() || body.body.length > 100000 || typeof body.html !== 'string' || body.html.length > 200000) return NextResponse.json({ error: 'Invalid email or contact selection.' }, { status: 400, headers })
  if (unresolvedEmailPlaceholders(`${body.subject}\n${body.body}\n${body.html}`).length || /\{(?:first_name|last_name|student[^}]*|instrument)\}/i.test(`${body.subject}\n${body.body}\n${body.html}`)) return NextResponse.json({ error: 'Use a message without student-specific placeholders for bulk email.' }, { status: 400, headers })
  try {
    const resolved = await communicationRecipients(access.tenantId, body.contactIds, 'email')
    if (recipientVersion(resolved) !== body.version) return NextResponse.json({ error: 'Recipient details changed. Review the updated count before sending.', refreshRecipients: true }, { status: 409, headers })
    if (!resolved.recipients.length) return NextResponse.json({ error: 'No email recipients are available.' }, { status: 422, headers })
    const mailbox = await organisationSender(access.tenantId, access.context.membershipId, body.senderEmail)
    const contentHash = createHash('sha256').update(JSON.stringify([body.senderEmail, body.subject, body.body, body.html, body.version])).digest('hex')
    const recorded = new Map<string, { status: string }>()
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await crmSupabaseAdmin.from('organisation_email_deliveries').select('destination,status,content_hash,actor_membership_id')
        .eq('tenant_id', access.tenantId).eq('operation_id', body.operationId).order('destination').range(offset, offset + 499)
      if (error) throw new Error('Delivery tracking unavailable. Apply Migration 026 before sending.')
      for (const row of data || []) {
        if (row.content_hash !== contentHash || row.actor_membership_id !== access.context.membershipId) throw new Error('This send operation belongs to a different message.')
        recorded.set(row.destination, row)
      }
      if ((data || []).length < 500) break
    }
    let sent = 0, pending = 0, failed = 0, uncertain = 0
    const started = Date.now()
    // Bounded batches avoid request timeouts. Reusing operationId safely continues
    // the operation: a claimed/unknown destination is never automatically retried.
    for (const recipient of resolved.recipients) {
      const previous = recorded.get(recipient.destination)
      if (previous) {
        if (previous.status === 'sent') sent++
        else if (previous.status === 'failed') failed++
        else uncertain++
        continue
      }
      if (Date.now() - started > 18000) { pending++; continue }
      const { error: claimError } = await crmSupabaseAdmin.from('organisation_email_deliveries').insert({ tenant_id: access.tenantId, operation_id: body.operationId, destination: recipient.destination, actor_membership_id: access.context.membershipId, content_hash: contentHash, status: 'sending' })
      if (claimError) {
        if (claimError.code === '23505') { uncertain++; continue }
        throw new Error('The send could not be recorded. No further emails were attempted.')
      }
      let status = 'unknown', providerId: string | null = null
      try {
        const raw = gmailMime({ from: mailbox.sender.email, fromName: mailbox.sender.name, to: [recipient.destination], cc: [], bcc: [], subject: body.subject, body: body.body, html: body.html })
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST', headers: { Authorization: `Bearer ${mailbox.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') }), signal: AbortSignal.timeout(15000),
        })
        // A provider 5xx/timeout may have accepted mail. Never retry it blindly.
        if (response.ok) { const result = await response.json(); providerId = result.id; status = 'sent'; sent++ }
        else if (response.status >= 400 && response.status < 500) { status = 'failed'; failed++ }
        else uncertain++
      } catch { uncertain++ }
      const { error: recordError } = await crmSupabaseAdmin.from('organisation_email_deliveries').update({ status, provider_message_id: providerId })
        .eq('tenant_id', access.tenantId).eq('operation_id', body.operationId).eq('destination', recipient.destination)
      if (recordError) throw new Error('Delivery confirmation could not be saved. Check Sent in the shared mailbox before taking further action.')
      if (status !== 'sent') {
        // Stop on quota/provider errors rather than hammering the remaining audience.
        pending += resolved.recipients.length - sent - failed - uncertain - pending
        break
      }
    }
    await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: access.context.membershipId, eventType: 'communications.bulk_email_sent', metadata: { operation_id: body.operationId, sender: mailbox.sender.email, sent, failed, uncertain, pending, excluded: resolved.excluded.length } })
    return NextResponse.json({ sent, failed, uncertain, pending, excluded: resolved.excluded.length }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Email could not be confirmed. Check Sent before trying again.' }, { status: 409, headers }) }
}