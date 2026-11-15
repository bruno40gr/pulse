import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validAcademyWorkspace } from '@/beta-source/lib/academy-workspace-storage'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.staffRead, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const { data, error } = await supabaseAdmin.from('academy_workspaces').select('revision,state').eq('tenant_id', access.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: 'School storage is unavailable. Check the academy workspace migration.' }, { status: 503 })
  return NextResponse.json(data || { revision: 0, state: null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.staffManage, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const raw = await request.text()
  if (raw.length > 8_000_000) return NextResponse.json({ error: 'School workspace is too large.' }, { status: 413 })
  let body
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid school workspace.' }, { status: 400 }) }
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0 || !validAcademyWorkspace(body.state)) return NextResponse.json({ error: 'Invalid school workspace or revision.' }, { status: 400 })
  // The fictional sandbox must never be imported into a real account by autosave.
  if (body.state.snapshot.data.demoSchool) return NextResponse.json({ error: 'Sample school records cannot be saved into a live school account.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.rpc('save_academy_workspace', { p_tenant: access.tenantId, p_actor: access.context!.membershipId, p_revision: body.revision, p_state: body.state })
  if (error) return NextResponse.json({ error: 'School changes could not be saved. Check the academy workspace migration.' }, { status: 503 })
  if (data?.conflict) return NextResponse.json({ error: 'Another staff member changed this school. Reload before making further changes.' }, { status: 409 })
  return NextResponse.json(data)
}