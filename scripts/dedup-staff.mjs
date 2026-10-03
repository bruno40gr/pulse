import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local (mirrors scripts/dedup-contacts.mjs)
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_ID = process.env.TENANT || '00000000-0000-0000-0000-000000000001'
const APPLY = process.argv.includes('--apply')

// A staff duplicate is two `instructors` rows pointing at two `people` rows for the
// same human. Import tools write the middle name into `last_name` ("Dylan Johnson",
// "David Campos"), so group on first name + the final token of the last name.
function staffKey(person) {
  const first = (person?.first_name || '').trim().toLowerCase()
  const lastTokens = (person?.last_name || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const last = lastTokens[lastTokens.length - 1] || ''
  if (!first || !last) return null
  return `${first}|${last}`
}

function rank(membership, enrollmentCount) {
  // Highest wins. An account that can actually sign in must never be the one deleted.
  let score = 0
  if (membership) score += 100
  if (membership?.auth_user_id) score += 1000
  if (membership?.status === 'active') score += 500
  if (membership?.legacy_access_enabled) score += 50
  return score + Math.min(enrollmentCount, 49)
}

const { data: instructors, error: instructorError } = await supabase
  .from('instructors')
  .select('id, person_id, person:people(id, first_name, last_name, email, phone, date_of_birth, custom_fields)')
  .eq('tenant_id', TENANT_ID)

if (instructorError) { console.error('fetch instructors error:', instructorError.message); process.exit(1) }

const { data: memberships, error: membershipError } = await supabase
  .from('tenant_memberships')
  .select('id, person_id, status, auth_user_id, legacy_access_enabled')
  .eq('tenant_id', TENANT_ID)

if (membershipError) { console.error('fetch memberships error:', membershipError.message); process.exit(1) }

const { data: enrollments, error: enrollmentError } = await supabase
  .from('enrollments')
  .select('id, instructor_person_id')
  .eq('tenant_id', TENANT_ID)

if (enrollmentError) { console.error('fetch enrollments error:', enrollmentError.message); process.exit(1) }

const membershipByPerson = new Map((memberships || []).map((m) => [m.person_id, m]))
const enrollmentCountByPerson = new Map()
for (const e of enrollments || []) {
  if (!e.instructor_person_id) continue
  enrollmentCountByPerson.set(e.instructor_person_id, (enrollmentCountByPerson.get(e.instructor_person_id) || 0) + 1)
}

const groups = new Map()
for (const row of instructors || []) {
  const person = Array.isArray(row.person) ? row.person[0] : row.person
  if (!person) continue
  const key = staffKey(person)
  if (!key) continue
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push({
    instructorId: row.id,
    personId: row.person_id,
    person,
    membership: membershipByPerson.get(row.person_id) || null,
    enrollmentCount: enrollmentCountByPerson.get(row.person_id) || 0,
  })
}

const duplicateGroups = [...groups.entries()].filter(([, members]) => members.length > 1)

console.log(`Tenant: ${TENANT_ID}`)
console.log(`Instructors: ${(instructors || []).length}   duplicate name groups: ${duplicateGroups.length}`)
console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no changes)'}\n`)

let merged = 0
let skipped = 0

for (const [key, members] of duplicateGroups) {
  members.sort((a, b) => rank(b.membership, b.enrollmentCount) - rank(a.membership, a.enrollmentCount))
  const canonical = members[0]
  const dups = members.slice(1)

  const name = `${canonical.person.first_name || ''} ${canonical.person.last_name || ''}`.trim()
  console.log(`${name}  (${key})`)
  console.log(`  KEEP  person ${canonical.personId}  instructor ${canonical.instructorId}  lessons=${canonical.enrollmentCount}  membership=${canonical.membership ? canonical.membership.status : 'none'}${canonical.membership?.auth_user_id ? ' (claimed)' : ''}`)

  for (const dup of dups) {
    console.log(`  MERGE person ${dup.personId}  instructor ${dup.instructorId}  lessons=${dup.enrollmentCount}  membership=${dup.membership ? dup.membership.status : 'none'}`)

    // Safety: a duplicate that owns an account identity must never be deleted.
    if (dup.membership) {
      console.log('    SKIP — duplicate still owns a tenant membership; resolve manually.')
      skipped++
      continue
    }

    const { data: studentRows } = await supabase.from('students').select('id').eq('person_id', dup.personId).limit(1)
    const { data: holderRows } = await supabase.from('account_holders').select('id').eq('person_id', dup.personId).limit(1)
    if ((studentRows || []).length > 0 || (holderRows || []).length > 0) {
      console.log('    SKIP — duplicate is referenced as a student or account holder.')
      skipped++
      continue
    }

    const { data: lessonRows } = await supabase
      .from('enrollments')
      .select('id')
      .eq('instructor_person_id', dup.personId)
    const lessonCount = (lessonRows || []).length

    if (!APPLY) {
      console.log(`    would move ${lessonCount} lesson(s) to ${canonical.personId}, then delete instructor + person.`)
      merged++
      continue
    }

    if (lessonCount > 0) {
      const { error: moveError } = await supabase
        .from('enrollments')
        .update({ instructor_person_id: canonical.personId })
        .eq('instructor_person_id', dup.personId)
      if (moveError) { console.log('    FAILED to move lessons:', moveError.message); skipped++; continue }
      console.log(`    moved ${lessonCount} lesson(s).`)
    }

    // Carry over any contact detail the surviving record is missing.
    const patch = {}
    for (const field of ['email', 'phone', 'date_of_birth']) {
      if (!canonical.person[field] && dup.person[field]) patch[field] = dup.person[field]
    }
    const canonicalFields = canonical.person.custom_fields || {}
    const dupFields = dup.person.custom_fields || {}
    const mergedFields = { ...dupFields, ...canonicalFields }
    if (JSON.stringify(mergedFields) !== JSON.stringify(canonicalFields)) patch.custom_fields = mergedFields
    if (Object.keys(patch).length > 0) {
      const { error: patchError } = await supabase.from('people').update(patch).eq('id', canonical.personId)
      if (patchError) { console.log('    FAILED to merge person fields:', patchError.message); skipped++; continue }
      Object.assign(canonical.person, patch)
      console.log(`    merged fields: ${Object.keys(patch).join(', ')}`)
    }

    const { error: instructorDeleteError } = await supabase.from('instructors').delete().eq('id', dup.instructorId)
    if (instructorDeleteError) { console.log('    FAILED to delete instructor:', instructorDeleteError.message); skipped++; continue }

    const { error: personDeleteError } = await supabase.from('people').delete().eq('id', dup.personId)
    if (personDeleteError) { console.log('    FAILED to delete person:', personDeleteError.message); skipped++; continue }

    merged++
  }
  console.log('')
}

if (!APPLY) {
  console.log(`Would merge ${merged} duplicate staff record(s); ${skipped} skipped.`)
  console.log('Re-run with --apply to write the changes.')
  process.exit(0)
}

console.log(`Done. merged=${merged} skipped/failed=${skipped}`)

