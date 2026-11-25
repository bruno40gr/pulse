import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { contactFollowUpSummary } from '@/lib/contact-follow-up-summary'

/** Bounded, paginated reads; never mask a failed read as no reminders. */
export async function attachContactFollowUps<T extends { id: string }>(tenantId: string, contacts: T[], includeInquiries: boolean) {
  const byPerson = new Map<string, { due_at: string | null; message: string | null; status: string }[]>()
  for (let start = 0; start < contacts.length; start += 100) {
    for (let offset = 0; ; offset += 1000) {
      let query = crmSupabaseAdmin.from('follow_ups').select('id,person_id,due_at,message,status')
        .eq('tenant_id', tenantId).eq('status', 'open').in('person_id', contacts.slice(start, start + 100).map(row => row.id))
      if (!includeInquiries) query = query.is('lead_intake_id', null)
      const result = await query.order('id').range(offset, offset + 999)
      if (result.error || !Array.isArray(result.data)) throw new Error('Could not load contact follow-ups. Please try again.')
      for (const row of result.data) {
        const rows = byPerson.get(row.person_id) ?? []
        rows.push(row); byPerson.set(row.person_id, rows)
      }
      if (result.data.length < 1000) break
    }
  }
  return contacts.map(contact => ({ ...contact, ...contactFollowUpSummary(byPerson.get(contact.id) ?? []) }))
}