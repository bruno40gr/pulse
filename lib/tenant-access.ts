import { canAccessTenant, getAccessScope, getRequestActor } from '@/lib/access'

export type TenantAccessResult =
  | { ok: true; tenantId: string }
  | { ok: false; status: number; error: string }

export async function resolveRequestTenant(
  request: Request,
  defaultTenantId: string,
): Promise<TenantAccessResult> {
  const actor = await getRequestActor(request)
  if (!actor) return { ok: false, status: 401, error: 'Pulse access required.' }

  const requestedTenantId = new URL(request.url).searchParams.get('tenant')
  const scope = getAccessScope(actor)

  // A demo session's tenant comes exclusively from its signed cookie. This
  // deliberately prevents a missing or manipulated query parameter from
  // falling back to Headliner data.
  if (scope.kind === 'demo') {
    if (requestedTenantId && requestedTenantId !== scope.tenantId) {
      return { ok: false, status: 403, error: 'You do not have access to this account.' }
    }

    return { ok: true, tenantId: scope.tenantId }
  }

  const tenantId = requestedTenantId || defaultTenantId
  if (!canAccessTenant(actor, tenantId)) {
    return { ok: false, status: 403, error: 'You do not have access to this account.' }
  }

  return { ok: true, tenantId }
}