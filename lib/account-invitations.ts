import { supabaseAdmin } from '@/lib/supabase/admin'

export function normalizeAccountEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function accountAppOrigin(request: Request) {
  const configured = process.env.PULSE_APP_URL?.trim()
  return configured ? configured.replace(/\/$/, '') : new URL(request.url).origin
}

export function maskAccountEmail(value: string) {
  const [local, domain] = normalizeAccountEmail(value).split('@')
  if (!local || !domain) return null
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

async function listAllAuthUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function invitationEmailError(input: {
  membershipId: string
  personId: string
  email: string
  linkedAuthUserId: string | null
}) {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return 'A valid staff email must be added by an Owner or Admin before setup can begin.'
  }

  const { data: people, error: peopleError } = await supabaseAdmin
    .from('people')
    .select('id')
    .ilike('email', input.email)
  if (peopleError) throw peopleError
  const otherPersonIds = (people || []).filter(person => person.id !== input.personId).map(person => person.id)
  if (otherPersonIds.length) {
    const { data: duplicateMembership, error: duplicateMembershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id')
      .in('person_id', otherPersonIds)
      .limit(1)
      .maybeSingle()
    if (duplicateMembershipError) throw duplicateMembershipError
    if (duplicateMembership) return 'That email is attached to another staff membership.'
  }

  const authUsers = await listAllAuthUsers()
  const matchingAuthUsers = authUsers.filter(user => normalizeAccountEmail(user.email) === input.email)
  if (input.linkedAuthUserId) {
    if (matchingAuthUsers.length !== 1 || matchingAuthUsers[0].id !== input.linkedAuthUserId) {
      return 'The linked Supabase Auth user does not match this staff email.'
    }
  } else if (matchingAuthUsers.length) {
    return 'That email already belongs to an unlinked account. Ask an Owner or Admin to resolve it.'
  }

  if (input.linkedAuthUserId) {
    const { data: duplicateLink, error: duplicateLinkError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id')
      .neq('id', input.membershipId)
      .eq('auth_user_id', input.linkedAuthUserId)
      .maybeSingle()
    if (duplicateLinkError) throw duplicateLinkError
    if (duplicateLink) return 'That Auth user is already linked to another staff membership.'
  }

  return null
}

async function writeInvitationAudit(input: {
  tenantId: string
  actorMembershipId: string
  targetMembershipId: string
  eventType: string
  metadata: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin.from('account_audit_events').insert({
    tenant_id: input.tenantId,
    actor_membership_id: input.actorMembershipId,
    target_membership_id: input.targetMembershipId,
    event_type: input.eventType,
    metadata: input.metadata,
  })
  if (error) throw error
}

export async function sendMembershipSetupEmail(input: {
  request: Request
  tenantId: string
  membershipId: string
  actorMembershipId: string
  initiatedBy: 'administrator' | 'staff'
  delivery?: 'invite' | 'resend' | 'automatic'
}) {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('tenant_account_settings')
    .select('allow_admin_invitations')
    .eq('tenant_id', input.tenantId)
    .maybeSingle()
  if (settingsError) throw settingsError
  if (input.initiatedBy === 'administrator' && !settings?.allow_admin_invitations) {
    return { ok: false as const, status: 403, error: 'Staff account setup emails are disabled.' }
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('tenant_memberships')
    .select('id, person_id, status, auth_user_id, person:people(id, email)')
    .eq('id', input.membershipId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) return { ok: false as const, status: 404, error: 'Staff membership not found.' }

  const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
  const email = normalizeAccountEmail(person?.email)
  const isResend = membership.status === 'invited' && Boolean(membership.auth_user_id)
  if (input.delivery === 'invite' && isResend) {
    return { ok: false as const, status: 409, error: 'Only an unclaimed account can receive its first invitation.' }
  }
  if (input.delivery === 'resend' && !isResend) {
    return { ok: false as const, status: 409, error: 'Only a linked invited account can receive another setup email.' }
  }
  if (!isResend && (membership.status !== 'unclaimed' || membership.auth_user_id)) {
    return { ok: false as const, status: 409, error: 'This account cannot receive a setup email from its current state.' }
  }

  const emailError = await invitationEmailError({
    membershipId: membership.id,
    personId: membership.person_id,
    email,
    linkedAuthUserId: membership.auth_user_id,
  })
  if (emailError) return { ok: false as const, status: 409, error: emailError }

  const redirectTo = `${accountAppOrigin(input.request)}/claim`
  const invitedAt = new Date().toISOString()

  if (isResend) {
    const { error: resendError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })
    if (resendError) throw resendError
    const { error: updateError } = await supabaseAdmin
      .from('tenant_memberships')
      .update({ invited_at: invitedAt })
      .eq('id', membership.id)
      .eq('tenant_id', input.tenantId)
      .eq('status', 'invited')
    if (updateError) throw updateError
    await writeInvitationAudit({
      tenantId: input.tenantId,
      actorMembershipId: input.actorMembershipId,
      targetMembershipId: membership.id,
      eventType: 'membership.invitation_resent',
      metadata: { email, initiated_by: input.initiatedBy },
    })
    return { ok: true as const, status: 'invited' as const, authUserId: membership.auth_user_id, invitedAt, resent: true }
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { tenant_id: input.tenantId, membership_id: membership.id },
  })
  if (invitationError) {
    const status = invitationError.message.toLowerCase().includes('already') ? 409 : 502
    return { ok: false as const, status, error: invitationError.message }
  }

  try {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tenant_memberships')
      .update({ auth_user_id: invitation.user.id, status: 'invited', invited_at: invitedAt })
      .eq('id', membership.id)
      .eq('tenant_id', input.tenantId)
      .eq('status', 'unclaimed')
      .is('auth_user_id', null)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new Error('The membership changed before the setup email could be linked.')

    await writeInvitationAudit({
      tenantId: input.tenantId,
      actorMembershipId: input.actorMembershipId,
      targetMembershipId: membership.id,
      eventType: 'membership.invited',
      metadata: { email, auth_user_id: invitation.user.id, initiated_by: input.initiatedBy },
    })
  } catch (error) {
    await supabaseAdmin
      .from('tenant_memberships')
      .update({ auth_user_id: null, status: 'unclaimed', invited_at: null })
      .eq('id', membership.id)
      .eq('tenant_id', input.tenantId)
      .eq('auth_user_id', invitation.user.id)
    await supabaseAdmin.auth.admin.deleteUser(invitation.user.id)
    throw error
  }

  return { ok: true as const, status: 'invited' as const, authUserId: invitation.user.id, invitedAt, resent: false }
}