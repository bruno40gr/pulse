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
import { gmailSendDiagnostic } from '@/lib/bulk-email-history'
import { isShowcaseRecovery, SHOWCASE_RECOVERY_OPERATION, SHOWCASE_SENDER, showcaseRecoveryOpen, showcaseSendSelection } from '@/lib/showcase-email-recovery'

export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) return NextResponse.json({ error: 'Contact access is required.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  const recovery = isShowcaseRecovery(access.tenantId, body?.recoveryOf)
  if ((body?.recoveryOf != null && !recovery) || (recovery ? body.operationId !== SHOWCASE_RECOVERY_OPERATION || body.senderEmail !== SHOWCASE_SENDER : !validContactSelection(body?.contactIds) || body.operationId === SHOWCASE_RECOVERY_OPERATION) || typeof body.senderEmail !== 'string' || typeof body.version !== 'string' || typeof body.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.operationId)
    || typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 500 || /[\r\n]/.test(body.subject)
    || typeof body.body !== 'string' || !body.body.trim() || body.body.length > 100000 || typeof body.html !== 'string' || body.html.length > 200000) return NextResponse.json({ error: 'Invalid email or contact selection.' }, { status: 400, headers })
  if (unresolvedEmailPlaceholders(`${body.subject}\n${body.body}\n${body.html}`).length || /\{(?:first_name|last_name|student[^}]*|instrument)\}/i.test(`${body.subject}\n${body.body}\n${body.html}`)) return NextResponse.json({ error: 'Use a message without student-specific placeholders for bulk email.' }, { status: 400, headers })
  if (recovery && !showcaseRecoveryOpen()) return NextResponse.json({ error: 'The first Showcase date has passed. This invitation is closed.' }, { status: 409, headers })
  try {
    const resolved = recovery ? (await (await import('@/lib/showcase-email-recovery-server')).showcaseRecovery(access.tenantId, body.recoveryOf)).resolution : await communicationRecipients(access.tenantId, body.contactIds, 'email')
    if (recipientVersion(resolved) !== body.version) return NextResponse.json({ error: 'Recipient details changed. Review the updated count before sending.', refreshRecipients: true }, { status: 409, headers })
    const recipients = recovery ? showcaseSendSelection(resolved.recipients, body.destinations) : resolved.recipients
    if (!recipients?.length) return NextResponse.json({ error: recovery ? 'Select at least one eligible unsent recipient. Return to Campaigns to refresh the list if it changed.' : 'No email recipients are available.' }, { status: 422, headers })
    const selected = new Set(recipients.map(row => row.destination))
    const mailbox = await organisationSender(access.tenantId, access.context.membershipId, body.senderEmail)
    if (recovery && mailbox.sender.name !== 'Headliner Music Academy') throw new Error('The shared sender must be named Headliner Music Academy to send this follow-up.')
    const contentHash = createHash('sha256').update(JSON.stringify([body.senderEmail, body.subject, body.body, body.html, body.version, ...(recovery ? [recipients.map(row => row.destination)] : [])])).digest('hex')
    const recorded = new Map<string, { status: string }>()
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await crmSupabaseAdmin.from('organisation_email_deliveries').select('destination,status,content_hash,actor_membership_id')
        .eq('tenant_id', access.tenantId).eq('operation_id', body.operationId).order('destination').range(offset, offset + 499)
      if (error) throw new Error('Delivery tracking unavailable. Apply Migration 026 before sending.')
      for (const row of data || []) {
        if (recovery && !selected.has(row.destination)) continue
        if (row.content_hash !== contentHash || row.actor_membership_id !== access.context.membershipId) throw new Error(recovery ? 'A selected address was already attempted in another send. Return to Campaigns and review the remaining recipients.' : 'This send operation belongs to a different message.')
        recorded.set(row.destination, row)
      }
      if ((data || []).length < 500) break
    }
    let sent = 0, pending = 0, failed = 0, uncertain = 0
    let diagnostic: { httpStatus: number | null; reason: string | null; category: string } | null = null
    const started = Date.now()
    // Bounded batches avoid request timeouts. Reusing operationId safely continues
    // the operation: a claimed/unknown destination is never automatically retried.
    for (const recipient of recipients) {
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
        else {
          diagnostic = await gmailSendDiagnostic(response)
          if (response.status >= 400 && response.status < 500) { status = 'failed'; failed++ }
          else uncertain++
        }
      } catch { diagnostic = { httpStatus: null, reason: null, category: 'uncertain' }; uncertain++ }
      const { error: recordError } = await crmSupabaseAdmin.from('organisation_email_deliveries').update({ status, provider_message_id: providerId })
        .eq('tenant_id', access.tenantId).eq('operation_id', body.operationId).eq('destination', recipient.destination)
      if (recordError) throw new Error('Delivery confirmation could not be saved. Check Sent in the shared mailbox before taking further action.')
      if (status !== 'sent') {
        // Stop on quota/provider errors rather than hammering the remaining audience.
        pending += recipients.length - sent - failed - uncertain - pending
        break
      }
    }
    if (diagnostic) console.warn('bulk_email_send_paused', { operationId: body.operationId, elapsedMs: Date.now() - started, ...diagnostic })
    // Keep the last actionable diagnostic if staff check progress or continue a paused operation.
    const event = { operation_id: body.operationId, ...(recovery ? { recovery_of: body.recoveryOf } : {}), sender: mailbox.sender.email, subject: body.subject, sent, failed, uncertain, pending, excluded: resolved.excluded.length }
    await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: access.context.membershipId, eventType: 'communications.bulk_email_sent', metadata: diagnostic ? { ...event, diagnostic } : event })
    return NextResponse.json({ sent, failed, uncertain, pending, excluded: resolved.excluded.length }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Email could not be confirmed. Check Sent before trying again.' }, { status: 409, headers }) }
}