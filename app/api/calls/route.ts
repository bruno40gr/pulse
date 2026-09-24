import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isDemo } from '@/lib/demo'
import { getRequestActor } from '@/lib/access'
import twilio from 'twilio'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function toE164(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
    const actor = await getRequestActor(request)
    if (!actor) return NextResponse.json({ error: 'Pulse access required.' }, { status: 401 })

    const { to_phone, contact_id, lead_id } = await request.json()
    if (!to_phone) return NextResponse.json({ error: 'A phone number to call is required' }, { status: 400 })

    const eventPayload = (agentPhone: string | null) => ({
      tenant_id: tenantId,
      lead_intake_id: lead_id || null,
      contact_id: contact_id || null,
      event_type: 'call_started',
      event_label: 'Call placed',
      payload: {
        to_phone,
        agent_phone: agentPhone,
        actor: { instructorId: actor.instructorId, personId: actor.personId, displayName: actor.displayName },
      },
    })

    // Demo mode — simulate the call without hitting Twilio.
    const demoMode = await isDemo(tenantId)
    if (demoMode) {
      if (lead_id) await supabaseAdmin.from('lead_events').insert(eventPayload(null))
      return NextResponse.json({ success: true, demo: true })
    }

    // Resolve the caller (logged-in staff member) — Twilio rings this number first,
    // then bridges to the lead, so the lead sees the business number as caller ID.
    const { data: person } = await supabaseAdmin
      .from('people')
      .select('phone')
      .eq('id', actor.personId)
      .single()

    const agentPhone = person?.phone
    if (!agentPhone) {
      return NextResponse.json({ error: 'Add your phone number to your staff profile before making calls.' }, { status: 400 })
    }

    const { data: twilioConfig } = await supabaseAdmin
      .from('twilio_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!twilioConfig) return NextResponse.json({ error: 'Twilio not configured' }, { status: 400 })

    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token)
    const businessNumber = toE164(twilioConfig.phone_number)
    const origin = new URL(request.url).origin

    const call = await client.calls.create({
      to: toE164(agentPhone),
      from: businessNumber,
      twiml: `<Response><Dial callerId="${businessNumber}"><Number>${toE164(to_phone)}</Number></Dial></Response>`,
      statusCallback: `${origin}/api/calls/status`,
      statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer'],
      statusCallbackMethod: 'POST',
    })

    if (lead_id) {
      await supabaseAdmin.from('lead_events').insert({
        ...eventPayload(agentPhone),
        payload: { ...eventPayload(agentPhone).payload, call_sid: call.sid, status: call.status },
      })
    }

    return NextResponse.json({ success: true, sid: call.sid, status: call.status })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
