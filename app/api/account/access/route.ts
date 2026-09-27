import { NextResponse } from 'next/server'
import { requireAccountAdministrator } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_TENANT } from '@/lib/tenant'
import { normalizeAccountEmail, sendMembershipSetupEmail } from '@/lib/account-invitations'

type AccessAction =
  | { action: 'assign_role'; membershipId: string; roleId: string }
  | { action: 'update_role_permissions'; roleId: string; permissionIds: string[] }

function getTenantId(request: Request) {
  return new URL(request.url).searchParams.get('tenant') || DEFAULT_TENANT
}

function roleKeyFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function currentHeadlinerDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isEligibleStaff(customFields: Record<string, unknown> | null | undefined) {
  if (customFields?.staff_status === 'sunset') return false
  const startsOn = typeof customFields?.staff_start_date === 'string' ? customFields.staff_start_date : null
  return !startsOn || startsOn <= currentHeadlinerDate()
}

async function writeAuditEvent(input: {
  tenantId: string
  actorMembershipId: string
  targetMembershipId?: string
  eventType: string
  metadata: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin
    .from('account_audit_events')
    .insert({
      tenant_id: input.tenantId,
      actor_membership_id: input.actorMembershipId,
      target_membership_id: input.targetMembershipId || null,
      event_type: input.eventType,
      metadata: input.metadata,
    })
  if (error) throw error
}

export async function GET(request: Request) {
  const tenantId = getTenantId(request)

  try {
    const accountAccess = await requireAccountAdministrator(request, tenantId)
    if (!accountAccess.ok) return NextResponse.json({ error: accountAccess.error }, { status: accountAccess.status })

    const [rolesResult, permissionsResult, membershipsResult, instructorsResult] = await Promise.all([
      supabaseAdmin
        .from('roles')
        .select('id, key, name, description, is_system')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabaseAdmin
        .from('permissions')
        .select('id, key, description')
        .order('key'),
      supabaseAdmin
        .from('tenant_memberships')
        .select('id, person_id, role_id, status, auth_user_id, invited_at, activated_at')
        .eq('tenant_id', tenantId)
        .order('created_at'),
      supabaseAdmin
        .from('instructors')
        .select('person_id, person:people(id, first_name, last_name, email, phone, custom_fields)')
        .eq('tenant_id', tenantId),
    ])

    if (rolesResult.error) throw rolesResult.error
    if (permissionsResult.error) throw permissionsResult.error
    if (membershipsResult.error) throw membershipsResult.error
    if (instructorsResult.error) throw instructorsResult.error

    const roles = rolesResult.data || []
    const memberships = membershipsResult.data || []
    const roleIds = roles.map(role => role.id)
    const personIds = memberships.map(membership => membership.person_id)
    const membershipPersonIds = new Set(personIds)

    const [rolePermissionsResult, peopleResult] = await Promise.all([
      roleIds.length
        ? supabaseAdmin.from('role_permissions').select('role_id, permission_id').in('role_id', roleIds)
        : Promise.resolve({ data: [], error: null }),
      personIds.length
        ? supabaseAdmin.from('people').select('id, first_name, last_name, email, custom_fields').in('id', personIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (rolePermissionsResult.error) throw rolePermissionsResult.error
    if (peopleResult.error) throw peopleResult.error

    const peopleById = new Map((peopleResult.data || []).map(person => [person.id, person]))
    const permissionIdsByRole = new Map<string, string[]>()
    for (const mapping of rolePermissionsResult.data || []) {
      const permissionIds = permissionIdsByRole.get(mapping.role_id) || []
      permissionIds.push(mapping.permission_id)
      permissionIdsByRole.set(mapping.role_id, permissionIds)
    }

    return NextResponse.json({
      currentMembershipId: accountAccess.context.membershipId,
      currentRoleKey: accountAccess.context.roleKey,
      canManageRoles: true,
      roles: roles.map(role => ({
        ...role,
        permissionIds: permissionIdsByRole.get(role.id) || [],
      })),
      permissions: permissionsResult.data || [],
      memberships: memberships.map(membership => ({
        ...membership,
        person: peopleById.get(membership.person_id) || null,
      })),
      availableStaff: (instructorsResult.data || []).flatMap(instructor => {
        const person = Array.isArray(instructor.person) ? instructor.person[0] : instructor.person
        if (!person || membershipPersonIds.has(instructor.person_id) || !isEligibleStaff(person.custom_fields)) return []
        return [{ ...person, person_id: instructor.person_id }]
      }).sort((left, right) => `${left.last_name || ''} ${left.first_name || ''}`.localeCompare(`${right.last_name || ''} ${right.first_name || ''}`)),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const tenantId = getTenantId(request)

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an account-management request.' }, { status: 400 })
    }

    if (body.action === 'add_account') {
      const accountAccess = await requireAccountAdministrator(request, tenantId)
      if (!accountAccess.ok) return NextResponse.json({ error: accountAccess.error }, { status: accountAccess.status })

      const source = body.source === 'existing' ? 'existing' : body.source === 'new' ? 'new' : null
      const roleId = typeof body.roleId === 'string' ? body.roleId : ''
      if (!source || !roleId) return NextResponse.json({ error: 'Choose a staff member and role.' }, { status: 400 })

      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, key, name')
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (roleError) throw roleError
      if (!role) return NextResponse.json({ error: 'Role not found.' }, { status: 404 })
      if (role.key === 'owner' && accountAccess.context.roleKey !== 'owner') {
        return NextResponse.json({ error: 'Only an Owner can add another Owner.' }, { status: 403 })
      }

      let personId = ''
      let createdPersonId: string | null = null
      let createdInstructorId: string | null = null
      let createdMembershipId: string | null = null

      try {
        if (source === 'existing') {
          personId = typeof body.personId === 'string' ? body.personId : ''
          if (!personId) return NextResponse.json({ error: 'Choose an existing staff member.' }, { status: 400 })

          const { data: instructor, error: instructorError } = await supabaseAdmin
            .from('instructors')
            .select('id, person:people(id, custom_fields)')
            .eq('tenant_id', tenantId)
            .eq('person_id', personId)
            .maybeSingle()
          if (instructorError) throw instructorError
          const person = Array.isArray(instructor?.person) ? instructor.person[0] : instructor?.person
          if (!instructor || !person) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 })
          if (!isEligibleStaff(person.custom_fields)) {
            return NextResponse.json({ error: 'This staff member is inactive or not yet eligible for account access.' }, { status: 409 })
          }
        } else {
          const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
          const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
      const email = normalizeAccountEmail(body.email)
          const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
          if (!firstName || !lastName) return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
          if (firstName.length > 100 || lastName.length > 100 || email.length > 320 || phone.length > 40) {
            return NextResponse.json({ error: 'One or more staff details are too long.' }, { status: 400 })
          }
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Enter a valid email address or leave it blank.' }, { status: 400 })
          }

          if (email) {
            const { data: duplicateEmail, error: duplicateEmailError } = await supabaseAdmin
              .from('people')
              .select('id')
              .eq('tenant_id', tenantId)
              .ilike('email', email)
              .limit(1)
              .maybeSingle()
            if (duplicateEmailError) throw duplicateEmailError
            if (duplicateEmail) {
              return NextResponse.json({ error: 'That email is already attached to another person in this account.' }, { status: 409 })
            }
          }

          const { data: duplicate, error: duplicateError } = await supabaseAdmin
            .from('people')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .limit(1)
            .maybeSingle()
          if (duplicateError) throw duplicateError
          if (duplicate) {
            return NextResponse.json({ error: 'A person with that name already exists. Choose the existing staff record instead.' }, { status: 409 })
          }

          const { data: person, error: personError } = await supabaseAdmin
            .from('people')
            .insert({
              tenant_id: tenantId,
              first_name: firstName,
              last_name: lastName,
              email: email || null,
              phone: phone || null,
              custom_fields: { staff_status: 'active', staff_start_date: currentHeadlinerDate() },
            })
            .select('id')
            .single()
          if (personError) throw personError
          personId = person.id
          createdPersonId = person.id

          const { data: instructor, error: instructorError } = await supabaseAdmin
            .from('instructors')
            .insert({ tenant_id: tenantId, person_id: personId })
            .select('id')
            .single()
          if (instructorError) throw instructorError
          createdInstructorId = instructor.id
        }

        const { data: existingMembership, error: existingError } = await supabaseAdmin
          .from('tenant_memberships')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('person_id', personId)
          .maybeSingle()
        if (existingError) throw existingError
        if (existingMembership) {
          if (createdInstructorId) await supabaseAdmin.from('instructors').delete().eq('id', createdInstructorId)
          if (createdPersonId) await supabaseAdmin.from('people').delete().eq('id', createdPersonId)
          return NextResponse.json({ error: 'This staff member already has an account.' }, { status: 409 })
        }

        const { data: membership, error: membershipError } = await supabaseAdmin
          .from('tenant_memberships')
          .insert({
            tenant_id: tenantId,
            person_id: personId,
            role_id: role.id,
            status: 'unclaimed',
            legacy_access_enabled: true,
          })
          .select('id, person_id, role_id, status, auth_user_id, invited_at, activated_at')
          .single()
        if (membershipError) throw membershipError
        createdMembershipId = membership.id

        const { data: person, error: personError } = await supabaseAdmin
          .from('people')
          .select('id, first_name, last_name, email, custom_fields')
          .eq('id', personId)
          .single()
        if (personError) throw personError

        await writeAuditEvent({
          tenantId,
          actorMembershipId: accountAccess.context.membershipId,
          targetMembershipId: membership.id,
          eventType: 'membership.created',
          metadata: { role_id: role.id, role_key: role.key, source, auth_user_created: false, invitation_sent: false },
        })

        return NextResponse.json({ ...membership, person }, { status: 201 })
      } catch (error) {
        if (createdMembershipId) await supabaseAdmin.from('tenant_memberships').delete().eq('id', createdMembershipId)
        if (createdInstructorId) await supabaseAdmin.from('instructors').delete().eq('id', createdInstructorId)
        if (createdPersonId) await supabaseAdmin.from('people').delete().eq('id', createdPersonId)
        throw error
      }
    }

    if (body.action === 'invite' || body.action === 'resend_invitation') {
      const accountAccess = await requireAccountAdministrator(request, tenantId)
      if (!accountAccess.ok) return NextResponse.json({ error: accountAccess.error }, { status: accountAccess.status })

      const membershipId = typeof body.membershipId === 'string' ? body.membershipId : ''
      if (!membershipId) return NextResponse.json({ error: 'Choose a staff account.' }, { status: 400 })

      const result = await sendMembershipSetupEmail({
        request,
        tenantId,
        membershipId,
        actorMembershipId: accountAccess.context.membershipId,
        initiatedBy: 'administrator',
        delivery: body.action === 'resend_invitation' ? 'resend' : 'invite',
      })
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({
        ok: true,
        status: result.status,
        auth_user_id: result.authUserId,
        invited_at: result.invitedAt,
      })
    }

    const roleAccess = await requireAccountAdministrator(request, tenantId)
    if (!roleAccess.ok) return NextResponse.json({ error: roleAccess.error }, { status: roleAccess.status })

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const key = roleKeyFromName(name)

    if (!name || !key) return NextResponse.json({ error: 'Enter a role name.' }, { status: 400 })
    if (key === 'owner') return NextResponse.json({ error: 'Owner is a reserved role.' }, { status: 400 })

    const { data: role, error } = await supabaseAdmin
      .from('roles')
      .insert({ tenant_id: tenantId, key, name, description: description || null, is_system: false })
      .select('id, key, name, description, is_system')
      .single()

    if (error) throw error

    await writeAuditEvent({
      tenantId,
      actorMembershipId: roleAccess.context.membershipId,
      eventType: 'role.created',
      metadata: { role_id: role.id, role_key: role.key, role_name: role.name },
    })

    return NextResponse.json({ ...role, permissionIds: [] }, { status: 201 })
  } catch (error) {
    const message = (error as Error).message
    const isDuplicateMembership = message.includes('tenant_memberships_tenant_id_person_id_key')
    const isDuplicateRole = message.includes('duplicate key') && !isDuplicateMembership
    const status = isDuplicateMembership || isDuplicateRole ? 409 : 500
    const safeMessage = isDuplicateMembership
      ? 'This staff member already has an account.'
      : isDuplicateRole
        ? 'A role with that name already exists.'
        : message
    return NextResponse.json({ error: safeMessage }, { status })
  }
}

export async function PATCH(request: Request) {
  const tenantId = getTenantId(request)

  try {
    const roleAccess = await requireAccountAdministrator(request, tenantId)
    if (!roleAccess.ok) return NextResponse.json({ error: roleAccess.error }, { status: roleAccess.status })

    const body = await request.json() as AccessAction

    if (body.action === 'assign_role') {
      const { data: target, error: targetError } = await supabaseAdmin
        .from('tenant_memberships')
        .select('id, role_id')
        .eq('id', body.membershipId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (targetError) throw targetError
      if (!target) return NextResponse.json({ error: 'Staff membership not found.' }, { status: 404 })

      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, key, name')
        .eq('id', body.roleId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (roleError) throw roleError
      if (!role) return NextResponse.json({ error: 'Role not found.' }, { status: 404 })
      if (role.key === 'owner' && roleAccess.context.roleKey !== 'owner') {
        return NextResponse.json({ error: 'Only an Owner can assign the Owner role.' }, { status: 403 })
      }

      const { error: updateError } = await supabaseAdmin
        .from('tenant_memberships')
        .update({ role_id: role.id })
        .eq('id', target.id)
        .eq('tenant_id', tenantId)
      if (updateError) throw updateError

      await writeAuditEvent({
        tenantId,
        actorMembershipId: roleAccess.context.membershipId,
        targetMembershipId: target.id,
        eventType: 'membership.role_changed',
        metadata: { previous_role_id: target.role_id, role_id: role.id, role_key: role.key },
      })

      return NextResponse.json({ ok: true })
    }

    if (body.action === 'update_role_permissions') {
      const permissionIds = Array.isArray(body.permissionIds)
        ? [...new Set(body.permissionIds.filter(value => typeof value === 'string'))]
        : []

      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, key, name')
        .eq('id', body.roleId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (roleError) throw roleError
      if (!role) return NextResponse.json({ error: 'Role not found.' }, { status: 404 })
      if (role.key === 'owner') {
        return NextResponse.json({ error: 'Owner permissions are fixed at full access.' }, { status: 400 })
      }

      if (permissionIds.length) {
        const { data: validPermissions, error: permissionError } = await supabaseAdmin
          .from('permissions')
          .select('id')
          .in('id', permissionIds)
        if (permissionError) throw permissionError
        if ((validPermissions || []).length !== permissionIds.length) {
          return NextResponse.json({ error: 'One or more permissions are invalid.' }, { status: 400 })
        }
      }

      const { data: previousMappings, error: previousError } = await supabaseAdmin
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', role.id)
      if (previousError) throw previousError

      const { error: deleteError } = await supabaseAdmin
        .from('role_permissions')
        .delete()
        .eq('role_id', role.id)
      if (deleteError) throw deleteError

      if (permissionIds.length) {
        const { error: insertError } = await supabaseAdmin
          .from('role_permissions')
          .insert(permissionIds.map(permissionId => ({ role_id: role.id, permission_id: permissionId })))

        if (insertError) {
          const previousPermissionIds = (previousMappings || []).map(mapping => mapping.permission_id)
          if (previousPermissionIds.length) {
            await supabaseAdmin
              .from('role_permissions')
              .insert(previousPermissionIds.map(permissionId => ({ role_id: role.id, permission_id: permissionId })))
          }
          throw insertError
        }
      }

      await writeAuditEvent({
        tenantId,
        actorMembershipId: roleAccess.context.membershipId,
        eventType: 'role.permissions_changed',
        metadata: {
          role_id: role.id,
          role_key: role.key,
          permission_ids: permissionIds,
          previous_permission_ids: (previousMappings || []).map(mapping => mapping.permission_id),
        },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unsupported access-management action.' }, { status: 400 })
  } catch (error) {
    const message = (error as Error).message
    const status = message.includes('last Owner') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}