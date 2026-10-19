import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { communityCommand } from '@/lib/community-posts'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const { data, error } = await supabaseAdmin.rpc('community_post_workspace', { p_tenant: access.tenantId })
  if (error) return NextResponse.json({ error: 'Community workspace is unavailable. Verify the community-post migration has been applied.' }, { status: 503 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage, body })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.context) return NextResponse.json({ error: 'A staff membership is required.' }, { status: 403 })
  let command: ReturnType<typeof communityCommand>
  try { command = communityCommand(body) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin.rpc('community_post_command', {
    p_tenant: access.tenantId, p_actor: access.context.membershipId,
    p_revision: command.revision, p_action: command.action, p_data: command.data,
  })
  if (error) {
    if (error.code === '40001') return NextResponse.json({ error: 'Another admin changed this workspace. Reload before saving.' }, { status: 409 })
    if (error.code === '23505') return NextResponse.json({ error: 'This post is already in the workspace.' }, { status: 409 })
    if (error.code === '22023') return NextResponse.json({ error: 'The post or homepage selection is no longer valid. Reload and review it.' }, { status: 400 })
    return NextResponse.json({ error: 'Community changes could not be saved. No partial change was committed.' }, { status: 503 })
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}