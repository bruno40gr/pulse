import { supabaseAdmin } from '@/lib/supabase/admin'

const membershipColumns = 'id, tenant_id, person_id, auth_user_id, role_id, status, legacy_access_enabled'

/** Explicit administrator-created links only; never infer access from matching email. */
export async function findLoginMembership(authUserId: string, tenantId?: string) {
  let primary = supabaseAdmin.from('tenant_memberships').select(membershipColumns).eq('auth_user_id', authUserId)
  if (tenantId) primary = primary.eq('tenant_id', tenantId)
  const { data: membership, error } = await primary.maybeSingle()
  if (error) throw error
  if (membership) return membership

  const { data: link, error: linkError } = await supabaseAdmin
    .from('membership_login_links').select('membership_id').eq('auth_user_id', authUserId)
    .is('revoked_at', null).maybeSingle()
  if (linkError) throw linkError
  if (!link) return null

  let linked = supabaseAdmin.from('tenant_memberships').select(membershipColumns).eq('id', link.membership_id)
  if (tenantId) linked = linked.eq('tenant_id', tenantId)
  const { data, error: membershipError } = await linked.maybeSingle()
  if (membershipError) throw membershipError
  return data
}

/** Membership has already been resolved from this validated Auth identity. */
export async function loginMatchesMembership(authUserId: string, membershipId: string, tenantId: string) {
  const membership = await findLoginMembership(authUserId, tenantId)
  return membership?.id === membershipId && membership.status === 'active'
}