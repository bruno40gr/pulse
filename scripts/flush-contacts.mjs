import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

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
const TABLES = ['messages', 'campaigns', 'enrollments', 'students', 'instructors', 'accounts', 'people', 'contacts', 'tenant_fields']

console.log('Tenant:', TENANT_ID)
console.log('Mode:', APPLY ? 'APPLY (deleting)' : 'DRY RUN (no changes)')

let total = 0
for (const table of TABLES) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID)
  if (error) { console.log(`  ${table}: ERROR ${error.message}`); continue }
  console.log(`  ${table}: ${count ?? 0} rows`)
  total += count ?? 0
}

if (!APPLY) {
  console.log(`\nWould delete ${total} rows across ${TABLES.length} tables. Re-run with --apply to delete.`)
  process.exit(0)
}

for (const table of TABLES) {
  const { error } = await supabase.from(table).delete().eq('tenant_id', TENANT_ID)
  if (error) console.log(`  ${table}: FAILED ${error.message}`)
  else console.log(`  ${table}: deleted`)
}
console.log('\nDone.')
