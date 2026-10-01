// Register this webhook in Twilio Console:
// Phone Numbers → Manage → 916-891-1212 → Messaging → Webhook URL
// Set to: https://your-vercel-domain.vercel.app/api/twilio/webhook
// Method: HTTP POST

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  const twiml = () => new NextResponse('<Response><!-- pulse-webhook-v2 --></Response>', { headers: { 'Content-Type': 'text/xml' } })

  try {
    const formData = await request.formData()
    const from = (formData.get('From') as string) || ''
    const to = (formData.get('To') as string) || ''
    const body = (formData.get('Body') as string) || ''
    const messageSid = (formData.get('MessageSid') as string) || ''

    console.log('[twilio-webhook] hit', { from, to, body, messageSid })

    if (!from || !body) return twiml()

    // Phone numbers may be stored as 10-digit ("5754158066") or E.164 ("+15754158066").
    // Normalize to a bare 10-digit form so the sender can be matched to a contact either way.
    const fromDigits = (from || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')

    // Resolve the sender to a contact: first by the most recent outbound message to this phone,
    // then by matching the phone number on `people`.
    let contactId: string | null = null

    const { data: previousMessage } = await supabaseAdmin
      .from('messages')
      .select('contact_id, campaign_id')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('direction', 'outbound')
      .or(`to_phone.eq.${from},to_phone.eq.${fromDigits}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousMessage?.contact_id) {
      contactId = previousMessage.contact_id
    } else {
      const { data: person } = await supabaseAdmin
        .from('people')
        .select('id')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .or(`phone.eq.${from},phone.eq.${fromDigits}`)
        .limit(1)
        .maybeSingle()
      if (person?.id) contactId = person.id
    }

    // STOP / START opt-out handling
    const bodyUpper = body.trim().toUpperCase()
    if (contactId && bodyUpper === 'STOP') {
      await supabaseAdmin.from('people').update({ opted_out: true }).eq('id', contactId)
    }
    if (contactId && bodyUpper === 'START') {
      await supabaseAdmin.from('people').update({ opted_out: false }).eq('id', contactId)
    }

    // Store the inbound message. messages.contact_id may still have an FK to the legacy
    // `contacts` table; fall back to null so the message is always recorded.
    const messageRow = {
      tenant_id: DEFAULT_TENANT_ID,
      campaign_id: previousMessage?.campaign_id || null,
      contact_id: contactId,
      direction: 'inbound',
      channel: 'sms',
      body,
      status: 'received',
      twilio_sid: messageSid,
      from_phone: from,
      to_phone: to,
    }
    const { error: insertError } = await supabaseAdmin.from('messages').insert(messageRow)
    if (insertError) {
      console.error('[twilio-webhook] insert error', insertError)
      if (insertError.code !== '23503') throw insertError
      const { error: fallbackError } = await supabaseAdmin.from('messages').insert({ ...messageRow, contact_id: null })
      if (fallbackError) throw fallbackError
    } else {
      console.log('[twilio-webhook] stored', messageSid)
    }

    const { data: crmContact } = await crmSupabaseAdmin
      .from('crm_contacts')
      .select('id')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .or(`phone.eq.${from},phone.eq.${fromDigits}`)
      .limit(1)
      .maybeSingle()
    if (crmContact?.id) {
      const { data: outboundEvent } = await crmSupabaseAdmin
        .from('lead_events')
        .select('lead_intake_id')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .eq('contact_id', crmContact.id)
        .eq('event_type', 'outbound_sms')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: fallbackLead } = outboundEvent?.lead_intake_id ? { data: null } : await crmSupabaseAdmin
        .from('lead_intakes')
        .select('id')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .eq('contact_id', crmContact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const leadId = outboundEvent?.lead_intake_id || fallbackLead?.id
      if (leadId) {
        await crmSupabaseAdmin.from('lead_events').insert({
          tenant_id: DEFAULT_TENANT_ID,
          lead_intake_id: leadId,
          contact_id: crmContact.id,
          event_type: 'inbound_sms',
          event_label: 'Lead replied by text',
          payload: { twilio_sid: messageSid },
        })
      }
    }

    return twiml()
  } catch (error) {
    console.error('[twilio-webhook] error', error)
    return twiml()
  }
}