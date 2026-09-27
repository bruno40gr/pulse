import { NextResponse } from 'next/server'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

function maskSid(sid: string | null | undefined): string {
  if (!sid) return ''
  return sid.length > 8 ? `${sid.slice(0, 2)}••••${sid.slice(-4)}` : '••••'
}

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const permission = await requirePermission(request, tenantId, PERMISSIONS.communicationsConfigure)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const { data, error } = await supabaseAdmin
      .from('twilio_config')
      .select('id, account_sid, phone_number, registration_status, created_at')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error && error.code !== 'PGRST116') throw error
    if (!data) return NextResponse.json(null)

    // Mask the SID for display — never expose the full credential
    return NextResponse.json({
      ...data,
      account_sid: maskSid(data.account_sid),
      has_account_sid: !!data.account_sid,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const permission = await requirePermission(request, tenantId, PERMISSIONS.communicationsConfigure)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const body = await request.json().catch(() => null)
    const account_sid = typeof body?.account_sid === 'string' ? body.account_sid.trim() : ''
    const auth_token = typeof body?.auth_token === 'string' ? body.auth_token.trim() : ''
    const phone_number = typeof body?.phone_number === 'string' ? body.phone_number.trim() : null
    if (!account_sid || !auth_token) {
      return NextResponse.json({ error: 'Account SID and Auth Token are required' }, { status: 400 })
    }
    if (account_sid.length > 128 || auth_token.length > 256 || (phone_number && phone_number.length > 32)) {
      return NextResponse.json({ error: 'One or more Twilio values are too long.' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('twilio_config')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (existingError) throw existingError

    let data
    if (existing) {
      const result = await supabaseAdmin
        .from('twilio_config')
        .update({ account_sid, auth_token, phone_number, registration_status: 'configured' })
        .eq('tenant_id', tenantId)
        .select('id, phone_number, registration_status')
        .single()
      if (result.error) throw result.error
      data = result.data
    } else {
      const result = await supabaseAdmin
        .from('twilio_config')
        .insert({ tenant_id: tenantId, account_sid, auth_token, phone_number, registration_status: 'configured' })
        .select('id, phone_number, registration_status')
        .single()
      if (result.error) throw result.error
      data = result.data
    }

    const auditRecorded = await writeAccountAuditEvent({
      tenantId,
      actorMembershipId: permission.context.membershipId,
      eventType: 'communications.twilio_configured',
      metadata: { operation: existing ? 'updated' : 'created' },
    })

    return NextResponse.json({ ...data, auditRecorded })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const permission = await requirePermission(request, tenantId, PERMISSIONS.communicationsConfigure)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const { error } = await supabaseAdmin
      .from('twilio_config')
      .delete()
      .eq('tenant_id', tenantId)
    if (error) throw error

    const auditRecorded = await writeAccountAuditEvent({
      tenantId,
      actorMembershipId: permission.context.membershipId,
      eventType: 'communications.twilio_disconnected',
    })

    return NextResponse.json({ success: true, auditRecorded })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}