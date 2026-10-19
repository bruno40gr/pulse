import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { normalizePhoneNumber } from '@/lib/phone'
import type { ConversationPerson } from '@/lib/conversations-live'

/** Complete tenant-scoped directory; never silently truncate recipient/profile resolution. */
export async function conversationDirectory(tenantId: string, includeContacts: boolean, includeLeads: boolean) {
  const people: ConversationPerson[] = []
  if (includeContacts) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin.from('people').select('id,first_name,last_name,email,phone')
        .eq('tenant_id', tenantId).order('id').range(offset, offset + 999)
      if (error) throw new Error('Contacts could not be loaded.')
      for (const row of data || []) people.push({
        id: `person:${row.id}`, name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || row.phone || 'Contact',
        email: row.email || '', phone: row.phone || '', student: '', stage: '',
        profileType: 'contact', profileId: row.id, smsContactId: row.id,
      })
      if ((data || []).length < 1000) break
    }
  }
  if (includeLeads) {
    const seen = new Set<string>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await crmSupabaseAdmin.from('lead_intakes')
        .select('id,contact_id,intake_type,status,created_at,crm_contacts(id,full_name,email,phone)')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).order('id').range(offset, offset + 999)
      if (error) throw new Error('Leads could not be loaded.')
      for (const row of data || []) {
        const contact = Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts
        if (!contact || seen.has(contact.id)) continue
        seen.add(contact.id)
        const existing = people.find(person => person.email && contact.email && person.email.toLowerCase() === contact.email.toLowerCase()
          && normalizePhoneNumber(person.phone) && normalizePhoneNumber(person.phone) === normalizePhoneNumber(contact.phone))
        // Keep contact and lead IDs distinct unless both routing addresses agree.
        if (existing) {
          existing.aliases = [...(existing.aliases || []), `lead:${contact.id}`]
          continue
        }
        people.push({ id: `lead:${contact.id}`, name: contact.full_name || contact.email || contact.phone || 'Lead',
          email: contact.email || '', phone: contact.phone || '', student: '', stage: row.status,
          profileType: 'lead', profileId: row.id, intakeType: row.intake_type, smsContactId: contact.id })
      }
      if ((data || []).length < 1000) break
    }
  }
  return people
}