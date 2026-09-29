import { NextResponse } from 'next/server'
import { shouldAdvanceMessageStatus } from '@/lib/message-status'
import { supabaseAdmin } from '@/lib/supabase/admin'
import twilio from 'twilio'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const messageSid = String(formData.get('MessageSid') || formData.get('SmsSid') || '').trim()
    const messageStatus = String(formData.get('MessageStatus') || formData.get('SmsStatus') || '').trim().toLowerCase()
    const errorCode = String(formData.get('ErrorCode') || '').trim()
    const errorMessage = String(formData.get('ErrorMessage') || '').trim()
    const fromPhone = String(formData.get('From') || '').trim()

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ success: false, error: 'MessageSid and MessageStatus are required.' }, { status: 400 })
    }

    const signature = request.headers.get('x-twilio-signature') || ''
    const { data: twilioConfig, error: configError } = await supabaseAdmin
      .from('twilio_config')
      .select('tenant_id, auth_token')
      .eq('phone_number', fromPhone)
      .maybeSingle()
    if (configError) throw configError
    if (!twilioConfig?.auth_token) return NextResponse.json({ error: 'Unknown sending number.' }, { status: 403 })
    const signedUrl = `${process.env.PULSE_APP_URL?.trim().replace(/\/$/, '') || new URL(request.url).origin}/api/twilio/status`
    const params = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]))
    if (!twilio.validateRequest(twilioConfig.auth_token, signature, signedUrl, params)) {
      return NextResponse.json({ error: 'Invalid Twilio signature.' }, { status: 403 })
    }

    const { data: message, error: findError } = await supabaseAdmin
      .from('messages')
      .select('id, status')
      .eq('tenant_id', twilioConfig.tenant_id)
      .eq('twilio_sid', messageSid)
      .maybeSingle()
    if (findError) throw findError
    if (!message) return NextResponse.json({ error: 'Message is not persisted yet.' }, { status: 503, headers: { 'Retry-After': '2' } })
    if (!shouldAdvanceMessageStatus(message.status, messageStatus)) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const failure = [errorCode, errorMessage].filter(Boolean).join(' ') || null
    const { error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ status: messageStatus, error_message: failure })
      .eq('id', message.id)
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[twilio-status] error', error)
    return NextResponse.json({ error: 'Could not update message status.' }, { status: 500 })
  }
}