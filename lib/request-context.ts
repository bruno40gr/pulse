import { createServerClient } from '@supabase/ssr'
import { getAccessScope, getRequestActor, type PulseActor } from '@/lib/access'
import type { PermissionKey } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type AuthenticationSource = 'supabase' | 'legacy'

export type MembershipRequestContext = {
  authSource: AuthenticationSource
  authUserId: string | null
  membershipId: string
  tenantId: string
  personId: string
  roleId: string
  roleKey: string
  membershipStatus: 'unclaimed' | 'invited' | 'active' | 'suspended' | 'deactivated'
  permissions: ReadonlySet<string>
  legacyActor: PulseActor | null
}

export type RequestContextResult =
  | { ok: true; context: MembershipRequestContext }
  | { ok: false; status: number; error: string }

function requestCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separatorIndex = part.indexOf('=')
      if (separatorIndex < 0) return { name: part, value: '' }
      return {
        name: part.slice(0, separatorIndex),
        value: decodeURIComponent(part.slice(separatorIndex + 1)),
      }
    })
}

async function getSupabaseAuthUserId(request: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => requestCookies(request), setAll: () => {} } },
  )
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

async function loadMembershipContext(input: {
  tenantId: string
  authSource: AuthenticationSource
  authUserId: string | null
  legacyActor: PulseActor | null
}): Promise<RequestContextResult> {
  let membershipQuery = supabaseAdmin
    .from('tenant_memberships')
    .select('id, tenant_id, person_id, auth_user_id, role_id, status, legacy_access_enabled')
    .eq('tenant_id', input.tenantId)

  membershipQuery = input.authUserId
    ? membershipQuery.eq('auth_user_id', input.authUserId)
    : membershipQuery.eq('person_id', input.legacyActor!.personId)

  const { data: membership, error: membershipError } = await membershipQuery.maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) return { ok: false, status: 403, error: 'A staff membership is required for this account.' }
  const allowedStatuses = input.authSource === 'supabase' ? ['active'] : ['unclaimed', 'invited', 'active']
  if (!allowedStatuses.includes(membership.status)) {
    return { ok: false, status: 403, error: 'This staff account is not active.' }
  }
  if (input.authSource === 'legacy' && !membership.legacy_access_enabled) {
    return { ok: false, status: 403, error: 'Legacy access is disabled for this staff account.' }
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id, key')
    .eq('id', membership.role_id)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()
  if (roleError) throw roleError
  if (!role) return { ok: false, status: 403, error: 'This staff account does not have a valid role.' }

  const { data: mappings, error: mappingsError } = await supabaseAdmin
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', role.id)
  if (mappingsError) throw mappingsError

  const permissionIds = (mappings || []).map(mapping => mapping.permission_id)
  const { data: permissions, error: permissionsError } = permissionIds.length
    ? await supabaseAdmin.from('permissions').select('key').in('id', permissionIds)
    : { data: [], error: null }
  if (permissionsError) throw permissionsError

  return {
    ok: true,
    context: {
      authSource: input.authSource,
      authUserId: input.authUserId,
      membershipId: membership.id,
      tenantId: membership.tenant_id,
      personId: membership.person_id,
      roleId: role.id,
      roleKey: role.key,
      membershipStatus: membership.status,
      permissions: new Set((permissions || []).map(permission => permission.key)),
      legacyActor: input.legacyActor,
    },
  }
}

export async function resolveMembershipRequestContext(
  request: Request,
  tenantId: string,
): Promise<RequestContextResult> {
  const legacyActor = await getRequestActor(request)
  if (legacyActor) {
    if (getAccessScope(legacyActor).kind === 'demo') {
      return { ok: false, status: 403, error: 'Staff account access is required.' }
    }

    const legacyResult = await loadMembershipContext({
      tenantId,
      authSource: 'legacy',
      authUserId: null,
      legacyActor,
    })
    if (legacyResult.ok) return legacyResult
  }

  const authUserId = await getSupabaseAuthUserId(request)
  if (!authUserId) return { ok: false, status: 401, error: 'Sign in is required.' }

  return loadMembershipContext({
    tenantId,
    authSource: 'supabase',
    authUserId,
    legacyActor: null,
  })
}

export async function resolveLegacyActorContext(
  actor: PulseActor | null,
  tenantId: string,
): Promise<RequestContextResult> {
  if (!actor) return { ok: false, status: 401, error: 'Sign in is required.' }
  if (getAccessScope(actor).kind === 'demo') {
    return { ok: false, status: 403, error: 'Staff account access is required.' }
  }

  return loadMembershipContext({
    tenantId,
    authSource: 'legacy',
    authUserId: null,
    legacyActor: actor,
  })
}

export async function requirePermission(
  request: Request,
  tenantId: string,
  permissionKey: PermissionKey,
): Promise<RequestContextResult> {
  const result = await resolveMembershipRequestContext(request, tenantId)
  if (!result.ok) return result
  if (result.context.roleKey === 'owner' || result.context.permissions.has(permissionKey)) return result
  return { ok: false, status: 403, error: 'You do not have permission to perform this action.' }
}

export async function requirePermissionActor(
  actor: PulseActor | null,
  tenantId: string,
  permissionKey: PermissionKey,
): Promise<RequestContextResult> {
  const result = await resolveLegacyActorContext(actor, tenantId)
  if (!result.ok) return result
  if (result.context.roleKey === 'owner' || result.context.permissions.has(permissionKey)) return result
  return { ok: false, status: 403, error: 'You do not have permission to perform this action.' }
}

export async function requireOwner(
  request: Request,
  tenantId: string,
): Promise<RequestContextResult> {
  const result = await resolveMembershipRequestContext(request, tenantId)
  if (!result.ok) return result
  if (result.context.roleKey === 'owner') return result
  return { ok: false, status: 403, error: 'Owner access required.' }
}

export async function requireAccountAdministrator(
  request: Request,
  tenantId: string,
): Promise<RequestContextResult> {
  const result = await resolveMembershipRequestContext(request, tenantId)
  if (!result.ok) return result
  if (result.context.roleKey === 'owner' || result.context.roleKey === 'admin') return result
  return { ok: false, status: 403, error: 'Owner or Admin access required.' }
}

export async function requireOwnerActor(
  actor: PulseActor | null,
  tenantId: string,
): Promise<RequestContextResult> {
  const result = await resolveLegacyActorContext(actor, tenantId)
  if (!result.ok) return result
  if (result.context.roleKey === 'owner') return result
  return { ok: false, status: 403, error: 'Owner access required.' }
}