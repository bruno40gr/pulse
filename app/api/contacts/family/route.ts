import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { UUID_PATTERN } from '@/lib/band-creation-draft'
import { validateContactProfile } from '@/lib/contact-profile'
import { readDisplayFamilyAccountLinks } from '@/lib/family-account-server'

const headers = { 'Cache-Control': 'private, no-store' }
const roles = /^(family|student|parent|customer|guardian)$/

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || roles.test(access.context.roleKey)) return Response.json({ error: 'Staff access is required.' }, { status: 403, headers })
  const accounts = []
  for (let offset = 0; ; offset += 500) {
    const result = await supabaseAdmin.from('accounts').select('id,name,email,phone')
      .eq('tenant_id', access.tenantId).order('id').range(offset, offset + 499)
    if (result.error) return Response.json({ error: 'Family accounts could not be loaded.' }, { status: 503, headers })
    accounts.push(...(result.data || []))
    if ((result.data || []).length < 500) break
  }
  const managers = []
  for (let offset = 0; ; offset += 500) {
    const result = await supabaseAdmin.from('account_holders').select('id,account_id,person_id,relationship,is_primary')
      .eq('tenant_id', access.tenantId).order('id').range(offset, offset + 499)
    if (result.error) return Response.json({ error: 'Account managers could not be loaded.' }, { status: 503, headers })
    managers.push(...(result.data || []))
    if ((result.data || []).length < 500) break
  }
  try {
    const family = await readDisplayFamilyAccountLinks(access.tenantId)
    return Response.json({ accounts, managers, family_account_links: family.links, account_linking_supported: family.supported }, { headers })
  } catch {
    return Response.json({ error: 'Family account links could not be loaded.' }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || roles.test(access.context.roleKey)) return Response.json({ error: 'Staff access is required.' }, { status: 403, headers })
  const raw = await request.text()
  if (raw.length > 12000) return Response.json({ error: 'Family request is too large.' }, { status: 413, headers })
  let body
  try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid family change.' }, { status: 400, headers }) }
  if (body?.kind === 'family-account-link') {
    if (!UUID_PATTERN.test(body.operationId || '') || !UUID_PATTERN.test(body.accountId || '')
      || !UUID_PATTERN.test(body.memberAccountId || '') || body.accountId === body.memberAccountId) {
      return Response.json({ error: 'Choose two different valid accounts.' }, { status: 400, headers })
    }
    const result = await supabaseAdmin.rpc('link_family_account', { p_tenant: access.tenantId, p_actor: access.context.membershipId,
      p_operation: body.operationId, p_change: { account_id: body.accountId, member_account_id: body.memberAccountId } })
    if (result.error) return Response.json({ error: 'Family account was not linked. Verify family-account storage is installed, then refresh and review existing links. Billing and messaging accounts have not been reassigned.' }, { status: 409, headers })
    return Response.json(result.data, { headers })
  }
  if (body && ['manager-link', 'manager-create', 'manager-unlink'].includes(body.kind)) {
    if (!UUID_PATTERN.test(body.operationId || '') || !UUID_PATTERN.test(body.accountId || '')
      || (body.kind !== 'manager-create' && !UUID_PATTERN.test(body.personId || ''))) {
      return Response.json({ error: 'Choose a valid account and person.' }, { status: 400, headers })
    }
    let fields = {}
    if (body.kind === 'manager-create') {
      const parsed = validateContactProfile({ first_name: body.firstName, last_name: body.lastName,
        email: body.email || null, phone: body.phone || null, date_of_birth: body.birthday || null })
      if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers })
      fields = parsed.fields
    }
    const result = await supabaseAdmin.rpc('change_account_manager', { p_tenant: access.tenantId, p_actor: access.context.membershipId,
      p_operation: body.operationId, p_change: { kind: body.kind, account_id: body.accountId, person_id: body.kind === 'manager-create' ? null : body.personId, fields } })
    if (result.error) return Response.json({ error: 'Account manager was not saved. Refresh and try again. The primary holder cannot be removed here.' }, { status: 409, headers })
    return Response.json(result.data, { headers })
  }
  if (!body || !UUID_PATTERN.test(body.operationId || '') || !UUID_PATTERN.test(body.accountId || '')
    || !['child', 'link-child', 'link-account', 'create-manager', 'unlink-child', 'dependent-relationship'].includes(body.kind)
    || (['link-child', 'link-account', 'create-manager', 'unlink-child', 'dependent-relationship'].includes(body.kind) && !UUID_PATTERN.test(body.personId || ''))
    || (body.kind === 'link-account' && !UUID_PATTERN.test(body.managerAccountId || ''))
    || (body.kind !== 'child' && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0))
    || typeof body.relationship !== 'string' || !['Child', 'Spouse', 'Sibling', 'Other', 'Parent / guardian', 'Other responsible adult'].includes(body.relationship)) {
    return Response.json({ error: 'Choose valid accounts, people and relationship.' }, { status: 400, headers })
  }
  let fields = {}
  if (body.kind === 'child' || body.kind === 'create-manager') {
    if (typeof body.firstName !== 'string' || typeof body.lastName !== 'string' || !body.firstName.trim() || !body.lastName.trim()) return Response.json({ error: 'First and last name are required.' }, { status: 400, headers })
    const parsed = validateContactProfile({ first_name: body.firstName, last_name: body.lastName,
      email: body.email || null, phone: body.phone || null, date_of_birth: body.birthday || null })
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers })
    fields = parsed.fields
  }
  const result = await supabaseAdmin.rpc('change_contact_family', { p_tenant: access.tenantId, p_actor: access.context.membershipId,
    p_operation: body.operationId, p_change: { kind: body.kind, account_id: body.accountId, person_id: body.personId || null,
      manager_account_id: body.managerAccountId || null, expected_revision: body.expectedRevision ?? null, relationship: body.relationship, fields } })
  if (result.error) return Response.json({ error: 'Family change was not saved. Check the family-management migration and refresh the selected relationships. Primary account links cannot be removed here.' }, { status: 409, headers })
  return Response.json(result.data, { headers })
}