// Register this webhook in Twilio Console:
// Phone Numbers → Manage → 916-891-1212 → Messaging → Webhook URL
// Set to: https://your-vercel-domain.vercel.app/api/twilio/webhook
// Method: HTTP POST

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Match inbound to a contact by finding the most recent outbound message
    // sent TO this phone number FROM our Twilio number
    const { data: previousMessage } = await supabaseAdmin
      .from('messages')
      .select('contact_id, to_phone')
      .eq('to_phone', from)
      .eq('from_phone', to)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const contactId = previousMessage?.contact_id || null

    if (contactId) {
      const bodyUpper = body.trim().toUpperCase()

      if (bodyUpper === 'STOP') {
        await supabaseAdmin
          .from('people')
          .update({ opted_out: true })
          .eq('id', contactId)
      }

      if (bodyUpper === 'START') {
        await supabaseAdmin
          .from('people')
          .update({ opted_out: false })
          .eq('id', contactId)
      }

      await supabaseAdmin.from('messages').insert({
        tenant_id: DEFAULT_TENANT_ID,
        contact_id: contactId,
        direction: 'inbound',
        channel: 'sms',
        body,
        status: 'received',
        twilio_sid: messageSid,
        from_phone: from,
        to_phone: to,
      })
    }

    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}