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

const APPLY = process.argv.includes('--apply')

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : null
}

const personId = arg('person')
const firstName = arg('first')
const lastName = arg('last')

if (!personId || !firstName || !lastName) {
  console.error('Usage: node scripts/rename-staff.mjs --person <uuid> --first <first> --last <last> [--apply]')
  process.exit(1)
}

const { data: person, error } = await supabase
  .from('people')
  .select('id, tenant_id, first_name, last_name, email')
  .eq('id', personId)
  .maybeSingle()

if (error) { console.error('fetch person error:', error.message); process.exit(1) }
if (!person) { console.error(`No person found for ${personId}`); process.exit(1) }

console.log(`Person ${person.id} (${person.email || 'no email'})`)
console.log(`  before: ${person.first_name} ${person.last_name}`)
console.log(`  after:  ${firstName} ${lastName}`)
console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no changes)'}`)

if (!APPLY) {
  console.log('\nRe-run with --apply to write the change.')
  process.exit(0)
}

const { error: updateError } = await supabase
  .from('people')
  .update({ first_name: firstName, last_name: lastName })
  .eq('id', personId)

if (updateError) { console.error('update error:', updateError.message); process.exit(1) }
console.log('\nDone.')
