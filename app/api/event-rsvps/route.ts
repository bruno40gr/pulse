import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RSVP_EVENT_ID } from '@/lib/event-rsvps'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  try {
    const { data, error } = await supabaseAdmin.rpc('event_rsvp_workspace', { p_tenant: access.tenantId, p_event: RSVP_EVENT_ID })
    if (error || !data) throw new Error('RSVP workspace unavailable')
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'The RSVP list is unavailable. Please try again.' }, { status: 503 })
  }
}