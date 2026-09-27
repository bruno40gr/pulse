import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveInstructor, normalizeInstructorName } from '@/lib/instructors'
import { requireOwnerAccess } from '@/lib/account-authorization'
import { DEFAULT_TENANT } from '@/lib/tenant'

export async function POST(request: Request) {
  const results: string[] = []

  try {
    const ownerAccess = await requireOwnerAccess(request, DEFAULT_TENANT)
    if (!ownerAccess.ok) {
      return NextResponse.json({ error: ownerAccess.error }, { status: ownerAccess.status })
    }

    const body = await request.json().catch(() => null)
    if (body?.confirm !== 'BACKFILL') {
      return NextResponse.json({ error: 'Type BACKFILL to confirm.' }, { status: 400 })
    }

    // Get all enrollments across tenants that have an instructor name but no link
    const { data: enrollments, error } = await supabaseAdmin
      .from('enrollments')
      .select('id, tenant_id, instructor_person_id, custom_fields')

    if (error) throw error

    // Build tenant → unique instructor names (from custom_fields.instructor)
    const namesByTenant = new Map<string, Set<string>>()
    const enrollmentsToLink: { id: string; tenant_id: string; name: string }[] = []

    for (const e of enrollments || []) {
      const customFields = e.custom_fields && typeof e.custom_fields === 'object'
        ? e.custom_fields as Record<string, unknown>
        : null
      const rawName = typeof customFields?.instructor === 'string' ? customFields.instructor : null
      const name = normalizeInstructorName(rawName)
      if (!name) continue

      if (e.instructor_person_id) {
        continue // already linked
      }

      enrollmentsToLink.push({ id: e.id, tenant_id: e.tenant_id, name })
      if (!namesByTenant.has(e.tenant_id)) namesByTenant.set(e.tenant_id, new Set())
      namesByTenant.get(e.tenant_id)!.add(name.toLowerCase())
    }

    // Resolve each unique name → person_id (idempotent via shared helper)
    const personIdByNameByTenant = new Map<string, Map<string, string>>()
    for (const [tenantId, names] of namesByTenant) {
      const map = new Map<string, string>()
      for (const name of names) {
        const resolved = await resolveInstructor(tenantId, name)
        if (resolved) map.set(name, resolved.person_id)
        else results.push(`tenant ${tenantId}: could not resolve "${name}"`)
      }
      personIdByNameByTenant.set(tenantId, map)
    }

    // Link enrollments
    let linked = 0
    let skipped = 0
    for (const e of enrollmentsToLink) {
      const map = personIdByNameByTenant.get(e.tenant_id)
      const personId = map?.get(e.name.toLowerCase())
      if (!personId) {
        skipped++
        continue
      }

      const { error: updateError } = await supabaseAdmin
        .from('enrollments')
        .update({ instructor_person_id: personId })
        .eq('id', e.id)

      if (updateError) {
        results.push(`enrollment ${e.id}: link error (${updateError.message})`)
      } else {
        linked++
      }
    }

    results.push(`Linked ${linked} enrollments to instructors (${skipped} skipped)`)

    const { error: auditError } = await supabaseAdmin.from('account_audit_events').insert({
      tenant_id: DEFAULT_TENANT,
      actor_membership_id: ownerAccess.membershipId,
      event_type: 'data_migration.staff_backfill_completed',
      metadata: { linked, skipped },
    })
    if (auditError) console.error('Backfill audit event error:', auditError)

    return NextResponse.json({
      success: true,
      linked,
      skipped,
      auditRecorded: !auditError,
      results,
      note: 'Idempotent backfill: instructor names were resolved to people + instructors records and linked via instructor_person_id.',
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}