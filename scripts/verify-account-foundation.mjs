import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const EXPECTED_PERMISSION_KEYS = [
  'accounts.manage',
  'roles.manage',
  'staff.read',
  'staff.manage',
  'contacts.read',
  'contacts.manage',
  'contacts.delete',
  'leads.read',
  'leads.manage',
  'leads.delete',
  'notes.read',
  'notes.manage',
  'communications.read',
  'communications.send',
  'communications.configure',
  'tenant_settings.read',
  'tenant_settings.manage',
  'audit.read',
  'data_migrations.run',
]

function loadEnvironment() {
  const environment = { ...process.env }
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match) environment[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // Environment variables may be provided directly outside local development.
  }
  return environment
}

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

function fullName(person) {
  return `${person?.first_name || ''} ${person?.last_name || ''}`.trim()
}

const environment = loadEnvironment()
if (!environment.NEXT_PUBLIC_SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) {
  fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit()
}

const supabase = createClient(
  environment.NEXT_PUBLIC_SUPABASE_URL,
  environment.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function requiredQuery(label, query) {
  const result = await query
  if (result.error) {
    if (result.error.code === 'PGRST205') {
      fail(`${label} is unavailable. Apply scripts/migration-011-account-foundation.sql first.`)
    } else {
      fail(`${label}: ${result.error.message}`)
    }
    return null
  }
  return result.data
}

const permissions = await requiredQuery(
  'permissions',
  supabase.from('permissions').select('id, key').order('key'),
)
const roles = await requiredQuery(
  'roles',
  supabase.from('roles').select('id, key, name').eq('tenant_id', HEADLINER_TENANT_ID),
)
const memberships = await requiredQuery(
  'tenant_memberships',
  supabase
    .from('tenant_memberships')
    .select('id, person_id, role_id, status, auth_user_id, legacy_access_enabled')
    .eq('tenant_id', HEADLINER_TENANT_ID),
)
const accountSettings = await requiredQuery(
  'tenant_account_settings',
  supabase.from('tenant_account_settings').select('*').eq('tenant_id', HEADLINER_TENANT_ID).maybeSingle(),
)

if (!permissions || !roles || !memberships || !accountSettings) process.exit()

const permissionKeys = new Set(permissions.map(permission => permission.key))
const missingPermissionKeys = EXPECTED_PERMISSION_KEYS.filter(key => !permissionKeys.has(key))
if (missingPermissionKeys.length) fail(`Missing permission keys: ${missingPermissionKeys.join(', ')}`)
else pass(`All ${EXPECTED_PERMISSION_KEYS.length} expected permission keys exist.`)

const ownerRole = roles.find(role => role.key === 'owner')
const adminRole = roles.find(role => role.key === 'admin')
if (!ownerRole) fail('Headliner Owner role is missing.')
else pass('Headliner Owner role exists.')
if (!adminRole) fail('Headliner Admin role is missing.')
else pass('Headliner Admin role exists.')

if (ownerRole && adminRole) {
  const mappings = await requiredQuery(
    'role_permissions',
    supabase.from('role_permissions').select('role_id, permission_id').in('role_id', [ownerRole.id, adminRole.id]),
  )
  if (mappings) {
    const ownerPermissionIds = new Set(mappings.filter(mapping => mapping.role_id === ownerRole.id).map(mapping => mapping.permission_id))
    const adminPermissionIds = new Set(mappings.filter(mapping => mapping.role_id === adminRole.id).map(mapping => mapping.permission_id))
    const expectedPermissionIds = new Set(permissions.map(permission => permission.id))
    const hasAll = permissionIds => expectedPermissionIds.size === permissionIds.size
      && [...expectedPermissionIds].every(permissionId => permissionIds.has(permissionId))
    if (!hasAll(ownerPermissionIds)) fail('Owner does not have every seeded permission.')
    else pass('Owner has every seeded permission.')
    if (!hasAll(adminPermissionIds)) fail('Admin does not have every seeded permission.')
    else pass('Admin has every seeded permission.')
  }
}

const personIds = memberships.map(membership => membership.person_id)
const people = personIds.length
  ? await requiredQuery(
      'membership people',
      supabase.from('people').select('id, first_name, last_name, email, custom_fields').in('id', personIds),
    )
  : []

if (people) {
  const peopleById = new Map(people.map(person => [person.id, person]))
  const rolesById = new Map(roles.map(role => [role.id, role]))
  const membershipSummaries = memberships
    .map(membership => ({
      name: fullName(peopleById.get(membership.person_id)),
      role: rolesById.get(membership.role_id)?.key || 'unknown',
      status: membership.status,
      authUserLinked: Boolean(membership.auth_user_id),
      legacyAccess: membership.legacy_access_enabled,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const plannedStaffNames = ['Mae Strider', 'Alex Bird']
  const plannedMemberships = membershipSummaries.filter(item => plannedStaffNames.includes(item.name))
  if (![16, 18].includes(membershipSummaries.length)) {
    fail(`Expected 16 core memberships before Migration 014 or 18 after it; found ${membershipSummaries.length}.`)
  } else if (plannedMemberships.length === 1) {
    fail('Migration 014 is partially applied: Mae Strider and Alex Bird must be added together.')
  } else if (membershipSummaries.length === 18 && plannedMemberships.length !== 2) {
    fail('The 18-member roster does not include both Mae Strider and Alex Bird.')
  } else if (membershipSummaries.length === 16) {
    pass('All 16 core staff memberships exist; Migration 014 is not yet applied.')
  } else {
    pass('All 18 planned staff memberships exist, including Mae Strider and Alex Bird.')
  }

  for (const ownerName of ['Bruno Wong', 'Lorena Rudha']) {
    const membership = membershipSummaries.find(item => item.name.toLowerCase() === ownerName.toLowerCase())
    if (!membership) fail(`${ownerName} does not have a membership.`)
    else if (membership.role !== 'owner') fail(`${ownerName} is assigned ${membership.role}, not Owner.`)
    else pass(`${ownerName} is an Owner.`)
  }

  const unexpectedRoles = membershipSummaries.filter(item => !['Bruno Wong', 'Lorena Rudha'].some(name => name.toLowerCase() === item.name.toLowerCase()) && item.role !== 'admin')
  if (unexpectedRoles.length) fail(`Non-owner staff without Admin: ${unexpectedRoles.map(item => `${item.name} (${item.role})`).join(', ')}`)
  else pass('Every other active staff member is an Admin.')

  const invalidPreClaimStates = membershipSummaries.filter(item => !['unclaimed', 'invited'].includes(item.status))
  if (invalidPreClaimStates.length) {
    fail(`Pre-seeded memberships must remain pre-claim: ${invalidPreClaimStates.map(item => `${item.name} (${item.status})`).join(', ')}`)
  } else {
    pass('All pre-seeded memberships remain unclaimed or invited.')
  }
}

if (accountSettings.migration_enabled !== false) fail('Migration mode must remain disabled.')
else pass('Migration mode is disabled.')
if (accountSettings.transition_starts_at !== null || accountSettings.legacy_access_ends_at !== null) fail('Rollout timestamps must remain unset.')
else pass('Rollout timestamps are unset.')
if (accountSettings.allow_emergency_legacy_override !== false) fail('Emergency legacy override must remain disabled.')
else pass('Emergency legacy override is disabled.')
if (accountSettings.require_email_verification !== false) fail('Email verification should not be required under the initial policy.')
else pass('Email verification is not required.')
if (accountSettings.allow_admin_invitations !== true) fail('Admin invitations should be enabled.')
else pass('Admin invitations are enabled.')

if (process.exitCode) {
  console.error('\nAccount foundation verification failed.')
} else {
  console.log('\nAccount foundation verification passed.')
}