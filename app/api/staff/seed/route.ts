// TEMP: Seed endpoint to create fictional instructors for tenants that currently
// have none, and assign them to students so instructor contact cards are clickable.
// Visit /api/staff/seed to generate demo instructors + assignments.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SEED_STAFF = [
  {
    tenant_id: '00000000-0000-0000-0000-000000000002',
    name: 'Sacramento Martial Arts',
    instructors: [
      { first_name: 'Daniel', last_name: 'Reyes' },
      { first_name: 'Alina', last_name: 'Garcia' },
      { first_name: 'Marcus', last_name: 'Chen' },
    ],
  },
  {
    tenant_id: '00000000-0000-0000-0000-000000000003',
    name: 'Kumon Learning Center',
    instructors: [
      { first_name: 'Hana', last_name: 'Tanaka' },
      { first_name: 'David', last_name: 'Kim' },
      { first_name: 'Mei', last_name: 'Nakamura' },
    ],
  },
]

export async function GET() {
  const results: string[] = []

  for (const tenant of SEED_STAFF) {
    const seededInstructors: { personId: string; name: string }[] = []

    // 1. Create instructor people + instructors records
    for (const inst of tenant.instructors) {
      try {
        let { data: person } = await supabaseAdmin
          .from('people')
          .select('id')
          .eq('tenant_id', tenant.tenant_id)
          .ilike('first_name', inst.first_name)
          .ilike('last_name', inst.last_name)
          .limit(1)
          .single()

        if (!person) {
          const { data: newPerson, error: personError } = await supabaseAdmin
            .from('people')
            .insert({ tenant_id: tenant.tenant_id, first_name: inst.first_name, last_name: inst.last_name, custom_fields: {} })
            .select('id')
            .single()

          if (personError) {
            results.push(`${tenant.name}: ${inst.first_name} ${inst.last_name} — could not create person (${personError.message})`)
            continue
          }
          person = newPerson
        }

        seededInstructors.push({ personId: person.id, name: `${inst.first_name} ${inst.last_name}` })

        // Ensure an instructors record exists
        const { data: existingInstr } = await supabaseAdmin
          .from('instructors')
          .select('id')
          .eq('tenant_id', tenant.tenant_id)
          .eq('person_id', person.id)
          .maybeSingle()

        if (existingInstr) {
          results.push(`${tenant.name}: ${inst.first_name} ${inst.last_name} — instructor already exists (${existingInstr.id})`)
        } else {
          const { data: instrRecord, error: instrError } = await supabaseAdmin
            .from('instructors')
            .insert({ tenant_id: tenant.tenant_id, person_id: person.id })
            .select('id')
            .single()

          if (instrError) {
            results.push(`${tenant.name}: ${inst.first_name} ${inst.last_name} — could not create instructor (${instrError.message})`)
          } else {
            results.push(`${tenant.name}: ${inst.first_name} ${inst.last_name} — created instructor ${instrRecord.id}`)
          }
        }
      } catch (err) {
        results.push(`${tenant.name}: ${inst.first_name} ${inst.last_name} — error (${(err as Error).message})`)
      }
    }

    // 2. Assign instructors to students (round-robin) via instructor_person_id
    if (seededInstructors.length === 0) {
      results.push(`${tenant.name}: no instructors available to assign`)
      continue
    }

    try {
      const { data: enrollments, error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .select('id, custom_fields')
        .eq('tenant_id', tenant.tenant_id)

      if (enrollError) {
        results.push(`${tenant.name}: could not fetch enrollments (${enrollError.message})`)
        continue
      }

      let assigned = 0
      for (let i = 0; i < (enrollments || []).length; i++) {
        const enrollment = enrollments![i]
        const instructor = seededInstructors[i % seededInstructors.length]
        const existingCustomFields = (enrollment.custom_fields as Record<string, any>) || {}

        const { error: updateError } = await supabaseAdmin
          .from('enrollments')
          .update({
            instructor_person_id: instructor.personId,
            custom_fields: { ...existingCustomFields, instructor: instructor.name },
          })
          .eq('id', enrollment.id)

        if (updateError) {
          results.push(`${tenant.name}: could not assign instructor to enrollment ${enrollment.id} (${updateError.message})`)
        } else {
          assigned++
        }
      }

      results.push(`${tenant.name}: assigned instructors to ${assigned} enrollments`)
    } catch (err) {
      results.push(`${tenant.name}: assignment error (${(err as Error).message})`)
    }
  }

  return NextResponse.json({
    success: true,
    results,
    note: 'Fictional instructors created and assigned to students for Sacramento Martial Arts and Kumon Learning Center. Re-running is idempotent.',
  })
}