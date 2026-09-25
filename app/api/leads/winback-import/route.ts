import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { getRequestActor } from '@/lib/access'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const WINBACK_SOURCE_FORM = '2026-disenrollment-import'

type SourceRow = {
  'Student Name'?: unknown
  'Lesson Type'?: unknown
  'Disenrollment Date'?: unknown
  'Disenrollment Month'?: unknown
  'Marked by Cohen'?: unknown
  'Account Holder 1 Name'?: unknown
  'Email 1'?: unknown
  'Phone 1'?: unknown
  'Account Holder 2 Name'?: unknown
  'Email 2'?: unknown
  'Phone 2'?: unknown
  'CRM Client ID'?: unknown
  Notes?: unknown
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean)
  return { first_name: parts[0] || null, last_name: parts.length > 1 ? parts.slice(1).join(' ') : null }
}

function sourceKey(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function comparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function isGroupRow(row: SourceRow) {
  return /group\/band entry|not an individual student/i.test(text(row.Notes))
    || /\bband\b/i.test(text(row['Student Name']))
    || /^(band|group)\b/i.test(text(row['Lesson Type']))
}

function hasContactColumns(row: SourceRow) {
  return ['Email 1', 'Phone 1', 'Email 2', 'Phone 2'].some((key) => text(row[key as keyof SourceRow]))
}

function splitContactDetails(row: SourceRow) {
  const email = text(row['Email 1']) || text(row['Email 2']) || null
  const phone = text(row['Phone 1']) || text(row['Phone 2']) || null
  return { email, phone }
}

function importedNotes(row: SourceRow) {
  const notes = text(row.Notes)
  const entries = ['Imported from 2026 disenrollment list.']
  if (text(row['Marked by Cohen']).toLowerCase() === 'yes') entries.push('Marked by Cohen in the 2026 disenrollment source list.')
  if (notes) entries.push(`Import note: ${notes}`)
  return entries
}

export async function POST(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const actor = await getRequestActor(request)
    const body = await request.json()
    const rows = Array.isArray(body?.rows) ? body.rows as SourceRow[] : []
    if (!rows.length) return NextResponse.json({ error: 'A CSV with at least one student is required.' }, { status: 400 })

    let created = 0
    let skipped = 0
    let excluded = 0
    let updated = 0
    let notesCleared = 0
    let unmatched = 0
    const importedKeys = new Set<string>()

    const hasCorrections = rows.some(hasContactColumns)
    const { data: existingWinbackLeads, error: existingWinbackLeadsError } = hasCorrections
      ? await crmSupabaseAdmin
        .from('lead_intakes')
        .select('id, contact_id, program_label, payload, crm_contacts(id, full_name)')
        .eq('tenant_id', tenantId)
        .eq('source_form', WINBACK_SOURCE_FORM)
      : { data: [], error: null }
    if (existingWinbackLeadsError) throw existingWinbackLeadsError
    const unmatchedExisting = new Map((existingWinbackLeads || []).map((lead) => [lead.id, lead]))

    const findExistingWinbackLead = (row: SourceRow) => {
      const name = text(row['Student Name'])
      const lessonType = text(row['Lesson Type'])
      const disenrollmentDate = text(row['Disenrollment Date'])
      const nameKey = comparable(name)
      const candidates = Array.from(unmatchedExisting.values())
      const leadName = (lead: typeof candidates[number]) => text((lead.crm_contacts as { full_name?: string } | null)?.full_name)
      const leadDate = (lead: typeof candidates[number]) => text((lead.payload as { winback?: { disenrollment_date?: unknown } } | null)?.winback?.disenrollment_date)

      const exact = candidates.filter((lead) => comparable(leadName(lead)) === nameKey && text(lead.program_label) === lessonType && leadDate(lead) === disenrollmentDate)
      if (exact.length === 1) return exact[0]

      const context = candidates.filter((lead) => text(lead.program_label) === lessonType && leadDate(lead) === disenrollmentDate)
      if (context.length === 1) return context[0]

      const ranked = (context.length > 0 ? context : candidates.filter((lead) => text(lead.program_label) === lessonType))
        .map((lead) => ({ lead, distance: editDistance(comparable(leadName(lead)), nameKey) }))
        .sort((left, right) => left.distance - right.distance)
      if (!ranked[0]) return null
      const nextDistance = ranked[1]?.distance ?? Number.POSITIVE_INFINITY
      return ranked[0].distance <= 7 && nextDistance - ranked[0].distance >= 2 ? ranked[0].lead : null
    }

    for (const row of rows) {
      const fullName = text(row['Student Name'])
      const lessonType = text(row['Lesson Type'])
      const disenrollmentDate = text(row['Disenrollment Date'])
      const disenrollmentMonth = text(row['Disenrollment Month'])
      if (!fullName) continue
      if (isGroupRow(row)) {
        excluded += 1
        continue
      }

      if (hasCorrections) {
        const existingWinbackLead = findExistingWinbackLead(row)
        if (existingWinbackLead) {
          unmatchedExisting.delete(existingWinbackLead.id)
          const { first_name, last_name } = splitName(fullName)
          const contactDetails = splitContactDetails(row)
          const { error: contactUpdateError } = await crmSupabaseAdmin
            .from('crm_contacts')
            .update({ first_name, last_name, full_name: fullName, ...contactDetails })
            .eq('tenant_id', tenantId)
            .eq('id', existingWinbackLead.contact_id)
          if (contactUpdateError) throw contactUpdateError

          const { data: uncertaintyEvents, error: uncertaintyEventsError } = await crmSupabaseAdmin
            .from('lead_events')
            .select('id, payload')
            .eq('tenant_id', tenantId)
            .eq('lead_intake_id', existingWinbackLead.id)
            .eq('event_type', 'note_added')
          if (uncertaintyEventsError) throw uncertaintyEventsError
          const uncertaintyIds = (uncertaintyEvents || [])
            .filter((event) => /uncertain|possibly|no surname/i.test(text((event.payload as { text?: unknown } | null)?.text)))
            .map((event) => event.id)
          if (uncertaintyIds.length > 0) {
            const { error: deleteNotesError } = await crmSupabaseAdmin.from('lead_events').delete().in('id', uncertaintyIds)
            if (deleteNotesError) throw deleteNotesError
            notesCleared += uncertaintyIds.length
          }
          updated += 1
          continue
        }
        unmatched += 1
        continue
      }

      const key = sourceKey(fullName)
      if (importedKeys.has(key)) {
        skipped += 1
        continue
      }
      importedKeys.add(key)

      const { data: existingLead, error: existingLeadError } = await crmSupabaseAdmin
        .from('lead_intakes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'lost')
        .contains('payload', { winback: { source_key: key } })
        .maybeSingle()
      if (existingLeadError) throw existingLeadError
      if (existingLead) {
        skipped += 1
        continue
      }

      const { first_name, last_name } = splitName(fullName)
      const { data: existingContact, error: contactLookupError } = await crmSupabaseAdmin
        .from('crm_contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('full_name', fullName)
        .maybeSingle()
      if (contactLookupError) throw contactLookupError

      let contactId = existingContact?.id
      if (!contactId) {
        const { data: contact, error: contactError } = await crmSupabaseAdmin
          .from('crm_contacts')
          .insert({ tenant_id: tenantId, first_name, last_name, full_name: fullName, contact_kind: 'lead', lifecycle_stage: 'former_student' })
          .select('id')
          .single()
        if (contactError) throw contactError
        contactId = contact.id
      }

      const payload = {
        source: 'former_student_import',
        lost_reason: 'disenrolled',
        winback: {
          status: 'to_contact',
          source_key: key,
          disenrollment_date: disenrollmentDate || null,
          disenrollment_month: disenrollmentMonth || null,
          imported_at: new Date().toISOString(),
        },
      }
      const { data: lead, error: leadError } = await crmSupabaseAdmin
        .from('lead_intakes')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          intake_type: 'lesson_inquiry',
          source_system: 'headliner-disenrollment-list',
          source_form: WINBACK_SOURCE_FORM,
          source_page: null,
          program_label: lessonType || null,
          category: 'winback',
          status: 'lost',
          payload,
        })
        .select('id')
        .single()
      if (leadError) throw leadError

      const actorPayload = actor ? { actor: { displayName: actor.displayName } } : {}
      const events = importedNotes(row).map((note) => ({
        tenant_id: tenantId,
        lead_intake_id: lead.id,
        contact_id: contactId,
        event_type: 'note_added',
        event_label: 'Imported record note',
        payload: { text: note, ...actorPayload, imported: true },
      }))
      const { error: notesError } = await crmSupabaseAdmin.from('lead_events').insert(events)
      if (notesError) throw notesError
      created += 1
    }

    return NextResponse.json({ created, skipped, excluded, updated, notesCleared, unmatched })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not import the Win-back list.' }, { status: 500 })
  }
}