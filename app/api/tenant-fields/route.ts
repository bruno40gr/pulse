import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_fields')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const permission = await requirePermission(request, tenantId, PERMISSIONS.tenantSettingsManage)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const fields = await request.json().catch(() => null)
    if (!Array.isArray(fields)) return NextResponse.json({ error: 'Expected array of fields' }, { status: 400 })
    if (fields.length > 100) return NextResponse.json({ error: 'No more than 100 fields may be saved at once.' }, { status: 400 })

    const normalizedFields: Array<{
      tenant_id: string
      field_key: string
      field_label: string
      field_type: string
      field_options: string[] | null
      is_core: boolean
      sort_order: number
    }> = []

    for (const field of fields) {
      if (!field || typeof field !== 'object') {
        return NextResponse.json({ error: 'Every field must be an object.' }, { status: 400 })
      }

      const input = field as Record<string, unknown>
      const fieldKey = typeof input.field_key === 'string' ? input.field_key.trim() : ''
      const fieldLabel = typeof input.field_label === 'string' ? input.field_label.trim() : ''
      const fieldType = typeof input.field_type === 'string' ? input.field_type.trim() : 'text'
      const allowedTypes = new Set(['text', 'dropdown', 'day', 'date', 'number'])
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(fieldKey) || !fieldLabel || fieldLabel.length > 120 || !allowedTypes.has(fieldType)) {
        return NextResponse.json({ error: 'One or more tenant fields are invalid.' }, { status: 400 })
      }

      const fieldOptions = Array.isArray(input.field_options)
        ? input.field_options
          .filter((value): value is string => typeof value === 'string')
          .map(value => value.trim())
          .filter(Boolean)
          .slice(0, 100)
        : null

      normalizedFields.push({
        tenant_id: tenantId,
        field_key: fieldKey,
        field_label: fieldLabel,
        field_type: fieldType,
        field_options: fieldOptions,
        is_core: false,
        sort_order: Number.isInteger(input.sort_order) ? Number(input.sort_order) : normalizedFields.length,
      })
    }

    const { error } = await supabaseAdmin
      .from('tenant_fields')
      .upsert(
        normalizedFields,
        { onConflict: 'tenant_id,field_key' }
      )
    if (error) throw error

    const auditRecorded = await writeAccountAuditEvent({
      tenantId,
      actorMembershipId: permission.context.membershipId,
      eventType: 'tenant_settings.fields_updated',
      metadata: { field_count: normalizedFields.length },
    })

    return NextResponse.json({ success: true, auditRecorded })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
