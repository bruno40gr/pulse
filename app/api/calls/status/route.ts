import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import twilio from 'twilio'
import { crmCallbackCaptureEnabled } from '@/lib/crm-callback-mode'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

function formatCallStatus(status: string): string {
  switch (status) {
    case 'completed': return 'Call completed'
    case 'busy': return 'Call busy'
    case 'no-answer': return 'Call not answered'
    case 'failed': return 'Call failed'
    case 'canceled': return 'Call canceled'
    default: return `Call ${status}`
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = (formData.get('CallSid') as string) || ''
    const callStatus = (formData.get('CallStatus') as string) || ''
    const duration = (formData.get('CallDuration') as string) || ''
    const fromPhone = String(formData.get('From') || '')
    const accountSid = String(formData.get('AccountSid') || '')
    const sequence = String(formData.get('SequenceNumber') || '')
    const signature = request.headers.get('x-twilio-signature') || ''

    if (!signature) return NextResponse.json({ error: 'Invalid Twilio signature.' }, { status: 403 })
    if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)
      || !['queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled'].includes(callStatus)
      || !/^\+[1-9][0-9]{6,14}$/.test(fromPhone)
      || (duration !== '' && !/^[0-9]{1,9}$/.test(duration))
      || !/^[0-9]{1,9}$/.test(sequence)) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const { data: config, error: configError } = await supabaseAdmin.from('twilio_config')
      .select('tenant_id, auth_token, account_sid').eq('phone_number', fromPhone).maybeSingle()
    if (configError) throw configError
    if (!config?.tenant_id || !config.auth_token || config.account_sid !== accountSid) {
      return NextResponse.json({ error: 'Unknown call account.' }, { status: 403 })
    }
    const url = new URL(request.url)
    const signedUrl = `${process.env.PULSE_APP_URL?.trim().replace(/\/$/, '') || url.origin}${url.pathname}${url.search}`
    const params = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]))
    if (!twilio.validateRequest(config.auth_token, signature, signedUrl, params)) {
      return NextResponse.json({ error: 'Invalid Twilio signature.' }, { status: 403 })
    }
    if (crmCallbackCaptureEnabled()) {
      const { data: queueId, error } = await supabaseAdmin.rpc('odeon_crm_capture', {
        p_tenant_id: config.tenant_id, p_kind: 'voice_status',
        p_delivery_key: `${callSid}:${Number(sequence)}`,
        p_payload: { call_sid: callSid, status: callStatus,
          duration: duration ? Number(duration) : null, sequence: Number(sequence) },
      })
      if (error || typeof queueId !== 'string') throw new Error('Voice capture failed')
      return NextResponse.json({ success: true, queued: true })
    }

    // Find the lead_event we logged when the call was placed, keyed by its call SID.
    const { data: events, error: findError } = await crmSupabaseAdmin
      .from('lead_events')
      .select('id, payload')
      .eq('tenant_id', config.tenant_id)
      .eq('payload->>call_sid', callSid)
      .eq('event_type', 'call_started')
      .limit(2)

    if (findError) throw findError
    if (!events || events.length !== 1) throw new Error('Call history unresolved')

    const event = events[0]
    const existingPayload = (event.payload && typeof event.payload === 'object') ? event.payload : {}

    const { error: updateError } = await crmSupabaseAdmin
      .from('lead_events')
      .update({
        event_label: formatCallStatus(callStatus),
        payload: { ...existingPayload, status: callStatus, duration: duration ? Number(duration) : null },
      })
      .eq('id', event.id)
      .eq('tenant_id', config.tenant_id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Could not preserve call status.' }, { status: 503 })
  }
}
