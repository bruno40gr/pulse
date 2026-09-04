import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local (mirrors scripts/backfill-instructors.mjs)
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

function nameKey(p) {
  return `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase()
}

const { data: people, error } = await supabase
  .from('people')
  .select('id, first_name, last_name, updated_at, students(id, account_id, last_attended)')
  .eq('tenant_id', TENANT_ID)

if (error) { console.error('fetch people error:', error.message); process.exit(1) }

// Group by normalized full name
const groups = new Map()
for (const p of people || []) {
  const key = nameKey(p)
  if (!key) continue
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(p)
}

const duplicateGroups = [...groups.values()].filter((m) => m.length > 1)

// For each group, keep the newest record (by student last_attended, then updated_at)
const toDelete = []
for (const members of duplicateGroups) {
  members.sort((a, b) => {
    const al = a.students?.[0]?.last_attended || ''
    const bl = b.students?.[0]?.last_attended || ''
    if (al !== bl) return (bl > al ? 1 : -1)
    return new Date(b.updated_at) - new Date(a.updated_at)
  })
  const canonical = members[0]
  for (const dup of members.slice(1)) {
    toDelete.push({ name: `${canonical.first_name} ${canonical.last_name}`, keepId: canonical.id, deleteId: dup.id })
  }
}

console.log('Duplicate name groups:', duplicateGroups.length)
console.log('Records to delete:', toDelete.length)
console.log('Mode:', APPLY ? 'APPLY (deleting)' : 'DRY RUN (no changes)')
console.log('')
for (const d of toDelete) {
  console.log(`  ${d.name}: keep ${d.keepId}  delete ${d.deleteId}`)
}

if (!APPLY) {
  console.log('\nRe-run with --apply to delete. Tenant: ' + TENANT_ID)
  process.exit(0)
}

let deleted = 0
let skipped = 0
for (const d of toDelete) {
  const dupId = d.deleteId

  // Safety: never delete someone referenced as an instructor
  const { data: asInstructor } = await supabase.from('instructors').select('id').eq('person_id', dupId).limit(1)
  if (asInstructor && asInstructor.length > 0) { console.log('  SKIP (instructor):', d.name); skipped++; continue }

  const { data: students } = await supabase.from('students').select('id, account_id').eq('person_id', dupId)
  const studentIds = (students || []).map((s) => s.id)
  const accountIds = [...new Set((students || []).map((s) => s.account_id).filter(Boolean))]

  if (studentIds.length > 0) {
    await supabase.from('enrollments').delete().in('student_id', studentIds)
    try {
      await supabase.from('student_accounts').delete().in('student_id', studentIds)
    } catch {}
  }
  await supabase.from('students').delete().eq('person_id', dupId)

  // Only delete accounts that are now orphaned (not referenced by any other student)
  for (const accountId of accountIds) {
    const { data: others } = await supabase.from('students').select('id').eq('account_id', accountId).limit(1)
    if (!others || others.length === 0) {
      await supabase.from('accounts').delete().eq('id', accountId)
    }
  }

  const { error: delErr } = await supabase.from('people').delete().eq('id', dupId)
  if (delErr) { console.log('  FAILED:', d.name, delErr.message); skipped++ } else { deleted++ }
}

console.log(`\nDone. deleted=${deleted} skipped/failed=${skipped}`)
