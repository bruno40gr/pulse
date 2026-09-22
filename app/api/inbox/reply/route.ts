import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isDemo } from '@/lib/demo'
import twilio from 'twilio'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
    const { contact_id, body, to_phone } = await request.json()

    if (!body?.trim() || !to_phone) {
      return NextResponse.json({ error: 'Body and to_phone are required' }, { status: 400 })
    }

    // Demo mode — simulate reply without hitting Twilio
    const demoMode = await isDemo(tenantId)
    if (demoMode) {
      await supabaseAdmin.from('messages').insert({
        tenant_id: tenantId,
        contact_id,
        direction: 'outbound',
        channel: 'sms',
        body,
        status: 'delivered',
        twilio_sid: `DEMO_${Date.now()}`,
        to_phone: to_phone,
        from_phone: null,
      })
      return NextResponse.json({ success: true, demo: true })
    }

    const { data: twilioConfig } = await supabaseAdmin
      .from('twilio_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!twilioConfig) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 400 })
    }

    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token)

    const msg = await client.messages.create({
      body,
      from: twilioConfig.phone_number,
      to: to_phone,
    })

    const failedStatus = msg.status === 'undelivered' || msg.status === 'failed'
    const errorMessage = [msg.errorCode, msg.errorMessage].filter(Boolean).join(' ') || null

    const messageRow = {
      tenant_id: tenantId,
      contact_id,
      direction: 'outbound',
      channel: 'sms',
      body,
      status: msg.status || 'sent',
      error_message: errorMessage,
      twilio_sid: msg.sid,
      to_phone: to_phone,
      from_phone: twilioConfig.phone_number,
    }

    // messages.contact_id still has an FK to the legacy `contacts` table; fall back to null
    // when the person isn't present there so the message is still recorded.
    const { error: insertError } = await supabaseAdmin.from('messages').insert(messageRow)
    if (insertError) {
      await supabaseAdmin.from('messages').insert({ ...messageRow, contact_id: null })
    }

    if (failedStatus) {
      return NextResponse.json({
        error: errorMessage
          ? `Message not delivered: ${errorMessage}`
          : 'Message could not be delivered. Check your Twilio number registration (A2P 10DLC).',
      }, { status: 502 })
    }

    return NextResponse.json({ success: true, sid: msg.sid })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}