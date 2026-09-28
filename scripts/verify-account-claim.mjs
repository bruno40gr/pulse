import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const BASE_URL = process.env.PULSE_TEST_BASE_URL || 'http://127.0.0.1:3000'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const created = {
  personIds: [],
  instructorIds: [],
  membershipIds: [],
  authUserIds: [],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function createLegacyCookie(actor) {
  const payload = base64Url(JSON.stringify({ actor, expiresAt: Date.now() + 60 * 60 * 1000 }))
  const secret = process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026'
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `pulse_access=${payload}.${signature}`
}

function responseCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
  return values.map(value => value.split(';', 1)[0]).filter(Boolean).join('; ')
}

function combineCookies(...cookieHeaders) {
  const cookies = new Map()
  for (const header of cookieHeaders) {
    for (const part of (header || '').split(';')) {
      const trimmed = part.trim()
      const separator = trimmed.indexOf('=')
      if (separator <= 0) continue
      const name = trimmed.slice(0, separator)
      const value = trimmed.slice(separator + 1)
      if (value) cookies.set(name, value)
      else cookies.delete(name)
    }
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function sessionCookie(email, password) {
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await auth.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session, 'Password sign-in did not create a session.')

  let cookies = []
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [], setAll: values => { cookies = values } } },
  )
  const { error: sessionError } = await ssr.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  if (sessionError) throw sessionError
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  let body = null
  try { body = await response.json() } catch {}
  return { status: response.status, body, cookies: responseCookies(response) }
}

async function createStaffFixture({ email, status = 'unclaimed', authUserId = null, password = null }) {
  const { data: adminRole, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .eq('key', 'admin')
    .single()
  if (roleError) throw roleError

  let linkedAuthUserId = authUserId
  if (!linkedAuthUserId && password) {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { verification_fixture: 'account-claim' },
    })
    if (authError) throw authError
    linkedAuthUserId = authUser.user.id
    created.authUserIds.push(linkedAuthUserId)
  }

  const { data: person, error: personError } = await admin
    .from('people')
    .insert({
      tenant_id: HEADLINER_TENANT_ID,
      first_name: 'Alyssa',
      last_name: 'Abbott',
      email,
      custom_fields: { staff_status: 'active' },
    })
    .select('id')
    .single()
  if (personError) throw personError
  created.personIds.push(person.id)

  const { data: instructor, error: instructorError } = await admin
    .from('instructors')
    .insert({ tenant_id: HEADLINER_TENANT_ID, person_id: person.id })
    .select('id')
    .single()
  if (instructorError) throw instructorError
  created.instructorIds.push(instructor.id)

  const { data: membership, error: membershipError } = await admin
    .from('tenant_memberships')
    .insert({
      tenant_id: HEADLINER_TENANT_ID,
      person_id: person.id,
      auth_user_id: linkedAuthUserId,
      role_id: adminRole.id,
      status,
      legacy_access_enabled: status !== 'active',
      invited_at: status === 'invited' ? new Date().toISOString() : null,
      activated_at: status === 'active' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (membershipError) throw membershipError
  created.membershipIds.push(membership.id)

  return { person, instructor, membership, authUserId: linkedAuthUserId }
}

const preflightAuthUserId = randomUUID()
const { error: activationPreflightError } = await admin.rpc('odeon_activate_membership_claim', {
  p_auth_user_id: preflightAuthUserId,
  p_email: `preflight-${preflightAuthUserId}@mailinator.com`,
  p_email_verified_at: null,
})
if (activationPreflightError?.code === 'PGRST202' || activationPreflightError?.message?.includes('Could not find the function')) {
  throw new Error('Migration 015 is not applied: public.odeon_activate_membership_claim is unavailable. No verification fixtures were created.')
}
if (activationPreflightError && !activationPreflightError.message.includes('No invited staff membership')) {
  throw activationPreflightError
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const email = `pulse-claim-${suffix}@mailinator.com`
const initialPassword = `Initial-${suffix}-A9!`
const claimedPassword = `Claimed-${suffix}-B8!`
const otherEmail = `pulse-claim-other-${suffix}@mailinator.com`
const otherPassword = `Other-${suffix}-C7!`
const conflictEmail = `pulse-claim-conflict-${suffix}@mailinator.com`
const sharedCode = process.env.PULSE_SYSTEM_PASSWORD || '1478'

try {
  const primary = await createStaffFixture({ email })

  let result = await request('/api/access/teachers')
  assert(result.status === 200 && Array.isArray(result.body), `Teacher list expected 200; received ${result.status}.`)
  const publicTeacher = result.body.find(teacher => teacher.instructorId === primary.instructor.id)
  assert(publicTeacher?.accountClaimed === false, 'Unclaimed fixture must appear without a claimed checkmark.')
  assert(Object.keys(publicTeacher).sort().join(',') === 'accountClaimed,displayName,instructorId', 'Public teacher payload exposed unexpected fields.')

  result = await request('/api/access/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructorId: primary.instructor.id, password: sharedCode }),
  })
  assert(result.status === 200 && result.body?.authSource === 'legacy', `Unified shared-code login expected 200; received ${result.status}: ${result.body?.error || ''}`)
  const legacyCookie = result.cookies
  assert(legacyCookie.includes('pulse_access='), 'Shared-code login must issue a legacy access cookie.')

  result = await request('/api/account/claim-reminder', { headers: { Cookie: legacyCookie } })
  assert(result.status === 200 && result.body?.show === true, `Claim reminder expected show=true; received ${result.status}.`)
  assert(result.body?.maskedEmail && !JSON.stringify(result.body).includes(email), 'Claim reminder must expose only a masked stored email.')

  result = await request('/api/account/claim-reminder', {
    method: 'POST',
    headers: { Cookie: legacyCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dismiss' }),
  })
  assert(result.status === 200 && result.cookies.includes('pulse_claim_prompt_dismissed='), `Reminder dismissal expected 200; received ${result.status}.`)
  const dismissedCookie = combineCookies(legacyCookie, result.cookies)
  result = await request('/api/account/claim-reminder', { headers: { Cookie: dismissedCookie } })
  assert(result.status === 200 && result.body?.show === false, 'Dismissal must hide the reminder for the current legacy session.')

  await new Promise(resolve => setTimeout(resolve, 5))
  result = await request('/api/access/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: dismissedCookie },
    body: JSON.stringify({ instructorId: primary.instructor.id, password: sharedCode }),
  })
  assert(result.status === 200, `Second shared-code login expected 200; received ${result.status}.`)
  const freshLegacyCookie = result.cookies
  result = await request('/api/account/claim-reminder', { headers: { Cookie: freshLegacyCookie } })
  assert(result.status === 200 && result.body?.show === true, 'A new shared-code login must show the reminder again.')

  result = await request('/api/account/claim-reminder', {
    method: 'POST',
    headers: { Cookie: freshLegacyCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', email: 'attacker@mailinator.com' }),
  })
  assert(result.status === 200 && result.body?.status === 'invited', `Self setup email expected invited/200; received ${result.status}: ${result.body?.error || ''}`)

  const { data: invited, error: invitedError } = await admin
    .from('tenant_memberships')
    .select('status, auth_user_id, legacy_access_enabled')
    .eq('id', primary.membership.id)
    .single()
  if (invitedError) throw invitedError
  assert(invited.status === 'invited' && invited.auth_user_id, 'Self setup must link an invited Auth user.')
  assert(invited.legacy_access_enabled === true, 'Sending setup email must preserve legacy access until activation.')
  created.authUserIds.push(invited.auth_user_id)

  const { data: invitedAuth, error: invitedAuthError } = await admin.auth.admin.getUserById(invited.auth_user_id)
  if (invitedAuthError) throw invitedAuthError
  assert(invitedAuth.user.email?.toLowerCase() === email, 'Self setup must use the stored staff email, not client input.')
  const { error: passwordError } = await admin.auth.admin.updateUserById(invited.auth_user_id, { password: initialPassword, email_confirm: true })
  if (passwordError) throw passwordError

  await createStaffFixture({ email: otherEmail, status: 'active', password: otherPassword })
  result = await request('/api/access/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructorId: primary.instructor.id, password: otherPassword }),
  })
  assert(result.status === 401, `Wrong-person password expected 401; received ${result.status}.`)

  const { data: conflictAuth, error: conflictAuthError } = await admin.auth.admin.createUser({
    email: conflictEmail,
    password: `Conflict-${suffix}-D6!`,
    email_confirm: true,
  })
  if (conflictAuthError) throw conflictAuthError
  created.authUserIds.push(conflictAuth.user.id)
  const conflict = await createStaffFixture({ email: conflictEmail })
  const conflictLegacyCookie = createLegacyCookie({
    instructorId: conflict.instructor.id,
    personId: conflict.person.id,
    fullName: `Claim Verifier Conflict ${suffix}`,
    displayName: 'Claim V.',
    access: { kind: 'headliner' },
  })
  result = await request('/api/account/claim-reminder', {
    method: 'POST',
    headers: { Cookie: conflictLegacyCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send' }),
  })
  assert(result.status === 409, `Unlinked Auth email conflict expected 409; received ${result.status}.`)

  const invitedCookie = await sessionCookie(email, initialPassword)
  result = await request('/api/account/claim', { headers: { Cookie: invitedCookie } })
  assert(result.status === 200 && result.body?.status === 'invited', `Claim context expected invited/200; received ${result.status}: ${result.body?.error || ''}`)
  result = await request('/api/account/claim', {
    method: 'POST',
    headers: { Cookie: invitedCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: claimedPassword }),
  })
  assert(result.status === 200, `Claim activation expected 200; received ${result.status}: ${result.body?.error || ''}`)
  assert(result.body?.tenantId === HEADLINER_TENANT_ID, 'Claim activation must return the authorized tenant.')
  const claimedCookie = combineCookies(invitedCookie, result.cookies)
  assert(claimedCookie && !/(^|;\s*)pulse_access=[^;]/.test(claimedCookie), 'Claim activation must establish a personal session without legacy access.')

  result = await request(`/api/account/me?tenant=${HEADLINER_TENANT_ID}`, { headers: { Cookie: claimedCookie } })
  assert(result.status === 200 && result.body?.canUpdateCredentials === true, `Immediate post-claim account access expected 200; received ${result.status}: ${result.body?.error || ''}`)
  result = await request('/api/leads?include_counts=1', { headers: { Cookie: claimedCookie } })
  assert(result.status === 200, `Immediate post-claim leads access expected 200; received ${result.status}: ${result.body?.error || ''}`)
  result = await request(`/api/insights?tenant=${HEADLINER_TENANT_ID}`, { headers: { Cookie: claimedCookie } })
  assert(result.status === 200, `Immediate post-claim insights access expected 200; received ${result.status}: ${result.body?.error || ''}`)
  result = await request('/api/notes', { headers: { Cookie: claimedCookie } })
  assert(result.status === 200, `Immediate post-claim notes access expected 200; received ${result.status}: ${result.body?.error || ''}`)
  result = await request('/api/leads?tenant=00000000-0000-0000-0000-000000000002', { headers: { Cookie: claimedCookie } })
  assert(result.status === 403, `Stale cross-tenant post-claim request expected 403; received ${result.status}.`)

  const { data: activated, error: activatedError } = await admin
    .from('tenant_memberships')
    .select('status, auth_user_id, legacy_access_enabled, activated_at')
    .eq('id', primary.membership.id)
    .single()
  if (activatedError) throw activatedError
  assert(activated.status === 'active', 'Claimed membership must be active.')
  assert(activated.auth_user_id === invited.auth_user_id, 'Claimed membership must remain linked to the invited Auth user.')
  assert(activated.legacy_access_enabled === false, 'Claiming must disable legacy access for that membership.')
  assert(Boolean(activated.activated_at), 'Claiming must record activated_at.')

  result = await request('/api/access/teachers')
  const claimedTeacher = result.body?.find(teacher => teacher.instructorId === primary.instructor.id)
  assert(claimedTeacher?.accountClaimed === true, 'Activated fixture must appear with a claimed checkmark.')

  result = await request('/api/access/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructorId: primary.instructor.id, password: claimedPassword }),
  })
  assert(result.status === 200 && result.body?.authSource === 'personal', `Unified personal login expected 200; received ${result.status}: ${result.body?.error || ''}`)
  const personalCookie = result.cookies
  assert(personalCookie && !/(^|;\s*)pulse_access=[^;]/.test(personalCookie), 'Personal login must not issue a non-empty legacy access session.')

  result = await request(`/api/account/me?tenant=${HEADLINER_TENANT_ID}`, { headers: { Cookie: personalCookie } })
  assert(result.status === 200 && result.body?.canUpdateCredentials === true, `Claimed password session expected active account access; received ${result.status}.`)
  result = await request('/api/account/me?tenant=00000000-0000-0000-0000-000000000002', { headers: { Cookie: personalCookie } })
  assert(result.status === 403, `Cross-tenant personal request expected 403; received ${result.status}.`)
  result = await request(`/api/account/access?tenant=${HEADLINER_TENANT_ID}`, { headers: { Cookie: freshLegacyCookie } })
  assert(result.status === 401, `Legacy-only access after claim expected 401; received ${result.status}.`)

  const { data: auditEvents, error: auditError } = await admin
    .from('account_audit_events')
    .select('id, event_type')
    .eq('target_membership_id', primary.membership.id)
  if (auditError) throw auditError
  assert(auditEvents.filter(event => event.event_type === 'membership.claimed').length === 1, 'Expected one membership.claimed event.')
  assert(auditEvents.some(event => event.event_type === 'membership.invited'), 'Expected a self-service membership.invited event.')

  const { error: suspendError } = await admin
    .from('tenant_memberships')
    .update({ status: 'suspended', suspended_at: new Date().toISOString() })
    .eq('id', primary.membership.id)
  if (suspendError) throw suspendError
  result = await request(`/api/account/me?tenant=${HEADLINER_TENANT_ID}`, { headers: { Cookie: personalCookie } })
  assert(result.status === 401, `Suspended personal membership expected middleware rejection; received ${result.status}.`)
  result = await request('/api/access/teachers')
  assert(!result.body?.some(teacher => teacher.instructorId === primary.instructor.id), 'Suspended membership must be hidden from the public teacher list.')

  console.log(`PASS: unified shared-code and personal login flows completed against ${BASE_URL}.`)
  console.log('PASS: safe dropdown state, reminder masking/dismissal, self-invite, wrong-name rejection, email conflict, immediate dashboard API access, activation, and cleanup checks passed.')
} finally {
  if (created.membershipIds.length) {
    const { error } = await admin.from('tenant_memberships').delete().in('id', created.membershipIds)
    if (error) throw error
  }
  if (created.instructorIds.length) {
    const { error } = await admin.from('instructors').delete().in('id', created.instructorIds)
    if (error) throw error
  }
  if (created.personIds.length) {
    const { error } = await admin.from('people').delete().in('id', created.personIds)
    if (error) throw error
  }
  for (const authUserId of [...new Set(created.authUserIds)].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(authUserId)
    if (error) throw error
  }
}