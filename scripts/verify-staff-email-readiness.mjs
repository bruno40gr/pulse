import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const EXPECTED_EMAILS = [
  ['Alyssa Abbott', 'aaabbott1@hotmail.com'],
  ['Josh Brent', 'jrpbrent@gmail.com'],
  ['Noah Campos', 'camposdnoah@gmail.com'],
  ['Collin Franks', 'collin.m.franks@gmail.com'],
  ['Scott Gaona', 'sgaona402@gmail.com'],
  ['David James', 'davidvjames@gmail.com'],
  ['Lorena Rudha', 'lorena@headlinermusicacademy.com'],
  ['Marshall James-Solano', 'applepiie747@gmail.com'],
  ['Mae Strider', 'naadams2006@gmail.com', 'supplied as Mae Adams', true],
  ['Mel Solano-Rojas', 'b2rrocklin@gmail.com'],
  ['Drew Johnson', 'andrew.john1228@gmail.com', 'supplied as Andrew Johnson'],
  ['Isaias Pallib', 'luciejoy42@gmail.com'],
  ['Cohen Roden', 'james_c_drone@hotmail.com'],
  ['Jacob Rogelstad', 'jrogelstad@att.net'],
  ['Jessica Suase', 'jjdaniellemateo@gmail.com'],
  ['Vitto Trinchese', 'vittoriotrinchese96@gmail.com'],
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

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function fullName(person) {
  return `${person?.first_name || ''} ${person?.last_name || ''}`.trim()
}

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

function pass(message) {
  console.log(`PASS: ${message}`)
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

const { data: memberships, error: membershipsError } = await supabase
  .from('tenant_memberships')
  .select('id, person_id, status, auth_user_id')
  .eq('tenant_id', HEADLINER_TENANT_ID)
  .in('status', ['unclaimed', 'invited', 'active'])

if (membershipsError) {
  fail(`Could not load active memberships: ${membershipsError.message}`)
  process.exit()
}

const personIds = memberships.map(membership => membership.person_id)
const { data: people, error: peopleError } = await supabase
  .from('people')
  .select('id, first_name, last_name, email')
  .in('id', personIds)

if (peopleError) {
  fail(`Could not load membership people: ${peopleError.message}`)
  process.exit()
}

const peopleByName = new Map(people.map(person => [normalize(fullName(person)), person]))
for (const [name, email, note, pendingMigration] of EXPECTED_EMAILS) {
  const person = peopleByName.get(normalize(name))
  const label = note ? `${name} (${note})` : name
  if (!person && pendingMigration) pass(`${label} is reconciled but not eligible until Migration 014 is applied.`)
  else if (!person) fail(`${label} does not match an eligible Headliner membership.`)
  else if (normalize(person.email) !== normalize(email)) fail(`${label} does not have the verified email.`)
  else pass(`${label} has the verified email.`)
}

const emailGroups = new Map()
for (const person of people) {
  const email = normalize(person.email)
  if (!email) continue
  emailGroups.set(email, [...(emailGroups.get(email) || []), fullName(person)])
}
const duplicateGroups = [...emailGroups].filter(([, names]) => names.length > 1)
if (duplicateGroups.length) {
  fail(`Duplicate active staff emails: ${duplicateGroups.map(([email, names]) => `${email} (${names.join(', ')})`).join('; ')}`)
} else {
  pass('Active staff emails are unique.')
}

let page = 1
const authUsers = []
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) {
    fail(`Could not inspect Supabase Auth users: ${error.message}`)
    break
  }
  authUsers.push(...data.users)
  if (data.users.length < 1000) break
  page += 1
}

const expectedEmails = new Set(EXPECTED_EMAILS.map(([, email]) => normalize(email)))
const authConflicts = authUsers.filter(user => expectedEmails.has(normalize(user.email)))
if (authConflicts.length) {
  fail(`${authConflicts.length} verified staff emails already belong to unlinked Supabase Auth users.`)
} else {
  pass('Verified staff emails do not conflict with existing Supabase Auth users.')
}

const missingPeople = people.filter(person => !normalize(person.email)).map(fullName).sort()
if (missingPeople.length) {
  fail(`Eligible staff still missing email: ${missingPeople.join(', ')}`)
} else {
  pass('Every eligible Headliner staff membership has an email.')
}

if (process.exitCode) {
  console.error('\nStaff email readiness verification failed.')
} else {
  console.log('\nStaff email readiness verification passed.')
}