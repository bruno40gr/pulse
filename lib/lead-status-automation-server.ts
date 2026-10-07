import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { withTimeout } from '@/lib/request-runtime'
import { canApplyNoteStatus, detectNoteStatus, readStatusAutomation, type AutomaticStatusChange } from '@/lib/lead-status-automation'
import { formatLeadStatus } from '@/lib/lead-status'

// Called only after the staff note has been persisted. No provider calls or
// speculative interpretation; failure must never undo or reject the saved note.
export async function applySavedNoteStatus(input: {
  tenantId: string; leadId: string; noteId: string; note: string; actor: Record<string, unknown>
}): Promise<AutomaticStatusChange | null> {
  const decision = detectNoteStatus(input.note)
  if (!decision) return null
  const { data: lead, error } = await withTimeout(
    crmSupabaseAdmin.from('lead_intakes').select('id, contact_id, intake_type, status, payload, source_form, updated_at')
      .eq('tenant_id', input.tenantId).eq('id', input.leadId).maybeSingle(),
    8000, 'note status snapshot',
  )
  if (error) throw error
  if (!lead || !['lesson_inquiry', 'tour_request', 'service_inquiry'].includes(lead.intake_type)
    || lead.source_form === '2026-disenrollment-import' || lead.payload?.winback
    || !lead.updated_at || !canApplyNoteStatus(lead.status, decision, lead.payload)) return null

  const state = readStatusAutomation(lead.payload)
  if (state.last_change?.note_event_id === input.noteId) return null
  const change: AutomaticStatusChange = {
    id: crypto.randomUUID(), previous_status: lead.status, next_status: decision.status,
    reason: decision.reason, evidence: decision.evidence, note_event_id: input.noteId, changed_at: new Date().toISOString(),
  }
  // Compare-and-swap: concurrent human edits (including same-status overrides)
  // invalidate this snapshot. The reason and source are saved atomically with status.
  const { data: updated, error: updateError } = await withTimeout(
    crmSupabaseAdmin.from('lead_intakes').update({
      status: decision.status,
      payload: { ...lead.payload, status_automation: { paused: false, last_change: change } },
    }).eq('tenant_id', input.tenantId).eq('id', input.leadId).eq('status', lead.status)
      .eq('updated_at', lead.updated_at).select('id').maybeSingle(),
    8000, 'automatic note status update',
  )
  if (updateError) throw updateError
  if (!updated) return null
  const { error: eventError } = await withTimeout(crmSupabaseAdmin.from('lead_events').insert({
    tenant_id: input.tenantId, lead_intake_id: input.leadId, contact_id: lead.contact_id,
    event_type: 'status_automated', event_label: `Automatically moved to ${formatLeadStatus(decision.status)}`,
    payload: { ...change, actor: input.actor, automation: 'staff-note-rules-v1' },
  }), 8000, 'automatic status history')
  if (eventError) console.error('[leads] Automatic status history failed; decision retained in lead payload', eventError)
  return change
}