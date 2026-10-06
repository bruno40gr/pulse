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
 * Normalize a name into a full key and a first-token + last-token key. Middle
 * names and initials are ignored for the token key, so "Isaias W Pallib",
 * "Isaias Pallib", "Andrew Dylan Johnson" and "Andrew Johnson" all map to the
 * same staff member. The full key is kept for exact and alias matching.
 */
function instructorMatchKeys(name: string): { full: string; token: string } {
  const tokens = name.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const first = tokens[0] || ''
  const last = tokens[tokens.length - 1] || ''
  const token = first && last ? `${first} ${last}` : first || last
  return { full: tokens.join(' '), token }
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

  const incoming = instructorMatchKeys(normalized)
  if (!incoming.token) return null

  // Match against the tenant's existing instructors by normalized name so an
  // import can never create a duplicate. The previous approach did a per-name
  // ilike + limit(1).single(), which silently binds to an arbitrary person when
  // two share a name and errors when none exist — and, worse, a rename (e.g.
  // "Andrew Dylan Johnson" → "Drew Johnson") made the lookup miss and re-created
  // the person on the next import.
  const { data: existingInstructors } = await supabaseAdmin
    .from('instructors')
    .select('id, person_id, person:people(id, first_name, last_name, custom_fields)')
    .eq('tenant_id', tenantId)

  const byFull = new Map<string, ResolvedInstructor>()
  const byAlias = new Map<string, ResolvedInstructor>()
  const byToken = new Map<string, ResolvedInstructor>()

  for (const row of (existingInstructors || []) as Array<{
    id: string
    person_id: string
    person: { first_name: string | null; last_name: string | null; custom_fields?: Record<string, unknown> | null } | Array<{ first_name: string | null; last_name: string | null; custom_fields?: Record<string, unknown> | null }> | null
  }>) {
    const person = Array.isArray(row.person) ? row.person[0] : row.person
    if (!person) continue
    const rec: ResolvedInstructor = { person_id: row.person_id, instructor_id: row.id, name: normalized }
    const keys = instructorMatchKeys(`${person.first_name || ''} ${person.last_name || ''}`)
    if (keys.token && !byToken.has(keys.token)) byToken.set(keys.token, rec)
    if (keys.full && !byFull.has(keys.full)) byFull.set(keys.full, rec)

    // Explicit aliases (custom_fields.name_aliases) let a renamed staff member
    // keep resolving under their old roster label without re-creating a duplicate.
    const aliases = Array.isArray(person.custom_fields?.name_aliases)
      ? (person.custom_fields.name_aliases as unknown[])
      : []
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) {
        const aKey = instructorMatchKeys(alias).full
        if (aKey && !byAlias.has(aKey)) byAlias.set(aKey, rec)
      }
    }
  }

  const existing = byFull.get(incoming.full) || byAlias.get(incoming.full) || byToken.get(incoming.token)
  if (existing) return existing

  // No existing instructor matches — create the person + instructors record.
  const { first_name, last_name } = splitName(normalized)
  const { data: newPerson, error: personError } = await supabaseAdmin
    .from('people')
    .insert({ tenant_id: tenantId, first_name, last_name, custom_fields: {} })
    .select('id')
    .single()

  if (personError || !newPerson) {
    console.error('resolveInstructor: could not create person', personError)
    return null
  }

  const { data: newInstructor, error: instructorError } = await supabaseAdmin
    .from('instructors')
    .insert({ tenant_id: tenantId, person_id: newPerson.id })
    .select('id')
    .single()

  if (instructorError || !newInstructor) {
    console.error('resolveInstructor: could not create instructor', instructorError)
    return null
  }

  return { person_id: newPerson.id, instructor_id: newInstructor.id, name: normalized }
}