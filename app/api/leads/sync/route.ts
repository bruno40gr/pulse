import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { syncMailbox } from '@/lib/gmail/sync'

export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store' }

// Every admin/owner can trigger capture without a separate permission grant.
// Other delegated lead managers retain access; mailbox configuration stays separate.
async function authorizeSync(request: Request) {
  const access = await authorizeTenantRequest(request)
  if (!access.ok) return access
  const context = access.context
  if (!context || !(['owner', 'admin'].includes(context.roleKey) || context.permissions.has(PERMISSIONS.leadsManage))) {
    return { ok: false as const, status: 403, error: 'An admin account or lead management access is required.' }
  }
  return access
}

export async function GET(request: Request) {
  const access = await authorizeSync(request)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  const { data, error } = await crmSupabaseAdmin.from('gmail_connections').select('id').eq('tenant_id', access.tenantId).limit(1)
  if (error) return NextResponse.json({ error: 'Email sync status is unavailable.' }, { status: 503, headers })
  return NextResponse.json({ connected: Boolean(data?.length) }, { headers })
}

export async function POST(request: Request) {
  const access = await authorizeSync(request)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  // Choose mailboxes on the server; never accept tenant/mailbox IDs from the request body.
  const { data, error } = await crmSupabaseAdmin.from('gmail_connections').select('id')
    .eq('tenant_id', access.tenantId).order('last_synced_at', { ascending: true, nullsFirst: true }).limit(6)
  if (error) return NextResponse.json({ error: 'Email sync is unavailable. Please try again.' }, { status: 503, headers })
  if (!data?.length) return NextResponse.json({ error: 'No Gmail mailbox is connected. Ask an administrator to connect one in Settings → Integrations.' }, { status: 409, headers })
  let recorded = 0; let review = 0; let busy = 0; let failed = 0
  let more = data.length > 5
  for (const connection of data.slice(0, 5)) {
    try {
      const result = await syncMailbox(access.tenantId, connection.id, 30000)
      recorded += result.recorded
      review += result.review
      if (result.busy) busy++
      if ('more' in result && result.more) more = true
    } catch { failed++ }
  }
  return NextResponse.json({ recorded, review, busy, failed, more }, { status: failed === Math.min(data.length, 5) ? 503 : 200, headers })
}