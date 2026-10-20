import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { gmailConfigured } from '@/lib/gmail/security'
import { recordOutreach, syncMailbox } from '@/lib/gmail/sync'

export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsConfigure })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.leadsManage))) return NextResponse.json({ error: 'Lead management permission is required.' }, { status: 403, headers })
  const [connections, review] = await Promise.all([
    crmSupabaseAdmin.from('gmail_connections').select('id,email,capture_from,last_synced_at,last_error,page_token').eq('tenant_id', access.tenantId).order('email'),
    crmSupabaseAdmin.from('gmail_outreach').select('id,sender,subject,body,sent_at,candidate_lead_ids').eq('tenant_id', access.tenantId).eq('status', 'review').order('sent_at', { ascending: false }).limit(50),
  ])
  if (connections.error || review.error) return NextResponse.json({ configured: gmailConfigured(), error: 'Gmail data is unavailable. Verify the Gmail migration and database access in this Odeon environment before connecting mailboxes.' }, { status: 503, headers })
  const ids = [...new Set((review.data || []).flatMap(item => item.candidate_lead_ids as string[]))]
  const leads = ids.length ? await crmSupabaseAdmin.from('lead_intakes').select('id,program_label,service_label,crm_contacts(full_name)').eq('tenant_id', access.tenantId).in('id', ids) : { data: [], error: null }
  if (leads.error) return NextResponse.json({ error: 'Lead review data unavailable.' }, { status: 503, headers })
  return NextResponse.json({ configured: gmailConfigured(), connections: connections.data, review: review.data, leads: leads.data }, { headers })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsConfigure })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.leadsManage))) return NextResponse.json({ error: 'Lead management permission is required.' }, { status: 403 })
  try {
    if (body?.action === 'sync' && typeof body.id === 'string') return NextResponse.json(await syncMailbox(access.tenantId, body.id), { headers })
    if (body?.action === 'record' && typeof body.id === 'string' && typeof body.leadId === 'string') {
      await recordOutreach(access.tenantId, body.id, body.leadId, access.context.membershipId)
      return NextResponse.json({ ok: true }, { headers })
    }
    if (body?.action === 'ignore' && typeof body.id === 'string') {
      const { error } = await crmSupabaseAdmin.from('gmail_outreach').update({ status: 'ignored', body: '', resolved_by: access.context.membershipId })
        .eq('id', body.id).eq('tenant_id', access.tenantId).eq('status', 'review')
      if (error) throw error
      return NextResponse.json({ ok: true }, { headers })
    }
    if (body?.action === 'disconnect' && typeof body.id === 'string') {
      if (access.context.roleKey !== 'owner') return NextResponse.json({ error: 'Only the account owner can disconnect organisation email.' }, { status: 403, headers })
      const { error } = await crmSupabaseAdmin.from('gmail_connections').delete().eq('id', body.id).eq('tenant_id', access.tenantId)
      if (error) throw error
      return NextResponse.json({ ok: true }, { headers })
    }
    return NextResponse.json({ error: 'Invalid mailbox action.' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'Mailbox action failed. Refresh and retry, or reconnect if syncing continues to fail.' }, { status: 503, headers }) }
}