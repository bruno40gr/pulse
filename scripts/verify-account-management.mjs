import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const BASE_URL = process.env.PULSE_TEST_BASE_URL || 'http://127.0.0.1:3000'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const created = {
  membershipIds: [],
  instructorIds: [],
  personIds: [],
  roleIds: [],
  auditEventIds: [],
  authUserIds: [],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function createAccessCookie(actor) {
  const payload = base64Url(JSON.stringify({
    actor,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }))
  const secret = process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026'
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `pulse_access=${payload}.${signature}`
}

async function requestAccount(cookie, body) {
  const response = await fetch(`${BASE_URL}/api/account/access?tenant=${HEADLINER_TENANT_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

async function requestAccessData(cookie) {
  const response = await fetch(`${BASE_URL}/api/account/access?tenant=${HEADLINER_TENANT_ID}`, {
    headers: cookie ? { Cookie: cookie } : {},
  })
  return { status: response.status, body: await response.json() }
}

async function createUnrelatedSupabaseCookie(suffix) {
  const email = `account-precedence-${suffix}@example.invalid`
  const password = `Verifier-${suffix}-A9!`
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  created.authUserIds.push(createdUser.user.id)

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  assert(signIn.session, 'Temporary Supabase user must produce a session.')

  let sessionCookies = []
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: cookies => { sessionCookies = cookies },
      },
    },
  )
  const { error: sessionError } = await ssrClient.auth.setSession({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  })
  if (sessionError) throw sessionError
  assert(sessionCookies.length > 0, 'Supabase SSR session must emit cookies.')
  return sessionCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

async function tableCount(table, tenantId = HEADLINER_TENANT_ID) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  if (error) throw error
  return count || 0
}

async function loadActor(roleKey) {
  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('person_id, person:people(first_name, last_name), role:roles!inner(key)')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .eq('roles.key', roleKey)
    .limit(10)
  if (error) throw error

  for (const membership of memberships || []) {
    const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
    const { data: instructor, error: instructorError } = await supabase
      .from('instructors')
      .select('id')
      .eq('tenant_id', HEADLINER_TENANT_ID)
      .eq('person_id', membership.person_id)
      .maybeSingle()
    if (instructorError) throw instructorError
    if (!instructor || !person) continue
    return {
      instructorId: instructor.id,
      personId: membership.person_id,
      fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      displayName: `${person.first_name || 'Staff'} ${(person.last_name || '').slice(0, 1)}.`.trim(),
      access: { kind: 'headliner' },
    }
  }

  throw new Error(`No ${roleKey} actor with an instructor record was found.`)
}

async function createRestrictedActor(suffix) {
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .insert({
      tenant_id: HEADLINER_TENANT_ID,
      key: `account_test_restricted_${suffix}`,
      name: `Account Test Restricted ${suffix}`,
      description: 'Temporary authorization verification role.',
      is_system: false,
    })
    .select('id')
    .single()
  if (roleError) throw roleError
  created.roleIds.push(role.id)

  const { data: person, error: personError } = await supabase
    .from('people')
    .insert({
      tenant_id: HEADLINER_TENANT_ID,
      first_name: 'Restricted',
      last_name: `Verifier ${suffix}`,
      custom_fields: { staff_status: 'active' },
    })
    .select('id')
    .single()
  if (personError) throw personError
  created.personIds.push(person.id)

  const { data: instructor, error: instructorError } = await supabase
    .from('instructors')
    .insert({ tenant_id: HEADLINER_TENANT_ID, person_id: person.id })
    .select('id')
    .single()
  if (instructorError) throw instructorError
  created.instructorIds.push(instructor.id)

  const { data: membership, error: membershipError } = await supabase
    .from('tenant_memberships')
    .insert({
      tenant_id: HEADLINER_TENANT_ID,
      person_id: person.id,
      role_id: role.id,
      status: 'unclaimed',
      legacy_access_enabled: true,
    })
    .select('id')
    .single()
  if (membershipError) throw membershipError
  created.membershipIds.push(membership.id)

  return {
    instructorId: instructor.id,
    personId: person.id,
    fullName: `Restricted Verifier ${suffix}`,
    displayName: 'Restricted V.',
    access: { kind: 'headliner' },
  }
}

async function rememberCreatedAccount(responseBody) {
  created.membershipIds.push(responseBody.id)
  created.personIds.push(responseBody.person_id)

  const [{ data: instructor, error: instructorError }, { data: auditEvent, error: auditError }] = await Promise.all([
    supabase
      .from('instructors')
      .select('id')
      .eq('tenant_id', HEADLINER_TENANT_ID)
      .eq('person_id', responseBody.person_id)
      .single(),
    supabase
      .from('account_audit_events')
      .select('id, metadata')
      .eq('tenant_id', HEADLINER_TENANT_ID)
      .eq('target_membership_id', responseBody.id)
      .eq('event_type', 'membership.created')
      .single(),
  ])
  if (instructorError) throw instructorError
  if (auditError) throw auditError
  created.instructorIds.push(instructor.id)
  created.auditEventIds.push(auditEvent.id)
  assert(auditEvent.metadata?.auth_user_created === false, 'Audit event must record that no Auth user was created.')
  assert(auditEvent.metadata?.invitation_sent === false, 'Audit event must record that no invitation was sent.')
}

async function cleanup() {
  if (created.membershipIds.length) {
    const { error } = await supabase.from('tenant_memberships').delete().in('id', created.membershipIds)
    if (error) throw error
  }
  if (created.instructorIds.length) {
    const { error } = await supabase.from('instructors').delete().in('id', created.instructorIds)
    if (error) throw error
  }
  if (created.personIds.length) {
    const { error } = await supabase.from('people').delete().in('id', created.personIds)
    if (error) throw error
  }
  if (created.roleIds.length) {
    const { error } = await supabase.from('roles').delete().in('id', created.roleIds)
    if (error) throw error
  }
  if (created.authUserIds.length) {
    for (const authUserId of created.authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(authUserId)
      if (error) throw error
    }
  }
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
const baseline = {}

try {
  ;[baseline.memberships, baseline.instructors, baseline.people, baseline.roles, baseline.auditEvents] = await Promise.all([
    tableCount('tenant_memberships'),
    tableCount('instructors'),
    tableCount('people'),
    tableCount('roles'),
    tableCount('account_audit_events'),
  ])
  const { data: authBefore, error: authBeforeError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authBeforeError) throw authBeforeError

  const [{ data: roleRows, error: roleError }, ownerActor, adminActor, restrictedActor] = await Promise.all([
    supabase.from('roles').select('id, key').eq('tenant_id', HEADLINER_TENANT_ID).in('key', ['owner', 'admin']),
    loadActor('owner'),
    loadActor('admin'),
    createRestrictedActor(suffix),
  ])
  if (roleError) throw roleError
  const ownerRoleId = roleRows.find(role => role.key === 'owner')?.id
  const adminRoleId = roleRows.find(role => role.key === 'admin')?.id
  assert(ownerRoleId && adminRoleId, 'Owner and Admin roles are required.')

  const { data: crossTenantRole, error: crossRoleError } = await supabase
    .from('roles')
    .select('id')
    .neq('tenant_id', HEADLINER_TENANT_ID)
    .limit(1)
    .maybeSingle()
  if (crossRoleError) throw crossRoleError
  const { data: crossTenantInstructor, error: crossPersonError } = await supabase
    .from('instructors')
    .select('person_id')
    .neq('tenant_id', HEADLINER_TENANT_ID)
    .limit(1)
    .maybeSingle()
  if (crossPersonError) throw crossPersonError
  assert(crossTenantRole && crossTenantInstructor, 'Cross-tenant fixtures are required for isolation checks.')

  const ownerCookie = createAccessCookie(ownerActor)
  const adminCookie = createAccessCookie(adminActor)
  const restrictedCookie = createAccessCookie(restrictedActor)
  const unrelatedSupabaseCookie = await createUnrelatedSupabaseCookie(suffix)

  let accessResult = await requestAccessData(ownerCookie)
  assert(accessResult.status === 200, `Owner access-data request expected 200, received ${accessResult.status}: ${accessResult.body.error || ''}`)
  assert(accessResult.body.canManageRoles === true, 'Owner access-data response must allow role management.')
  assert(Array.isArray(accessResult.body.memberships) && accessResult.body.memberships.length > 0, 'Owner access-data response must include staff memberships.')

  accessResult = await requestAccessData(`${ownerCookie}; ${unrelatedSupabaseCookie}`)
  assert(accessResult.status === 200, `Mixed legacy/Supabase request expected 200, received ${accessResult.status}: ${accessResult.body.error || ''}`)
  assert(accessResult.body.currentRoleKey === 'owner', 'A valid legacy Owner actor must take precedence over an unrelated Supabase session.')

  accessResult = await requestAccessData(adminCookie)
  assert(accessResult.status === 200, `Admin access-data request expected 200, received ${accessResult.status}: ${accessResult.body.error || ''}`)
  assert(accessResult.body.canManageRoles === true, 'Admin access-data response must allow role management.')

  let result = await requestAccount(null, { action: 'add_account', source: 'new', roleId: adminRoleId, firstName: 'No', lastName: 'Session' })
  assert(result.status === 401, `Unauthenticated request expected 401, received ${result.status}.`)

  result = await requestAccount(restrictedCookie, { action: 'add_account', source: 'new', roleId: adminRoleId, firstName: 'Restricted', lastName: 'Denied' })
  assert(result.status === 403, `Restricted role expected 403, received ${result.status}.`)

  result = await requestAccount(adminCookie, { action: 'add_account', source: 'new', roleId: ownerRoleId, firstName: 'Admin', lastName: 'Cannot Own' })
  assert(result.status === 403, `Admin-to-Owner escalation expected 403, received ${result.status}.`)

  result = await requestAccount(ownerCookie, { action: 'add_account', source: 'new', roleId: adminRoleId, firstName: '', lastName: '' })
  assert(result.status === 400, `Missing names expected 400, received ${result.status}.`)

  const { data: existingEmailPerson, error: existingEmailError } = await supabase
    .from('people')
    .select('email')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .not('email', 'is', null)
    .limit(1)
    .single()
  if (existingEmailError) throw existingEmailError
  result = await requestAccount(ownerCookie, {
    action: 'add_account', source: 'new', roleId: adminRoleId,
    firstName: 'Duplicate', lastName: `Email ${suffix}`, email: existingEmailPerson.email,
  })
  assert(result.status === 409, `Duplicate email expected 409, received ${result.status}.`)

  result = await requestAccount(ownerCookie, {
    action: 'add_account', source: 'new', roleId: crossTenantRole.id,
    firstName: 'Cross', lastName: `Role ${suffix}`,
  })
  assert(result.status === 404, `Cross-tenant role expected 404, received ${result.status}.`)

  result = await requestAccount(ownerCookie, {
    action: 'add_account', source: 'existing', roleId: adminRoleId, personId: crossTenantInstructor.person_id,
  })
  assert(result.status === 404, `Cross-tenant person expected 404, received ${result.status}.`)

  const ownerCreatedName = `Owner Created ${suffix}`
  result = await requestAccount(ownerCookie, {
    action: 'add_account', source: 'new', roleId: adminRoleId,
    firstName: 'Owner', lastName: `Created ${suffix}`, email: '', phone: '',
  })
  assert(result.status === 201, `Owner account creation expected 201, received ${result.status}: ${result.body.error || ''}`)
  assert(result.body.status === 'unclaimed', 'Owner-created membership must be unclaimed.')
  assert(result.body.auth_user_id === null, 'Owner-created membership must not have an Auth user.')
  assert(result.body.person?.email === null, 'Owner-created person should allow a missing email.')
  await rememberCreatedAccount(result.body)

  const duplicatePersonId = result.body.person_id
  result = await requestAccount(ownerCookie, {
    action: 'add_account', source: 'existing', roleId: adminRoleId, personId: duplicatePersonId,
  })
  assert(result.status === 409, `Duplicate membership expected 409, received ${result.status}.`)

  result = await requestAccount(adminCookie, {
    action: 'add_account', source: 'new', roleId: adminRoleId,
    firstName: 'Admin', lastName: `Created ${suffix}`, email: '', phone: '',
  })
  assert(result.status === 201, `Admin account creation expected 201, received ${result.status}: ${result.body.error || ''}`)
  assert(result.body.status === 'unclaimed' && result.body.auth_user_id === null, 'Admin-created membership must remain unclaimed without an Auth user.')
  await rememberCreatedAccount(result.body)

  const { data: authAfter, error: authAfterError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authAfterError) throw authAfterError
  const expectedAuthUsers = authBefore.total + created.authUserIds.length
  assert(authAfter.total === expectedAuthUsers, `Account creation unexpectedly changed the Auth user count. Expected ${expectedAuthUsers}, received ${authAfter.total}.`)

  console.log(`PASS: account-management HTTP matrix verified against ${BASE_URL}.`)
  console.log(`PASS: ${ownerCreatedName} was created without email, phone, invitation, or Auth user and marked for cleanup.`)
} finally {
  await cleanup()

  if (Object.keys(baseline).length) {
    const restored = await Promise.all([
      tableCount('tenant_memberships'),
      tableCount('instructors'),
      tableCount('people'),
      tableCount('roles'),
      tableCount('account_audit_events'),
    ])
    const expected = [baseline.memberships, baseline.instructors, baseline.people, baseline.roles, baseline.auditEvents + created.auditEventIds.length]
    assert(restored.every((count, index) => count === expected[index]), `Cleanup failed. Expected ${expected.join(', ')}, received ${restored.join(', ')}.`)
    console.log(`PASS: temporary mutable records and Auth users were removed; ${created.auditEventIds.length} immutable membership.created audit events were retained.`)
  }
}