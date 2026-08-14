import { supabaseAdmin } from '@/lib/supabase/admin'

export interface ResolvedInstructor {
  person_id: string
  instructor_id: string
  name: string
}

/**
 * Normalize an instructor name for matching. Returns null for empty/placeholder values.
 */
export function normalizeInstructorName(name: string | null | undefined): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed || trimmed === '-' || trimmed === '—') return null
  return trimmed
}

/**
 * Split a full name into first/last. Handles single-word names.
 */
export function splitName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/)
  const first_name = parts[0] || ''
  const last_name = parts.slice(1).join(' ') || first_name
  return { first_name, last_name }
}

/**
 * Resolve an instructor by name for a tenant, creating the person + instructors
 * records if they don't exist. Idempotent — safe to call repeatedly.
 *
 * Returns null if the name is empty/placeholder.
 */
export async function resolveInstructor(
  tenantId: string,
  name: string | null | undefined
): Promise<ResolvedInstructor | null> {
  const normalized = normalizeInstructorName(name)
  if (!normalized) return null

  const { first_name, last_name } = splitName(normalized)

  // 1. Find or create the person
  let { data: person } = await supabaseAdmin
    .from('people')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('first_name', first_name)
    .ilike('last_name', last_name)
    .limit(1)
    .single()

  if (!person) {
    const { data: newPerson, error: personError } = await supabaseAdmin
      .from('people')
      .insert({ tenant_id: tenantId, first_name, last_name, custom_fields: {} })
      .select('id')
      .single()

    if (personError) {
      console.error('resolveInstructor: could not create person', personError)
      return null
    }
    person = newPerson
  }

  // 2. Find or create the instructors record
  let { data: instructor } = await supabaseAdmin
    .from('instructors')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('person_id', person.id)
    .maybeSingle()

  if (!instructor) {
    const { data: newInstructor, error: instructorError } = await supabaseAdmin
      .from('instructors')
      .insert({ tenant_id: tenantId, person_id: person.id })
      .select('id')
      .single()

    if (instructorError) {
      console.error('resolveInstructor: could not create instructor', instructorError)
      return null
    }
    instructor = newInstructor
  }

  return {
    person_id: person.id,
    instructor_id: instructor.id,
    name: normalized,
  }
}