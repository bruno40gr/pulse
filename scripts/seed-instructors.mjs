import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load env vars from .env.local (simple KEY=VALUE parser)
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEED_STAFF = [
  { tenant_id: '00000000-0000-0000-0000-000000000002', name: 'Sacramento Martial Arts', instructors: [
    { first_name: 'Daniel', last_name: 'Reyes' },
    { first_name: 'Alina', last_name: 'Garcia' },
    { first_name: 'Marcus', last_name: 'Chen' },
  ]},
  { tenant_id: '00000000-0000-0000-0000-000000000003', name: 'Kumon Learning Center', instructors: [
    { first_name: 'Hana', last_name: 'Tanaka' },
    { first_name: 'David', last_name: 'Kim' },
    { first_name: 'Mei', last_name: 'Nakamura' },
  ]},
]

for (const tenant of SEED_STAFF) {
  const seeded = []
  for (const inst of tenant.instructors) {
    let { data: person } = await supabase.from('people').select('id')
      .eq('tenant_id', tenant.tenant_id)
      .ilike('first_name', inst.first_name)
      .ilike('last_name', inst.last_name)
      .limit(1).single()

    if (!person) {
      const { data: np, error } = await supabase.from('people').insert({
        tenant_id: tenant.tenant_id, first_name: inst.first_name, last_name: inst.last_name, custom_fields: {},
      }).select('id').single()
      if (error) { console.log(`${tenant.name} person error:`, error.message); continue }
      person = np
    }

    seeded.push({ personId: person.id, name: `${inst.first_name} ${inst.last_name}` })

    const { data: existing } = await supabase.from('instructors').select('id')
      .eq('tenant_id', tenant.tenant_id).eq('person_id', person.id).maybeSingle()
    if (!existing) {
      const { error } = await supabase.from('instructors').insert({
        tenant_id: tenant.tenant_id, person_id: person.id,
      })
      if (error) console.log(`${tenant.name} instructor insert error:`, error.message)
      else console.log(`${tenant.name}: created instructor ${inst.first_name} ${inst.last_name}`)
    } else {
      console.log(`${tenant.name}: instructor ${inst.first_name} ${inst.last_name} exists`)
    }
  }

  const { data: enrollments, error: eErr } = await supabase.from('enrollments')
    .select('id, custom_fields').eq('tenant_id', tenant.tenant_id)
  if (eErr) { console.log(`${tenant.name} enroll error:`, eErr.message); continue }

  let assigned = 0
  for (let i = 0; i < (enrollments || []).length; i++) {
    const enr = enrollments[i]
    const inst = seeded[i % seeded.length]
    const cf = enr.custom_fields || {}
    const { error } = await supabase.from('enrollments').update({
      instructor_person_id: inst.personId,
      custom_fields: { ...cf, instructor: inst.name },
    }).eq('id', enr.id)
    if (!error) assigned++
  }
  console.log(`${tenant.name}: assigned instructors to ${assigned} enrollments`)
}

console.log('done')