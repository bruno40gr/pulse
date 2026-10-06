import { getAccessScope, getRequestActor } from '@/lib/access'
import type { PermissionKey } from '@/lib/permissions'
import { resolveMembershipRequestContext, type MembershipRequestContext } from '@/lib/request-context'

type TenantRequestResult =
  | { ok: true; tenantId: string; context: MembershipRequestContext | null }
  | { ok: false; status: number; error: string }

/** Query/body values select an account; verified identity authorizes it. No tenant fallback. */
export async function authorizeTenantRequest(
  request: Request,
  options: { permission?: PermissionKey; allowDemo?: boolean; body?: unknown } = {},
): Promise<TenantRequestResult> {
  try {
    return await resolveTenantRequest(request, options)
  } catch {
    // Authorization failures must not fall through to domain queries or expose DB errors.
    return { ok: false, status: 503, error: 'Account access could not be verified. Please try again.' }
  }
}

async function resolveTenantRequest(
  request: Request,
  options: { permission?: PermissionKey; allowDemo?: boolean; body?: unknown },
): Promise<TenantRequestResult> {
  const body = options.body && typeof options.body === 'object' && !Array.isArray(options.body)
    ? options.body as Record<string, unknown> : null
  const selections: unknown[] = [...new URL(request.url).searchParams.getAll('tenant'), body?.tenant_id, body?.tenantId]
  const supplied = selections.filter(value => value !== undefined && value !== null)
  if (supplied.some(value => typeof value !== 'string' || !value.trim())) {
    return { ok: false, status: 400, error: 'Invalid account selection.' }
  }
  const ids = supplied as string[]
  if (new Set(ids).size > 1) return { ok: false, status: 400, error: 'Account selections do not match.' }
  const selectedTenant = ids[0]
  if (selectedTenant && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedTenant)) {
    return { ok: false, status: 400, error: 'Invalid account selection.' }
  }

  const actor = await getRequestActor(request)
  const scope = actor ? getAccessScope(actor) : null
  if (scope?.kind === 'demo') {
    if (!options.allowDemo || (selectedTenant && selectedTenant !== scope.tenantId)) {
      return { ok: false, status: 403, error: 'You do not have access to this account.' }
    }
    return { ok: true, tenantId: scope.tenantId, context: null }
  }

  const membership = await resolveMembershipRequestContext(request, selectedTenant)
  if (!membership.ok) return membership
  if (options.permission && membership.context.roleKey !== 'owner' && !membership.context.permissions.has(options.permission)) {
    return { ok: false, status: 403, error: 'You do not have permission to perform this action.' }
  }
  return { ok: true, tenantId: membership.context.tenantId, context: membership.context }
}
