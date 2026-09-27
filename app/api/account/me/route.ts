import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveMembershipRequestContext } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_TENANT } from '@/lib/tenant'

function requestCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  return cookieHeader.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const separatorIndex = part.indexOf('=')
    return {
      name: separatorIndex < 0 ? part : part.slice(0, separatorIndex),
      value: separatorIndex < 0 ? '' : decodeURIComponent(part.slice(separatorIndex + 1)),
    }
  })
}

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get('tenant') || DEFAULT_TENANT
    const result = await resolveMembershipRequestContext(request, tenantId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    const [{ data: person, error: personError }, { data: membership, error: membershipError }] = await Promise.all([
      supabaseAdmin.from('people').select('email').eq('id', result.context.personId).eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('tenant_memberships').select('auth_user_id').eq('id', result.context.membershipId).eq('tenant_id', tenantId).maybeSingle(),
    ])
    if (personError) throw personError
    if (membershipError) throw membershipError

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => requestCookies(request), setAll: () => {} } },
    )
    const { data: authData } = await supabase.auth.getUser()
    const hasMatchingPersonalSession = !!membership?.auth_user_id && authData.user?.id === membership.auth_user_id

    return NextResponse.json({
      isOwner: result.context.roleKey === 'owner',
      roleKey: result.context.roleKey,
      canManageAccounts: result.context.roleKey === 'owner' || result.context.roleKey === 'admin',
      canManageRoles: result.context.roleKey === 'owner' || result.context.roleKey === 'admin',
      canManageIntegrations: result.context.roleKey === 'owner' || result.context.permissions.has(PERMISSIONS.communicationsConfigure),
      canManageBrand: result.context.roleKey === 'owner' || result.context.permissions.has(PERMISSIONS.tenantSettingsManage),
      canUpdateCredentials: hasMatchingPersonalSession,
      email: hasMatchingPersonalSession ? authData.user?.email || person?.email || null : person?.email || null,
      membershipId: result.context.membershipId,
      tenantId,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}