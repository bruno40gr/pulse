import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import type { TaskOwner, TaskPerson } from '@/lib/note-tasks'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.notesRead })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  try {
    const context = access.context!
    const url = new URL(request.url)
    if (url.searchParams.get('owners') === 'true') {
      const owners: TaskOwner[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabaseAdmin.from('tenant_memberships')
          .select('id, person:people!inner(first_name, last_name)')
          .eq('tenant_id', access.tenantId).in('status', ['unclaimed', 'invited', 'active'])
          .order('id').range(offset, offset + 999)
        if (error) throw error
        for (const row of data || []) {
          const person = (Array.isArray(row.person) ? row.person[0] : row.person) as { first_name: string | null; last_name: string | null } | null
          owners.push({ id: row.id, name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unnamed staff member' })
        }
        if (!data || data.length < 1000) break
      }
      return NextResponse.json({ owners, membershipId: context.membershipId })
    }
    const query = (url.searchParams.get('q') || '').trim().replace(/[^\p{L}\p{N}\s'-]/gu, '').slice(0, 80)
    const selected = url.searchParams.get('selected') || ''
    if (!query && !/^(contact|lead):[0-9a-f-]{36}$/i.test(selected)) return NextResponse.json([])
    const people: TaskPerson[] = []
    if (context.roleKey === 'owner' || context.permissions.has(PERMISSIONS.contactsRead)) {
      let contacts = supabaseAdmin.from('people').select('id, first_name, last_name').eq('tenant_id', access.tenantId)
      if (selected.startsWith('contact:')) contacts = contacts.eq('id', selected.slice(8))
      else if (query) contacts = contacts.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      else contacts = contacts.eq('id', '00000000-0000-0000-0000-000000000000')
      const { data, error } = await contacts.order('last_name').limit(20)
      if (error) throw error
      for (const row of data || []) people.push({ id: `contact:${row.id}`, name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unnamed contact', kind: 'contact' })
    }
    if (context.roleKey === 'owner' || context.permissions.has(PERMISSIONS.leadsRead)) {
      let leads = crmSupabaseAdmin.from('lead_intakes').select('id, crm_contacts!inner(full_name)').eq('tenant_id', access.tenantId)
      if (selected.startsWith('lead:')) leads = leads.eq('id', selected.slice(5))
      else if (query) leads = leads.ilike('crm_contacts.full_name', `%${query}%`)
      else leads = leads.eq('id', '00000000-0000-0000-0000-000000000000')
      const { data, error } = await leads.order('id').limit(20)
      if (error) throw error
      for (const row of data || []) {
        const contact = (Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts) as { full_name: string | null } | null
        people.push({ id: `lead:${row.id}`, name: contact?.full_name || 'Unnamed lead', kind: 'lead' })
      }
    }
    return NextResponse.json(people)
  } catch {
    return NextResponse.json({ error: 'Could not load the task directory.' }, { status: 503 })
  }
}