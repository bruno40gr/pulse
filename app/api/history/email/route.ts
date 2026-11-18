import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin as db } from '@/lib/supabase/crm-admin'
import { supabaseAdmin as primary } from '@/lib/supabase/admin'
import { EMAIL_OPERATION_ID, EMAIL_RECIPIENT_PAGE_SIZE, EMAIL_RECIPIENT_STATUSES, emailCampaignCounts, recipientPage } from '@/lib/bulk-email-history'

const headers = { 'Cache-Control': 'private, no-store' }
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers })

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  if (!access.ok) return json({ error: access.error }, access.status)
  const { tenantId } = access
  const params = new URL(request.url).searchParams
  const operation = params.get('operation')
  if (operation !== null) {
    const page = recipientPage(params.get('page'))
    const status = params.get('status')
    const search = (params.get('q') || '').trim().toLowerCase()
    if (!EMAIL_OPERATION_ID.test(operation) || page === null || (status && !EMAIL_RECIPIENT_STATUSES.some(s => s === status)) || search.length > 254 || /[\s*%\\]/.test(search)) {
      return json({ error: 'Invalid recipient filter or page.' }, 400)
    }
    let query = db.from('organisation_email_deliveries').select('destination,status,created_at', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('operation_id', operation)
    if (status) query = query.eq('status', status)
    if (search) query = query.like('destination', `%${search.replaceAll('_', '\\_')}%`)
    const start = (page - 1) * EMAIL_RECIPIENT_PAGE_SIZE
    const { data, error, count } = await query.order('destination').range(start, start + EMAIL_RECIPIENT_PAGE_SIZE - 1)
    if (error?.code === 'PGRST103' && page > 1) return json({ error: 'This recipient page is no longer available. Return to page one.' }, 416)
    if (error) return json({ error: 'Recipient history could not be loaded.' }, 503)
    return json({ recipients: data || [], total: count || 0 })
  }

  const { data, error } = await primary.from('account_audit_events').select('id,metadata,created_at')
    .eq('tenant_id', tenantId).eq('event_type', 'communications.bulk_email_sent')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(201)
  if (error) return json({ error: 'Email campaign history could not be loaded.' }, 503)
  const seen = new Set<string>()
  const priorDiagnostics = new Map<string, Record<string, unknown>>()
  for (const { metadata: m } of (data || []).slice(0, 200)) {
    if (typeof m?.operation_id === 'string' && m.diagnostic && typeof m.diagnostic === 'object' && !priorDiagnostics.has(m.operation_id)) priorDiagnostics.set(m.operation_id, m.diagnostic)
  }
  const campaigns = (data || []).slice(0, 200).flatMap(row => {
    const m = row.metadata || {}
    if (typeof m.operation_id !== 'string' || !EMAIL_OPERATION_ID.test(m.operation_id) || seen.has(m.operation_id)) return []
    seen.add(m.operation_id)
    const errorDetails = priorDiagnostics.get(m.operation_id)
    const diagnostic = errorDetails && (m.failed || m.uncertain) ? {
      httpStatus: typeof errorDetails.httpStatus === 'number' ? errorDetails.httpStatus : null,
      category: typeof errorDetails.category === 'string' ? errorDetails.category : null,
      reason: typeof errorDetails.reason === 'string' ? errorDetails.reason : null,
    } : null
    return [{ id: m.operation_id, subject: typeof m.subject === 'string' ? m.subject : null, sender: typeof m.sender === 'string' ? m.sender : null,
      updatedAt: row.created_at, ...emailCampaignCounts(m), diagnostic }]
  })
  // Older operations didn't record a subject. The synced index is best-effort,
  // and missing copies never change the send-ledger status or counts.
  const legacy = campaigns.filter(c => !c.subject).slice(0, 20)
  if (legacy.length) {
    const { data: receipts } = await db.from('organisation_email_deliveries').select('operation_id,provider_message_id')
      .eq('tenant_id', tenantId).in('operation_id', legacy.map(c => c.id)).eq('status', 'sent').not('provider_message_id', 'is', null).limit(500)
    const byMessage = new Map((receipts || []).map(row => [row.provider_message_id, row.operation_id]))
    if (byMessage.size) {
      const ids = [...byMessage.keys()]
      const chunks = Array.from({ length: Math.ceil(ids.length / 75) }, (_, i) => ids.slice(i * 75, (i + 1) * 75))
      const batches = await Promise.all(chunks.map(chunk => db.from('conversation_email_messages').select('provider_message_id,subject').eq('tenant_id', tenantId)
        .eq('direction', 'outbound').in('provider_message_id', chunk)))
      const subjects = new Map(batches.flatMap(({ data }) => data || []).filter(m => m.subject).map(m => [byMessage.get(m.provider_message_id), m.subject]))
      for (const campaign of legacy) campaign.subject = subjects.get(campaign.id) || null
    }
  }
  return json({ campaigns, limited: (data?.length || 0) > 200 })
}