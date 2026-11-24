import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validAcademyWorkspace, type AcademyWorkspaceState } from '@/beta-source/lib/academy-workspace-storage'
import { workProfileForStaff, workProfileValuesError } from '@/lib/staff-work-profile-record'
import { PUT as saveWorkspace } from '@/app/api/academy/workspace/route'

async function load(request: Request, manage: boolean) {
  const access = await authorizeTenantRequest(request, { permission: manage ? PERMISSIONS.staffManage : PERMISSIONS.staffRead, allowDemo: false })
  if (!access.ok) return { response: NextResponse.json({ error: access.error }, { status: access.status }) }
  const personId = new URL(request.url).searchParams.get('person') || ''
  if (!/^[0-9a-f-]{36}$/i.test(personId)) return { response: NextResponse.json({ error: 'Choose an existing staff member.' }, { status: 400 }) }
  const { data: staff, error: staffError } = await supabaseAdmin.from('instructors').select('id,person_id').eq('tenant_id', access.tenantId).eq('person_id', personId).maybeSingle()
  if (staffError) return { response: NextResponse.json({ error: 'Staff identity could not be verified.' }, { status: 503 }) }
  if (!staff) return { response: NextResponse.json({ error: 'Staff member not found in this school.' }, { status: 404 }) }
  const { data: person, error: personError } = await supabaseAdmin.from('people').select('id,first_name,last_name').eq('tenant_id', access.tenantId).eq('id', personId).maybeSingle()
  const { data: workspace, error } = await supabaseAdmin.from('academy_workspaces').select('revision,state').eq('tenant_id', access.tenantId).maybeSingle()
  if (personError || !person || error || !validAcademyWorkspace(workspace?.state) || workspace.state.snapshot.data.demoSchool) return { response: NextResponse.json({ error: 'School scheduling storage is not ready. Existing staff records have not been changed.' }, { status: 503 }) }
  try { return { access, workspace, record: workProfileForStaff(workspace.state.setup.teachers, person, staff.id) } }
  catch (cause) { return { response: NextResponse.json({ error: (cause as Error).message }, { status: 409 }) } }
}

export async function GET(request: Request) {
  const result = await load(request, false)
  if (result.response) return result.response
  return NextResponse.json({ revision: result.workspace.revision, record: result.record, setup: result.workspace.state.setup }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  const result = await load(request, true)
  if (result.response) return result.response
  const raw = await request.text()
  if (raw.length > 200_000) return NextResponse.json({ error: 'Staff work profile is too large.' }, { status: 413 })
  let body
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid staff work profile.' }, { status: 400 }) }
  if (!body || !Number.isSafeInteger(body.revision) || body.revision !== result.workspace.revision) return NextResponse.json({ error: 'School scheduling changed. Close and reopen this profile before saving.' }, { status: 409 })
  const error = workProfileValuesError(body.values)
  if (error) return NextResponse.json({ error }, { status: 400 })
  // Work-profile editing cannot rename a contact or replace its stable identity.
  const values = { ...result.record.values }
  const workFields = new Set(['assignments', 'availability', 'availabilityWeeks', 'availabilityOverrides', 'timeOff', 'location', 'locationIds', 'canPerformAdmin', 'engineeringLevel', 'days', 'from', 'to', 'service', 'levelIds', 'maxTeachingGap', 'publicBooking', 'publicFrom', 'publicTo'])
  for (const [key, value] of Object.entries(body.values as Record<string, string>)) {
    if (workFields.has(key)) values[key] = value
  }
  const record = { ...result.record, values }
  const state: AcademyWorkspaceState = result.workspace.state
  const exists = state.setup.teachers.some(item => item.id === record.id)
  const next = { ...state, setup: { ...state.setup, teachers: exists ? state.setup.teachers.map(item => item.id === record.id ? record : item) : [...state.setup.teachers, record] } }
  // Reuse the authoritative scheduling validator, tenant checks and database CAS.
  return saveWorkspace(new Request(request.url, { method: 'PUT', headers: request.headers, body: JSON.stringify({ revision: body.revision, state: next }) }))
}