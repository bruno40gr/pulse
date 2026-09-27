import { getAccessScope, getRequestActor, type PulseActor } from '@/lib/access'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission, type MembershipRequestContext } from '@/lib/request-context'

export type CommunicationAuthorizationResult =
  | { ok: true; tenantId: string; demo: true; actor: PulseActor; context: null }
  | { ok: true; tenantId: string; demo: false; actor: null; context: MembershipRequestContext }
  | { ok: false; status: number; error: string }

export async function authorizeCommunicationSend(
  request: Request,
  defaultTenantId: string,
): Promise<CommunicationAuthorizationResult> {
  const requestedTenantId = new URL(request.url).searchParams.get('tenant')
  const legacyActor = await getRequestActor(request)
  const scope = legacyActor ? getAccessScope(legacyActor) : null

  if (legacyActor && scope?.kind === 'demo') {
    if (requestedTenantId && requestedTenantId !== scope.tenantId) {
      return { ok: false, status: 403, error: 'You do not have access to this account.' }
    }

    return {
      ok: true,
      tenantId: scope.tenantId,
      demo: true,
      actor: legacyActor,
      context: null,
    }
  }

  const tenantId = requestedTenantId || defaultTenantId
  const permission = await requirePermission(request, tenantId, PERMISSIONS.communicationsSend)
  if (!permission.ok) return permission

  return {
    ok: true,
    tenantId,
    demo: false,
    actor: null,
    context: permission.context,
  }
}