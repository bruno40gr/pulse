import { NextResponse } from 'next/server'
import { getAccessScope, getRequestActor } from '@/lib/access'
import { validateContactProfile } from '@/lib/contact-profile'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authorizeTenantRequest } from '@/lib/tenant-request'

type WriteAccess = { ok: true; tenantId: string } | { ok: false; status: number; error: string }

/** Demo labs keep their existing editing path; staff sessions need the permission and the same tenant. */
async function authorizeProfileWrite(request: Request, targetTenantId: string): Promise<WriteAccess> {
  const scope = getAccessScope(await getRequestActor(request))
  if (scope.kind === 'demo') return scope.tenantId === targetTenantId
    ? { ok: true, tenantId: scope.tenantId }
    : { ok: false, status: 403, error: 'You do not have access to this account.' }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage })
  if (!access.ok) return access
  if (access.tenantId !== targetTenantId) return { ok: false, status: 403, error: 'You do not have access to this account.' }
  return { ok: true, tenantId: access.tenantId }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
  }
  const parsed = validateContactProfile(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const { data: existing, error: findError } = await supabaseAdmin.from('people')
      .select('id, tenant_id').eq('id', id).maybeSingle()
    if (findError) throw findError
    if (!existing) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    const access = await authorizeProfileWrite(request, existing.tenant_id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data, error } = await supabaseAdmin.from('people')
      .update({ ...parsed.fields, updated_at: new Date().toISOString() })
      .eq('tenant_id', access.tenantId).eq('id', id)
      .select('id, first_name, last_name, phone, email, date_of_birth')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('[contacts][profile] Update failed', { code: (error as { code?: string })?.code })
    return NextResponse.json({ error: 'Could not save contact details. Please try again.' }, { status: 500 })
  }
}
