// Register this webhook in Twilio Console:
// Phone Numbers → Manage → 916-891-1212 → Messaging → Webhook URL
// Set to: https://your-vercel-domain.vercel.app/api/twilio/webhook
// Method: HTTP POST

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import twilio from 'twilio'
import { crmCallbackCaptureEnabled } from '@/lib/crm-callback-mode'

export async function POST(request: Request) {
  const twiml = () => new NextResponse('<Response><!-- pulse-webhook-v2 --></Response>', { headers: { 'Content-Type': 'text/xml' } })

  try {
    const formData = await request.formData()
    const from = (formData.get('From') as string) || ''
    const to = (formData.get('To') as string) || ''
    const body = (formData.get('Body') as string) || ''
    const messageSid = (formData.get('MessageSid') as string) || ''

    const signature = request.headers.get('x-twilio-signature') || ''
    if (!signature) return NextResponse.json({ error: 'Invalid Twilio signature.' }, { status: 403 })
    if (!/^\+[1-9][0-9]{6,14}$/.test(from) || !/^\+[1-9][0-9]{6,14}$/.test(to)
      || !/^SM[0-9a-fA-F]{32}$/.test(messageSid)) {
      return NextResponse.json({ error: 'Invalid SMS parameters.' }, { status: 400 })
    }
    const { data: config, error: configError } = await supabaseAdmin
      .from('twilio_config').select('tenant_id, auth_token').eq('phone_number', to).maybeSingle()
    if (configError) throw configError
    if (!config?.tenant_id || !config.auth_token) {
      return NextResponse.json({ error: 'Unknown receiving number.' }, { status: 403 })
    }
    const url = new URL(request.url)
    const signedUrl = `${process.env.PULSE_APP_URL?.trim().replace(/\/$/, '') || url.origin}${url.pathname}${url.search}`
    const params = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]))
    if (!twilio.validateRequest(config.auth_token, signature, signedUrl, params)) {
      return NextResponse.json({ error: 'Invalid Twilio signature.' }, { status: 403 })
    }
    const tenantId = config.tenant_id

    // Enable only after installing 11-sms-reliability.sql. Remains enabled after
    // CRM cutover: inbox delivery must not depend on CRM availability.
    const durableSms = process.env.ODEON_DURABLE_SMS?.trim()
    if (durableSms && durableSms !== 'enabled') throw new Error('Invalid durable SMS configuration')
    if (durableSms === 'enabled') {
      const { data: outcome, error } = await supabaseAdmin.rpc('odeon_sms_receive', {
        p_tenant_id: tenantId,
        p_payload: { message_sid: messageSid, from_phone: from, to_phone: to, body },
      })
      if (error || !['saved', 'existing', 'deleted'].includes(outcome)) throw new Error('SMS receipt failed')
      return twiml()
    }

    if (crmCallbackCaptureEnabled()) {
      // Install draft RPCs and rehearse drain/abort before enabling this mode.
      const { data: queueId, error: captureError } = await supabaseAdmin.rpc('odeon_crm_capture', {
        p_tenant_id: tenantId, p_kind: 'inbound_sms', p_delivery_key: messageSid,
        p_payload: { message_sid: messageSid, from_phone: from, to_phone: to, body },
      })
      if (captureError || typeof queueId !== 'string') throw new Error('SMS capture failed')
      const { error: persistError } = await supabaseAdmin.rpc('odeon_crm_persist_captured_sms', { p_queue_id: queueId })
      if (persistError) throw new Error('SMS persistence pending')
      // CRM history stays durably pending, not falsely marked complete here.
      return twiml()
    }

    // Phone numbers may be stored as 10-digit ("5754158066") or E.164 ("+15754158066").
    // Normalize to a bare 10-digit form so the sender can be matched to a contact either way.
    const fromDigits = (from || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')

    // Resolve the sender to a contact: first by the most recent outbound message to this phone,
    // then by matching the phone number on `people`.
    let contactId: string | null = null

    const { data: previousMessage, error: previousError } = await supabaseAdmin
      .from('messages')
      .select('contact_id, campaign_id')
      .eq('tenant_id', tenantId)
      .eq('direction', 'outbound')
      .or(`to_phone.eq.${from},to_phone.eq.${fromDigits}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousError) throw previousError

    if (previousMessage?.contact_id) {
      contactId = previousMessage.contact_id
    } else {
      const { data: person, error: personError } = await supabaseAdmin
        .from('people')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${from},phone.eq.${fromDigits}`)
        .limit(1)
        .maybeSingle()
      if (personError) throw personError
      if (person?.id) contactId = person.id
    }

    // STOP / START opt-out handling
    const bodyUpper = body.trim().toUpperCase()
    if (contactId && bodyUpper === 'STOP') {
      const { error } = await supabaseAdmin.from('people').update({ opted_out: true }).eq('tenant_id', tenantId).eq('id', contactId)
      if (error) throw error
    }
    if (contactId && bodyUpper === 'START') {
      const { error } = await supabaseAdmin.from('people').update({ opted_out: false }).eq('tenant_id', tenantId).eq('id', contactId)
      if (error) throw error
    }

    // Store the inbound message. messages.contact_id may still have an FK to the legacy
    // `contacts` table; fall back to null so the message is always recorded.
    const messageRow = {
      tenant_id: tenantId,
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
      if (insertError.code !== '23503') throw insertError
      const { error: fallbackError } = await supabaseAdmin.from('messages').insert({ ...messageRow, contact_id: null })
      if (fallbackError) throw fallbackError
    }

    const { data: crmContact, error: crmContactError } = await crmSupabaseAdmin
      .from('crm_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${from},phone.eq.${fromDigits}`)
      .limit(1)
      .maybeSingle()
    if (crmContactError) throw crmContactError
    if (crmContact?.id) {
      const { data: outboundEvent, error: outboundError } = await crmSupabaseAdmin
        .from('lead_events')
        .select('lead_intake_id')
        .eq('tenant_id', tenantId)
        .eq('contact_id', crmContact.id)
        .eq('event_type', 'outbound_sms')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (outboundError) throw outboundError
      const { data: fallbackLead, error: fallbackLeadError } = outboundEvent?.lead_intake_id ? { data: null, error: null } : await crmSupabaseAdmin
        .from('lead_intakes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('contact_id', crmContact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (fallbackLeadError) throw fallbackLeadError
      const leadId = outboundEvent?.lead_intake_id || fallbackLead?.id
      if (leadId) {
        const { error: historyError } = await crmSupabaseAdmin.from('lead_events').insert({
          tenant_id: tenantId,
          lead_intake_id: leadId,
          contact_id: crmContact.id,
          event_type: 'inbound_sms',
          event_label: 'Lead replied by text',
          payload: { twilio_sid: messageSid },
        })
        if (historyError) throw historyError
      }
    }

    return twiml()
  } catch {
    console.error('[twilio-webhook] processing failed')
    return NextResponse.json({ error: 'Could not process inbound message.' }, { status: 503 })
  }
}