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

function normalizeName(name) {
  if (!name) return null
  const t = String(name).trim()
  if (!t || t === '-' || t === '—') return null
  return t
}

function splitName(name) {
  const parts = name.trim().split(/\s+/)
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || parts[0] }
}

async function resolveInstructor(tenantId, name) {
  const normalized = normalizeName(name)
  if (!normalized) return null
  const { first_name, last_name } = splitName(normalized)

  let { data: person } = await supabase.from('people').select('id')
    .eq('tenant_id', tenantId).ilike('first_name', first_name).ilike('last_name', last_name)
    .limit(1).single()

  if (!person) {
    const { data: np, error } = await supabase.from('people')
      .insert({ tenant_id: tenantId, first_name, last_name, custom_fields: {} })
      .select('id').single()
    if (error) { console.log(`person error for ${normalized}:`, error.message); return null }
    person = np
  }

  let { data: instructor } = await supabase.from('instructors').select('id')
    .eq('tenant_id', tenantId).eq('person_id', person.id).maybeSingle()

  if (!instructor) {
    const { data: ni, error } = await supabase.from('instructors')
      .insert({ tenant_id: tenantId, person_id: person.id }).select('id').single()
    if (error) { console.log(`instructor error for ${normalized}:`, error.message); return null }
    instructor = ni
  }

  return { person_id: person.id, instructor_id: instructor.id, name: normalized }
}

// Backfill all tenants (Headliner + demo tenants)
const { data: enrollments, error } = await supabase.from('enrollments')
  .select('id, tenant_id, instructor_person_id, custom_fields')

if (error) { console.log('fetch error:', error.message); process.exit(1) }

const namesByTenant = new Map()
const toLink = []

for (const e of enrollments) {
  const name = normalizeName(e.custom_fields?.instructor)
  if (!name) continue
  if (e.instructor_person_id) continue
  toLink.push({ id: e.id, tenant_id: e.tenant_id, name })
  if (!namesByTenant.has(e.tenant_id)) namesByTenant.set(e.tenant_id, new Set())
  namesByTenant.get(e.tenant_id).add(name.toLowerCase())
}

const personIdByNameByTenant = new Map()
for (const [tenantId, names] of namesByTenant) {
  const map = new Map()
  for (const name of names) {
    const resolved = await resolveInstructor(tenantId, name)
    if (resolved) map.set(name, resolved.person_id)
    else console.log(`tenant ${tenantId}: could not resolve "${name}"`)
  }
  personIdByNameByTenant.set(tenantId, map)
}

let linked = 0
let skipped = 0
for (const e of toLink) {
  const map = personIdByNameByTenant.get(e.tenant_id)
  const personId = map?.get(e.name.toLowerCase())
  if (!personId) { skipped++; continue }
  const { error: ue } = await supabase.from('enrollments')
    .update({ instructor_person_id: personId }).eq('id', e.id)
  if (ue) console.log(`link error ${e.id}:`, ue.message)
  else linked++
}

console.log(`Linked ${linked} enrollments (${skipped} skipped)`)
console.log('done')