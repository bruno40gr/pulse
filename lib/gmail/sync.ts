import { createHash } from 'node:crypto'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { decryptToken } from './security'
import { googleToken, gmailGet } from './google'
import { EMAIL_CAPTURE_STATUSES, emailAddresses, emailBody, emailDecision, emailNote, matchEmailLeads, type EmailLead, type GmailPart } from './rules'

type Connection = { id: string; tenant_id: string; email: string; refresh_token_ciphertext: string; connected_by: string; capture_from: string; last_synced_at: string | null; sync_until: string; page_token: string | null; sync_lease_token: string }
type GmailMessage = { id: string; internalDate: string; labelIds?: string[]; payload: GmailPart & { headers?: { name: string; value: string }[] } }

export async function recordOutreach(tenantId: string, messageId: string, leadId: string, actor: string) {
  const { data: message, error } = await crmSupabaseAdmin.from('gmail_outreach').select('body,sent_at,candidate_lead_ids,status')
    .eq('tenant_id', tenantId).eq('id', messageId).single()
  if (error || !message || !message.candidate_lead_ids.includes(leadId)) throw new Error('Choose one of the matched leads.')
  const { error: writeError } = await crmSupabaseAdmin.rpc('gmail_record_outreach', {
    p_tenant: tenantId, p_message: messageId, p_lead: leadId, p_note: emailNote(message.body, message.sent_at), p_decision: emailDecision(message.body), p_actor: actor,
  })
  if (writeError) throw new Error('Email could not be recorded. Refresh and try again.')
}

export async function syncMailbox(tenantId: string, connectionId: string, budgetMs = 240000) {
  const deadline = Date.now() + budgetMs
  const providerDeadline = deadline - 3000
  const checkDeadline = () => {
    if (Date.now() >= providerDeadline) throw new Error('Batch time limit reached; retry from the retained cursor.')
  }
  const { data: claimed, error } = await crmSupabaseAdmin.rpc('gmail_claim_sync', { p_id: connectionId, p_tenant: tenantId })
  if (error) throw new Error('Mailbox sync unavailable. Apply the Gmail CRM migration.')
  const connection = (claimed as Connection[] | null)?.[0]
  if (!connection) return { busy: true, recorded: 0, review: 0 }
  let recorded = 0; let review = 0
  try {
    checkDeadline()
    const token = await googleToken({ grant_type: 'refresh_token', refresh_token: decryptToken(connection.refresh_token_ciphertext) }, providerDeadline)
    // Fetch the complete candidate set; a truncated result must never appear unique.
    const leads: EmailLead[] = []
    for (let offset = 0; ; offset += 1000) {
      checkDeadline()
      if (offset >= 10000) throw new Error('Lead matching exceeds this deployment batch limit.')
      const { data: leadRows, error: leadError } = await crmSupabaseAdmin.from('lead_intakes')
        .select('id,contact_id,status,created_at,payload,crm_contacts(email)')
        .eq('tenant_id', tenantId).in('intake_type', ['lesson_inquiry', 'tour_request', 'service_inquiry']).in('status', EMAIL_CAPTURE_STATUSES)
        .order('id').range(offset, offset + 999)
      if (leadError) throw new Error('Lead matching unavailable.')
      leads.push(...(leadRows || []) as EmailLead[])
      if ((leadRows || []).length < 1000) break
    }
    const start = Math.max(Date.parse(connection.capture_from), Date.parse(connection.last_synced_at || connection.capture_from) - 300000)
    const until = Date.parse(connection.sync_until)
    const query = new URLSearchParams({ labelIds: 'SENT', maxResults: '50', q: `after:${Math.floor(start / 1000)} before:${Math.ceil(until / 1000)}` })
    if (connection.page_token) query.set('pageToken', connection.page_token)
    checkDeadline()
    const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(token.access_token, `messages?${query}`, providerDeadline)
    for (const reference of page.messages || []) {
      checkDeadline()
      const message = await gmailGet<GmailMessage>(token.access_token, `messages/${encodeURIComponent(reference.id)}?format=full`, providerDeadline)
      if (!message.labelIds?.includes('SENT')) continue
      const sentAt = new Date(Number(message.internalDate)).toISOString()
      if (Date.parse(sentAt) < Date.parse(connection.capture_from)) continue
      const header = (name: string) => message.payload.headers?.find(item => item.name.toLowerCase() === name.toLowerCase())?.value || ''
      const recipients = emailAddresses(`${header('To')},${header('Cc')},${header('Bcc')}`)
      // Never attach mass outreach to a single lead.
      if (!recipients.length || recipients.length > 5) continue
      const candidates = matchEmailLeads(leads, recipients, sentAt)
      if (!candidates.length) continue // Do not persist unrelated mailbox content.
      const body = emailBody(message.payload)
      if (!body) continue
      const fingerprint = createHash('sha256').update(header('Message-ID').trim() || `${connection.email}:${message.id}`).digest('hex')
      const { data: existing, error: lookupError } = await crmSupabaseAdmin.from('gmail_outreach').select('id,status,candidate_lead_ids')
        .eq('tenant_id', tenantId).eq('fingerprint', fingerprint).maybeSingle()
      if (lookupError) throw lookupError
      let receipt = existing
      if (!receipt) {
        const result = await crmSupabaseAdmin.from('gmail_outreach').insert({
          tenant_id: tenantId, connection_id: connection.id, fingerprint, provider_message_id: message.id,
          sender: header('From'), recipients, subject: header('Subject').slice(0, 500), body, sent_at: sentAt, candidate_lead_ids: candidates.map(lead => lead.id),
        }).select('id,status,candidate_lead_ids').single()
        if (result.error?.code === '23505') continue
        if (result.error) throw result.error
        receipt = result.data
      }
      if (receipt?.status !== 'review') continue
      if (receipt.candidate_lead_ids.length === 1) { await recordOutreach(tenantId, receipt.id, receipt.candidate_lead_ids[0], connection.connected_by); recorded++ }
      else review++
    }
    checkDeadline()
    const { data: finished, error: updateError } = await crmSupabaseAdmin.rpc('gmail_finish_sync', {
      p_id: connection.id, p_tenant: tenantId, p_lease: connection.sync_lease_token, p_success: true, p_page: page.nextPageToken || null,
    })
    if (updateError || finished !== true) throw new Error('Mailbox lease expired; retry from the retained cursor.')
    return { recorded, review, more: Boolean(page.nextPageToken) }
  } catch {
    await crmSupabaseAdmin.rpc('gmail_finish_sync', { p_id: connection.id, p_tenant: tenantId, p_lease: connection.sync_lease_token, p_success: false })
    throw new Error('Sync failed. Retry or reconnect the Google mailbox. No credentials were exposed.')
  }
}