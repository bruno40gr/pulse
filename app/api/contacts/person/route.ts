import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }

function text(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** One student, created outside the CSV import: a band's external member. */
export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid request.' }, { status: 400, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false, body })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })

  const firstName = text((body as Record<string, unknown>).first_name, 80)
  const lastName = text((body as Record<string, unknown>).last_name, 80)
  const email = text((body as Record<string, unknown>).email, 254).toLowerCase()
  const phone = text((body as Record<string, unknown>).phone, 40)
  if (!firstName && !lastName) return Response.json({ error: 'Enter the student’s name.' }, { status: 400, headers })
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers })

  try {
    if (email || phone) {
      const existing = await supabaseAdmin.from('people').select('id, email, phone').eq('tenant_id', access.tenantId)
      if (existing.error || !Array.isArray(existing.data)) throw new Error('Could not check existing contacts')
      const digits = phone.replace(/\D/g, '')
      const duplicate = existing.data.find(person =>
        (email && typeof person.email === 'string' && person.email.toLowerCase() === email) ||
        (digits && typeof person.phone === 'string' && person.phone.replace(/\D/g, '') === digits))
      if (duplicate) return Response.json({ error: 'That email or phone number already belongs to a contact. Find them in the candidate list instead.' }, { status: 409, headers })
    }

    const person = await supabaseAdmin.from('people')
      .insert({ tenant_id: access.tenantId, first_name: firstName || null, last_name: lastName || null, email: email || null, phone: phone || null, custom_fields: {} })
      .select('id')
      .single()
    if (person.error || !person.data) throw person.error || new Error('Could not create the student')

    const student = await supabaseAdmin.from('students')
      .insert({ tenant_id: access.tenantId, person_id: person.data.id, account_id: null, client_status: 'active' })
      .select('id')
      .single()
    if (student.error) {
      // Never leave a person who is not a student behind.
      await supabaseAdmin.from('people').delete().eq('tenant_id', access.tenantId).eq('id', person.data.id)
      throw student.error
    }

    return Response.json({ person: { id: person.data.id, name: `${firstName} ${lastName}`.trim() } }, { status: 201, headers })
  } catch {
    return Response.json({ error: 'Could not add that student.' }, { status: 503, headers })
  }
}
