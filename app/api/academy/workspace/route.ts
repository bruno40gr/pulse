import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validAcademyWorkspace } from '@/beta-source/lib/academy-workspace-storage'
import { academySchedulingError } from '@/lib/academy-scheduling-validation'

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
  const { data: current, error: loadError } = await supabaseAdmin.from('academy_workspaces').select('revision,state').eq('tenant_id', access.tenantId).maybeSingle()
  if (loadError) return NextResponse.json({ error: 'School storage is unavailable.' }, { status: 503 })
  if ((current?.revision ?? 0) !== body.revision) return NextResponse.json({ error: 'Another staff member changed this school. Reload before making further changes.' }, { status: 409 })
  if (current?.state && !validAcademyWorkspace(current.state)) return NextResponse.json({ error: 'Stored school data requires review.' }, { status: 503 })
  // A proposed timezone must never move the validation clock past conflicting work.
  const timezone = current?.state?.setup.school?.[0]?.values.timezone || 'America/Los_Angeles'
  let today: string
  try { today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) } catch { return NextResponse.json({ error: 'Choose a valid school timezone.' }, { status: 400 }) }
  const schedulingError = academySchedulingError(body.state, current?.state || null, today)
  if (schedulingError) return NextResponse.json({ error: schedulingError }, { status: 422 })
  const { data, error } = await supabaseAdmin.rpc('save_academy_workspace', { p_tenant: access.tenantId, p_actor: access.context!.membershipId, p_revision: body.revision, p_state: body.state, p_auth_source: access.context!.authSource })
  if (error) return NextResponse.json({ error: 'School changes could not be saved. Check the academy workspace migration.' }, { status: 503 })
  if (data?.conflict) return NextResponse.json({ error: 'Another staff member changed this school. Reload before making further changes.' }, { status: 409 })
  if (!Number.isSafeInteger(data?.revision) || data.revision !== body.revision + 1) return NextResponse.json({ error: 'School storage did not confirm the saved revision. Reload before making further changes.' }, { status: 503 })
  return NextResponse.json(data)
}