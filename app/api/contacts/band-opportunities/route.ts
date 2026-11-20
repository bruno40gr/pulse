import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { bandWritesEnabled } from '@/lib/band-feature'

const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  if (!bandWritesEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid request.' }, { status: 400, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.leadsManage, allowDemo: false, body })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.contactsRead))) {
    return Response.json({ error: 'Permission to read contacts is required.' }, { status: 403, headers })
  }
  const ids = (body as { person_ids?: unknown }).person_ids
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length) {
    return Response.json({ error: 'Select up to 100 distinct existing students.' }, { status: 400, headers })
  }
  try {
    const [people, students] = await Promise.all([
      supabaseAdmin.from('people').select('id,first_name,last_name').eq('tenant_id', access.tenantId).in('id', ids),
      supabaseAdmin.from('students').select('id,person_id').eq('tenant_id', access.tenantId).in('person_id', ids),
    ])
    if (people.error || students.error || !Array.isArray(people.data) || !Array.isArray(students.data)) throw new Error('Unable to verify students')
    const verified = ids.map(id => {
      const matches = people.data.filter(person => person.id === id)
      const enrolled = students.data.filter(student => student.person_id === id)
      if (matches.length !== 1 || enrolled.length !== 1) return null
      const name = `${matches[0].first_name || ''} ${matches[0].last_name || ''}`.trim()
      return name && name.length <= 250 ? { person_id: id, name } : null
    })
    if (verified.some(item => !item)) return Response.json({ error: 'Every selection must be an existing student in this account.' }, { status: 400, headers })
    const result = await crmSupabaseAdmin.rpc('create_contact_band_opportunities', { p_tenant: access.tenantId, p_students: verified })
    if (result.error || !Array.isArray(result.data) || result.data.length !== ids.length ||
      new Set(result.data.map(row => row?.person_id)).size !== ids.length ||
      result.data.some(row => !row || !ids.includes(row.person_id) || !['created', 'existing'].includes(row.result) || !Array.isArray(row.lead_ids) || !row.lead_ids.length || row.lead_ids.some((id: unknown) => typeof id !== 'string' || !uuid.test(id)))) throw new Error('Unable to verify opportunity results')
    return Response.json({ opportunities: result.data }, { headers })
  } catch {
    return Response.json({ error: 'Could not create Band opportunities. Please check before retrying.' }, { status: 503, headers })
  }
}