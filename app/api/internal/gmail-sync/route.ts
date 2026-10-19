import { NextResponse } from 'next/server'
import { secretMatches } from '@/lib/gmail/security'
import { syncMailbox } from '@/lib/gmail/sync'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const secret = process.env.GMAIL_SYNC_SECRET || ''
  if (secret.length < 32 || !secretMatches(request.headers.get('authorization') || '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await crmSupabaseAdmin.from('gmail_connections').select('id,tenant_id,connected_by').order('last_synced_at', { ascending: true, nullsFirst: true }).limit(5)
  if (error) return NextResponse.json({ error: 'Gmail sync unavailable.' }, { status: 503 })
  let synced = 0; let failed = 0
  for (const connection of data || []) {
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
      await syncMailbox(connection.tenant_id, connection.id, 30000); synced++
    } catch { failed++ }
  }
  return NextResponse.json({ synced, failed }, { headers: { 'Cache-Control': 'no-store' } })
}