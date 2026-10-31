import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { secretMatches } from '@/lib/gmail/security'
import { syncMailbox } from '@/lib/gmail/sync'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'
import { runConversationEmailJob } from '@/lib/gmail/conversation-worker'
import { preloadConversationEmail } from '@/lib/gmail/conversation-preload'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const secret = process.env.GMAIL_SYNC_SECRET || process.env.CRON_SECRET || ''
  const timestamp = request.headers.get('x-gmail-sync-timestamp') || ''
  const fresh = /^\d{10}$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= 120
  const signature = fresh ? createHmac('sha256', secret).update(`gmail-sync:${timestamp}`).digest('hex') : ''
  const signed = fresh && secretMatches(request.headers.get('x-gmail-sync-signature') || '', signature)
  if (secret.length < 32 || !(signed || secretMatches(request.headers.get('authorization') || '', `Bearer ${secret}`))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  // Stay below the scheduler's 180-second HTTP timeout; leave room for cleanup.
  const workDeadline = Date.now() + 150000
  // A durable conversation queue has its own leases/checkpoints, independent of note capture.
  let conversationFailed = false
  if (process.env.CONVERSATION_EMAIL_STORE === '1') {
    const deadline = Math.min(workDeadline, Date.now() + 60000)
    try {
      await preloadConversationEmail(Math.min(deadline, Date.now() + 15000))
    } catch { conversationFailed = true }
    for (let batch = 0; batch < 12 && Date.now() < deadline; batch++) {
      try {
        const result = await runConversationEmailJob(Math.min(deadline, Date.now() + 20000))
        if ('idle' in result) break
      } catch {
        // A missing schema or queue outage must not disable outbound note capture.
        conversationFailed = true
        break
      }
    }
  }
  // Reservation rotates attempts and applies backoff even if authorization fails.
  if (Date.now() + 5000 >= workDeadline) return NextResponse.json({ synced: 0, failed: 0, budgetExhausted: true, ...(conversationFailed ? { conversationFailed } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
  const { data, error } = await crmSupabaseAdmin.rpc('gmail_schedule_sync', { p_limit: 5 })
  if (error) return NextResponse.json({ error: 'Gmail sync unavailable.' }, { status: 503 })
  let synced = 0; let failed = 0; let deferred = 0
  for (const connection of data || []) {
    if (Date.now() + 5000 >= workDeadline) { deferred++; continue }
    try {
      // Re-check the configuring staff member's current membership and permissions.
      const { data: member, error: memberError } = await supabaseAdmin.from('tenant_memberships').select('person_id,status,role_id,legacy_access_enabled').eq('id', connection.connected_by).eq('tenant_id', connection.tenant_id).maybeSingle()
      if (memberError || !member || (member.status !== 'active' && !(member.legacy_access_enabled && ['invited', 'unclaimed'].includes(member.status)))) throw new Error('Membership unavailable')
      const { data: role, error: roleError } = await supabaseAdmin.from('roles').select('key').eq('id', member.role_id).eq('tenant_id', connection.tenant_id).maybeSingle()
      if (roleError || !role) throw new Error('Mailbox permissions revoked')
      if (role.key !== 'owner') {
        const { data: mappings, error: mappingError } = await supabaseAdmin.from('role_permissions').select('permission_id').eq('role_id', member.role_id)
        if (mappingError || !mappings?.length) throw new Error('Mailbox permissions revoked')
        const { data: permissions, error: permissionError } = await supabaseAdmin.from('permissions').select('key').in('id', mappings.map(item => item.permission_id))
        const keys = new Set((permissions || []).map(item => item.key))
        if (permissionError || !keys.has(PERMISSIONS.communicationsConfigure) || !keys.has(PERMISSIONS.leadsManage)) throw new Error('Mailbox permissions revoked')
      }
      const remaining = workDeadline - Date.now()
      if (remaining <= 5000) { deferred++; continue }
      const result = await syncMailbox(connection.tenant_id, connection.id, Math.min(30000, remaining))
      if (result.busy) deferred++
      else synced++
    } catch { failed++ }
  }
  return NextResponse.json({ synced, failed, ...(deferred ? { deferred } : {}), ...(conversationFailed ? { conversationFailed } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
}