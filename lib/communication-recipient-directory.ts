import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { resolveCommunicationRecipients, type RecipientContact, type RecipientResolution } from '@/lib/communication-recipients'

export function validContactSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 5000 && value.every(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) && new Set(value).size === value.length
}

export async function communicationRecipients(tenantId: string, ids: string[], channel: 'email' | 'sms') {
  const contacts: RecipientContact[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabaseAdmin.from('people')
      .select('id,first_name,last_name,email,phone,opted_out,students(is_minor,message_routing,accounts(name,email,phone),student_accounts(accounts(name,email,phone)))')
      .eq('tenant_id', tenantId).in('id', ids.slice(offset, offset + 100))
    if (error) {
      if (['PGRST200', 'PGRST205', '42P01'].includes(error.code)) throw new Error('Account-holder routing is not set up in the contacts database. Ask the account owner to apply Student Accounts Migration 001 before sending. No messages were sent.')
      throw new Error('Recipients could not be verified. Please try again.')
    }
    contacts.push(...(data || []) as RecipientContact[])
  }
  // Preserve existing SMS support for lead-only CRM contacts. Resolve them in
  // preview as well as send, instead of bypassing preview during transport.
  if (channel === 'sms') {
    const found = new Set(contacts.map(contact => contact.id))
    const missing = ids.filter(id => !found.has(id))
    for (let offset = 0; offset < missing.length; offset += 100) {
      const { data, error } = await crmSupabaseAdmin.from('crm_contacts')
        .select('id,first_name,last_name,full_name,phone').eq('tenant_id', tenantId).in('id', missing.slice(offset, offset + 100))
      if (error) throw new Error('Lead recipients could not be verified. Please try again.')
      contacts.push(...(data || []).map(contact => ({ id: contact.id,
        first_name: contact.first_name || contact.full_name?.split(/\s+/)[0] || '',
        last_name: contact.last_name || contact.full_name?.split(/\s+/).slice(1).join(' ') || '',
        phone: contact.phone, students: [],
      })))
    }
  }
  // Reject foreign/deleted IDs instead of silently reducing the audience.
  if (contacts.length !== ids.length) throw new Error('Some selected contacts are no longer available in this account. Refresh Contacts.')
  // Opt-outs suppress the destination even when another selected sibling uses
  // it, or the opted-out contact was not selected in this operation.
  const suppressed: RecipientContact[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('people')
      .select('id,email,phone,opted_out,students(accounts(email,phone),student_accounts(accounts(email,phone)))')
      .eq('tenant_id', tenantId).eq('opted_out', true).order('id').range(offset, offset + 499)
    if (error) throw new Error('Messaging opt-outs could not be verified.')
    suppressed.push(...(data || []) as RecipientContact[])
    if ((data || []).length < 500) break
  }
  return resolveCommunicationRecipients(contacts, channel, suppressed)
}

export function recipientVersion(resolution: RecipientResolution) {
  return createHash('sha256').update(JSON.stringify(resolution)).digest('hex')
}