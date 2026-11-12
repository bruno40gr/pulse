import { supabaseAdmin } from '@/lib/supabase/admin'

const membershipColumns = 'id, tenant_id, person_id, auth_user_id, role_id, status, legacy_access_enabled'

/** Explicit administrator-created links only; never infer access from matching email. */
export async function findLoginMembership(authUserId: string, tenantId?: string) {
  let primary = supabaseAdmin.from('tenant_memberships').select(membershipColumns).eq('auth_user_id', authUserId)
  if (tenantId) primary = primary.eq('tenant_id', tenantId)
  const { data: membership, error } = await primary.maybeSingle()
  if (error) throw error
  if (membership) return membership

  return findLinkedLoginMembership(authUserId, tenantId)
}

/** Only call after checking primary membership; inactive primary access must not fall through. */
export async function findLinkedLoginMembership(authUserId: string, tenantId?: string) {
  const { data: link, error: linkError } = await supabaseAdmin
    .from('membership_login_links').select(`membership_id, tenant_memberships(${membershipColumns})`).eq('auth_user_id', authUserId)
    .is('revoked_at', null).maybeSingle()
  if (linkError) throw linkError
  if (!link) return null

  const joined = link.tenant_memberships
  const membershipRows = Array.isArray(joined) ? joined : joined ? [joined] : []
  if (membershipRows.length !== 1) throw new Error('Linked membership could not be verified.')
  const linked = membershipRows[0]
  if (linked.id !== link.membership_id) throw new Error('Linked membership does not match.')
  return tenantId && linked.tenant_id !== tenantId ? null : linked
}

/** Membership has already been resolved from this validated Auth identity. */
export async function loginMatchesMembership(authUserId: string, membershipId: string, tenantId: string) {
  const membership = await findLoginMembership(authUserId, tenantId)
  return membership?.id === membershipId && membership.status === 'active'
}