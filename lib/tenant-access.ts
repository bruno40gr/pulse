import { formatTeacherDisplayName, getAccessScope, getRequestActor } from '@/lib/access'
import type { MembershipRequestContext } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authorizeTenantRequest } from '@/lib/tenant-request'

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
  // Retained for caller compatibility only; never use a hardcoded default as authorization.
  void defaultTenantId
  const actor = await getRequestActor(request)
  const access = await authorizeTenantRequest(request, { allowDemo: true })
  if (!access.ok) return access
  const tenantId = access.tenantId
  if (actor && getAccessScope(actor).kind === 'demo') {
    return { ok: true, tenantId, identity: actor, context: null }
  }
  const membership = { context: access.context! }
  if (actor) return { ok: true, tenantId, identity: actor, context: membership.context }

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