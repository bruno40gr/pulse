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
  .select('id, tenant_id, first_name, last_name, email, custom_fields')
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

// Record the old name as an alias so future roster imports keep resolving this
// person under their old label ("Andrew Dylan Johnson") instead of re-creating
// a duplicate because the name no longer matches.
const oldFirst = (person.first_name || '').trim().toLowerCase()
const oldLastTokens = (person.last_name || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
const oldLastToken = oldLastTokens[oldLastTokens.length - 1] || ''
const oldFull = `${person.first_name || ''} ${person.last_name || ''}`.trim().toLowerCase()
const oldAliases = [oldFull]
if (oldFirst && oldLastToken && `${oldFirst} ${oldLastToken}` !== oldFull) {
  oldAliases.push(`${oldFirst} ${oldLastToken}`)
}
const existingAliases = Array.isArray(person.custom_fields?.name_aliases)
  ? person.custom_fields.name_aliases.filter((a) => typeof a === 'string')
  : []
const nameAliases = [...new Set([...existingAliases, ...oldAliases])]
const customFields = { ...(person.custom_fields || {}), name_aliases: nameAliases }

const { error: updateError } = await supabase
  .from('people')
  .update({ first_name: firstName, last_name: lastName, custom_fields: customFields })
  .eq('id', personId)

if (updateError) { console.error('update error:', updateError.message); process.exit(1) }
console.log(`  aliases kept: ${JSON.stringify(nameAliases)}`)
console.log('\nDone.')
