import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { followUpUuid, parseSharedFollowUpCommand, sharedFollowUpsEnabled } from '@/lib/shared-follow-up'
import { familyAccountId } from '@/lib/family-account'
import { readFamilyAccountLinks } from '@/lib/family-account-server'

const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ id: string }> }
async function authorize(request: Request, id: string, write: boolean, body?: unknown) {
  const access = await authorizeTenantRequest(request, { permission: write ? PERMISSIONS.contactsManage : PERMISSIONS.contactsRead, allowDemo: false, body })
  if (!access.ok) return { response: Response.json({ error: access.error }, { status: access.status, headers }) }
  if (!access.context || /^(family|student|parent|customer|guardian)$/.test(access.context.roleKey)) {
    return { response: Response.json({ error: 'Staff account access is required.' }, { status: 403, headers }) }
  }
  if (!followUpUuid.test(id)) return { response: Response.json({ error: 'Invalid account.' }, { status: 400, headers }) }
  const account = await supabaseAdmin.from('accounts').select('id').eq('tenant_id', access.tenantId).eq('id', id).maybeSingle()
  if (account.error) throw account.error
  if (!account.data) return { response: Response.json({ error: 'Account not found.' }, { status: 404, headers }) }
  const family = await readFamilyAccountLinks(access.tenantId)
  const accountId = familyAccountId(id, family.links)
  // Both aliases of a linked family must address the same reminder.
  return { access, accountId }
}
export async function GET(request: Request, { params }: Context) {
  if (!sharedFollowUpsEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  try {
    const auth = await authorize(request, (await params).id, false)
    if (auth.response) return auth.response
    const result = await crmSupabaseAdmin.from('account_follow_ups')
      .select('id,account_id,due_at,message,status,owner_membership_id,version,updated_at')
      .eq('tenant_id', auth.access!.tenantId).eq('account_id', auth.accountId!)
    if (result.error || !Array.isArray(result.data)) throw new Error('Read failed')
    return Response.json({ follow_ups: result.data, account_id: auth.accountId, can_edit_inquiries: false }, { headers })
  } catch {
    return Response.json({ error: 'Could not load family follow-up. Please try again.' }, { status: 503, headers })
  }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!sharedFollowUpsEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  try {
    const auth = await authorize(request, (await params).id, true, body)
    if (auth.response) return auth.response
    const command = parseSharedFollowUpCommand(body)
    if (!command || command.lead_intake_id) return Response.json({ error: 'Choose a valid family follow-up date, reminder and current version.' }, { status: 400, headers })
    const result = await crmSupabaseAdmin.rpc('save_account_follow_up', {
      p_tenant: auth.access!.tenantId, p_account: auth.accountId!, p_actor: auth.access!.context!.membershipId,
      p_action: command.action, p_expected_version: command.expected_version, p_due: command.due_at, p_message: command.message,
    })
    if (result.error?.code === '40001') return Response.json({ error: 'This family follow-up changed. Close the editor and reload before trying again. Your draft has not been saved.' }, { status: 409, headers })
    if (result.error || !Array.isArray(result.data) || result.data.length !== 1) throw new Error('Save failed')
    return Response.json({ follow_up: result.data[0] }, { headers })
  } catch {
    return Response.json({ error: 'Could not save family follow-up. Your draft has not been saved. Verify account follow-up storage and try again.' }, { status: 503, headers })
  }
}