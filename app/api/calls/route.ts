import { NextResponse } from 'next/server'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { authorizeCommunicationSend } from '@/lib/communication-authorization'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { crmCallbackCaptureEnabled } from '@/lib/crm-callback-mode'
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
    const authorization = await authorizeCommunicationSend(request, DEFAULT_TENANT_ID)
    if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status })
    const { tenantId } = authorization
    const actorPersonId = authorization.demo ? authorization.actor.personId : authorization.context.personId

    // Freeze new calls during capture: no provider side effects while CRM is copied.
    if (crmCallbackCaptureEnabled()) {
      return NextResponse.json({ error: 'Calls are temporarily paused for maintenance.' }, { status: 503 })
    }

    const { to_phone, contact_id, lead_id } = await request.json()
    if (typeof to_phone !== 'string' || !/^\+[1-9][0-9]{6,14}$/.test(toE164(to_phone))) {
      return NextResponse.json({ error: 'A valid phone number to call is required' }, { status: 400 })
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if ((lead_id != null && (typeof lead_id !== 'string' || !uuid.test(lead_id)))
      || (contact_id != null && (typeof contact_id !== 'string' || !uuid.test(contact_id)))) {
      return NextResponse.json({ error: 'Invalid call record identifier.' }, { status: 400 })
    }
    let crmContactId: string | null = null
    if (lead_id) {
      const { data: lead, error } = await crmSupabaseAdmin.from('lead_intakes')
        .select('id, contact_id').eq('tenant_id', tenantId).eq('id', lead_id).maybeSingle()
      if (error) throw error
      if (!lead || (contact_id && contact_id !== lead.contact_id)) {
        return NextResponse.json({ error: 'Call inquiry not found.' }, { status: 404 })
      }
      const { data: contact, error: contactError } = await crmSupabaseAdmin.from('crm_contacts')
        .select('id').eq('tenant_id', tenantId).eq('id', lead.contact_id).maybeSingle()
      if (contactError) throw contactError
      if (!contact) return NextResponse.json({ error: 'Call contact not found.' }, { status: 404 })
      crmContactId = contact.id
    } else if (contact_id) {
      // Contact-panel calls use people IDs; application calls may use CRM IDs.
      const { data: person, error } = await supabaseAdmin.from('people').select('id')
        .eq('tenant_id', tenantId).eq('id', contact_id).maybeSingle()
      if (error) throw error
      if (!person) {
        const { data: contact, error: contactError } = await crmSupabaseAdmin.from('crm_contacts')
          .select('id').eq('tenant_id', tenantId).eq('id', contact_id).maybeSingle()
        if (contactError) throw contactError
        if (!contact) return NextResponse.json({ error: 'Call contact not found.' }, { status: 404 })
      }
    }

    const eventPayload = (agentPhone: string | null) => ({
      tenant_id: tenantId,
      lead_intake_id: lead_id || null,
      contact_id: crmContactId,
      event_type: 'call_started',
      event_label: 'Call placed',
      payload: {
        to_phone,
        agent_phone: agentPhone,
        actor: authorization.demo
          ? {
              instructorId: authorization.actor.instructorId,
              personId: actorPersonId,
              displayName: authorization.actor.displayName,
            }
          : { membershipId: authorization.context.membershipId, personId: actorPersonId },
      },
    })

    // Demo mode — simulate the call without hitting Twilio.
    if (authorization.demo) {
      if (lead_id) {
        const { error } = await crmSupabaseAdmin.from('lead_events').insert(eventPayload(null))
        if (error) throw error
      }
      return NextResponse.json({ success: true, demo: true })
    }

    // Resolve the caller (logged-in staff member) — Twilio rings this number first,
    // then bridges to the lead, so the lead sees the business number as caller ID.
    const { data: person, error: personError } = await supabaseAdmin
      .from('people')
      .select('phone')
      .eq('id', actorPersonId)
      .eq('tenant_id', tenantId)
      .single()
    if (personError) throw personError

    const agentPhone = person?.phone
    if (!agentPhone) {
      return NextResponse.json({ error: 'Add your phone number to your staff profile before making calls.' }, { status: 400 })
    }

    const { data: twilioConfig, error: configError } = await supabaseAdmin
      .from('twilio_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()
    if (configError) throw configError

    if (!twilioConfig) return NextResponse.json({ error: 'Twilio not configured' }, { status: 400 })

    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token)
    const businessNumber = toE164(twilioConfig.phone_number)
    const origin = process.env.PULSE_APP_URL?.trim().replace(/\/$/, '') || new URL(request.url).origin

    const call = await client.calls.create({
      to: toE164(agentPhone),
      from: businessNumber,
      twiml: `<Response><Dial callerId="${businessNumber}"><Number>${toE164(to_phone)}</Number></Dial></Response>`,
      ...(lead_id ? {
        statusCallback: `${origin}/api/calls/status`,
        statusCallbackEvent: ['completed'],
        statusCallbackMethod: 'POST',
      } : {}),
    })

    let historyRecorded = true
    if (lead_id) {
      const { error: historyError } = await crmSupabaseAdmin.from('lead_events').insert({
        ...eventPayload(agentPhone),
        payload: { ...eventPayload(agentPhone).payload, call_sid: call.sid, status: call.status },
      })
      historyRecorded = !historyError
      if (historyError) console.error('[calls] provider call started but history persistence failed')
    }

    const auditRecorded = await writeAccountAuditEvent({
      tenantId,
      actorMembershipId: authorization.context.membershipId,
      eventType: 'communications.call_started',
      metadata: {
        contact_id: contact_id || null,
        lead_id: lead_id || null,
      },
    })

    // The call already exists. Do not invite a retry that creates another call.
    return NextResponse.json({ success: true, sid: call.sid, status: call.status, auditRecorded, historyRecorded })
  } catch {
    return NextResponse.json({ error: 'Could not place call.' }, { status: 500 })
  }
}
