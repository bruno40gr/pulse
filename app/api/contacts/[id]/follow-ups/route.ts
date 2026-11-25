import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { followUpUuid, parseSharedFollowUpCommand, sharedFollowUpsEnabled } from '@/lib/shared-follow-up'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string }> }

async function authorize(request: Request, id: string, write: boolean, body?: unknown) {
  const access = await authorizeTenantRequest(request, { permission: write ? PERMISSIONS.contactsManage : PERMISSIONS.contactsRead, body })
  if (!access.ok) return { response: Response.json({ error: access.error }, { status: access.status, headers }) }
  if (!followUpUuid.test(id)) return { response: Response.json({ error: 'Invalid contact.' }, { status: 400, headers }) }
  const person = await supabaseAdmin.from('people').select('id').eq('tenant_id', access.tenantId).eq('id', id).maybeSingle()
  if (person.error) throw person.error
  if (!person.data) return { response: Response.json({ error: 'Contact not found.' }, { status: 404, headers }) }
  return { access }
}

export async function GET(request: Request, { params }: Context) {
  if (!sharedFollowUpsEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  try {
    const { id } = await params
    const auth = await authorize(request, id, false)
    if (auth.response) return auth.response
    const { tenantId, context } = auth.access!
    const canReadInquiries = context?.roleKey === 'owner' || context?.permissions.has(PERMISSIONS.leadsRead)
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      let query = crmSupabaseAdmin.from('follow_ups')
        .select('id,person_id,lead_intake_id,due_at,message,status,owner_membership_id,version,updated_at')
        .eq('tenant_id', tenantId).eq('person_id', id)
      // Contact access alone must not disclose inquiry-only information.
      if (!canReadInquiries) query = query.is('lead_intake_id', null)
      const result = await query.order('id').range(offset, offset + 999)
      if (result.error || !Array.isArray(result.data)) throw new Error('Read failed')
      rows.push(...result.data)
      if (result.data.length < 1000) break
    }
    return Response.json({ follow_ups: rows, can_edit_inquiries: Boolean(canReadInquiries && (context?.roleKey === 'owner' || context?.permissions.has(PERMISSIONS.leadsManage))) }, { headers })
  } catch {
    return Response.json({ error: 'Could not load follow-ups. Please try again.' }, { status: 503, headers })
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!sharedFollowUpsEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  try {
    const { id } = await params
    const auth = await authorize(request, id, true, body)
    if (auth.response) return auth.response
    const { tenantId, context } = auth.access!
    const command = parseSharedFollowUpCommand(body)
    if (!command) return Response.json({ error: 'Choose a valid date, reminder and current follow-up version.' }, { status: 400, headers })
    if (!context) return Response.json({ error: 'Staff account access is required.' }, { status: 403, headers })
    if (command.lead_intake_id) {
      if (context.roleKey !== 'owner' && (!context.permissions.has(PERMISSIONS.leadsManage) || !context.permissions.has(PERMISSIONS.leadsRead))) {
        return Response.json({ error: 'Permission to read and manage inquiries is required.' }, { status: 403, headers })
      }
      const lead = await crmSupabaseAdmin.from('lead_intakes').select('id').eq('tenant_id', tenantId).eq('person_id', id).eq('id', command.lead_intake_id).maybeSingle()
      if (lead.error) throw lead.error
      if (!lead.data) return Response.json({ error: 'Linked inquiry not found.' }, { status: 404, headers })
    }
    const result = await crmSupabaseAdmin.rpc('save_shared_follow_up', {
      p_tenant: tenantId, p_person: id, p_lead: command.lead_intake_id,
      p_actor: context.membershipId, p_action: command.action, p_expected_version: command.expected_version,
      p_due: command.due_at, p_message: command.message,
    })
    if (result.error?.code === '40001') return Response.json({ error: 'This follow-up changed. Close the editor and reload before trying again. Your draft has not been saved.' }, { status: 409, headers })
    if (result.error || !Array.isArray(result.data) || result.data.length !== 1) throw new Error('Save failed')
    return Response.json({ follow_up: result.data[0] }, { headers })
  } catch {
    return Response.json({ error: 'Could not save follow-up. Your draft has not been saved. Please try again.' }, { status: 503, headers })
  }
}