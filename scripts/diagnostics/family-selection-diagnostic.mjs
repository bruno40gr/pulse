// Read-only diagnostic: why does a Contacts family show checkboxes on children
// instead of the account holder? Prints metadata only (no phone/email values).
//
//   node scripts/diagnostics/family-selection-diagnostic.mjs
//
// Uses .env.local service credentials exactly like scripts/migrations/*.mjs.
// Writes nothing. Prints at most 6 families plus a summary.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

let envFile = ''
try { envFile = readFileSync('.env.local', 'utf8') } catch {
  console.error('No .env.local in this directory. Run this from the repository root.')
  process.exit(1)
}
const env = {}
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('.env.local is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const TENANT_ID = env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'

const { data: people, error } = await supabase.from('people')
  .select('id,first_name,last_name,students(id,account_id,is_minor,message_routing,accounts(id,name))')
  .eq('tenant_id', TENANT_ID)
if (error) { console.error('people read failed:', error.message); process.exit(1) }

// Does the relation the app relies on exist, and does it hold rows?
let holderRows = [], holderError = ''
{
  const { data, error } = await supabase.from('account_holders').select('account_id,person_id').eq('tenant_id', TENANT_ID).limit(2000)
  if (error) holderError = `${error.code || ''} ${error.message}`.trim()
  else holderRows = data || []
}

const personIds = new Set(people.map(p => p.id))
const byAccount = new Map()
for (const person of people) {
  const accountId = person.students?.[0]?.account_id
  if (!accountId) continue
  if (!byAccount.has(accountId)) byAccount.set(accountId, [])
  byAccount.get(accountId).push(person)
}
const holdersByAccount = new Map()
for (const row of holderRows) {
  if (!holdersByAccount.has(row.account_id)) holdersByAccount.set(row.account_id, new Set())
  holdersByAccount.get(row.account_id).add(row.person_id)
}

console.log(`tenant ${TENANT_ID}`)
console.log(`people: ${people.length}`)
console.log(`account_holders: ${holderError ? `UNREADABLE (${holderError})` : `${holderRows.length} rows`}`)
console.log(`families (accounts with people): ${byAccount.size}`)
console.log('')

let resolvable = 0, unlinked = 0
const families = [...byAccount.entries()].filter(([, members]) => members.length > 1)
for (const [index, [accountId, members]] of families.entries()) {
  const holderIds = new Set(holdersByAccount.get(accountId) || [])
  const explicit = members.filter(m => holderIds.has(m.id))
  const linked = members.filter(m => m.students?.[0] && m.id === holderIds.values().next().value)
  const anyHolder = explicit.length > 0 || linked.length > 0
  if (anyHolder) resolvable++
  else unlinked++
  if (index >= 6) continue
  console.log(`account ${accountId} · ${members.length} people · account_holders ${holderIds.size ? `[${[...holderIds].map(id => personIds.has(id) ? 'person-ok' : 'NOT-IN-PEOPLE').join(',')}]` : 'none'}`)
  for (const m of members) {
    const student = m.students?.[0] || {}
    const isHolder = holderIds.has(m.id)
    console.log(`  ${isHolder ? 'HOLDER' : '      '} ${m.first_name} ${m.last_name}`.padEnd(34)
      + ` is_minor=${student.is_minor} routing=${student.message_routing ?? 'null'}`
      + ` account_id=${student.account_id ? 'set' : 'null'}${student.accounts?.name ? ' account-name=set' : ' account-name=null'}`)
  }
}
console.log('')
console.log(`families with a resolvable account-holder row: ${resolvable}`)
console.log(`families WITHOUT one (children-only → children become the only selectable rows): ${unlinked}`)
