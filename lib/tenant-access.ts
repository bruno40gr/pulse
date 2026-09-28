import { canAccessTenant, formatTeacherDisplayName, getAccessScope, getRequestActor } from '@/lib/access'
import { resolveMembershipRequestContext, type MembershipRequestContext } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type RequestIdentity = {
  instructorId: string | null
  personId: string
  displayName: string
}

export type TenantAccessResult =
  | { ok: true; tenantId: string; identity: RequestIdentity; context: MembershipRequestContext | null }
  | { ok: false; status: number; error: string }

export async function resolveRequestTenant(
  request: Request,
  defaultTenantId: string,
): Promise<TenantAccessResult> {
  const actor = await getRequestActor(request)
  const requestedTenantId = new URL(request.url).searchParams.get('tenant')
  const scope = actor ? getAccessScope(actor) : null

  // A demo session's tenant comes exclusively from its signed cookie. This
  // deliberately prevents a missing or manipulated query parameter from
  // falling back to Headliner data.
  if (actor && scope?.kind === 'demo') {
    if (requestedTenantId && requestedTenantId !== scope.tenantId) {
      return { ok: false, status: 403, error: 'You do not have access to this account.' }
    }

    return { ok: true, tenantId: scope.tenantId, identity: actor, context: null }
  }

  const tenantId = requestedTenantId || defaultTenantId
  if (actor) {
    if (!canAccessTenant(actor, tenantId)) {
      return { ok: false, status: 403, error: 'You do not have access to this account.' }
    }
    return { ok: true, tenantId, identity: actor, context: null }
  }

  const membership = await resolveMembershipRequestContext(request, tenantId)
  if (!membership.ok) return { ok: false, status: membership.status, error: membership.error }

  const [{ data: person, error: personError }, { data: instructor, error: instructorError }] = await Promise.all([
    supabaseAdmin
      .from('people')
      .select('first_name, last_name')
      .eq('id', membership.context.personId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('person_id', membership.context.personId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ])
  if (personError) throw personError
  if (instructorError) throw instructorError

  const firstName = person?.first_name || ''
  const lastName = person?.last_name || ''
  return {
    ok: true,
    tenantId,
    context: membership.context,
    identity: {
      instructorId: instructor?.id || null,
      personId: membership.context.personId,
      displayName: formatTeacherDisplayName(firstName, lastName) || 'Staff member',
    },
  }
}