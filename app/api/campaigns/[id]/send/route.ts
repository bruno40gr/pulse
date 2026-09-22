import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isDemo } from '@/lib/demo'
import twilio from 'twilio'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = getTenantId(request)
  const { id } = await params
  try {
    const { recipientIds } = await request.json()
    if (!recipientIds?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

    // Demo mode — simulate delivery without hitting Twilio
    const demoMode = await isDemo(tenantId)
    if (demoMode) {
      const { data: contacts } = await supabaseAdmin
        .from('people')
        .select('id, first_name, last_name')
        .in('id', recipientIds)
        .eq('opted_out', false)

      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('message')
        .eq('id', id)
        .single()

      const fakeMessages = (contacts || []).map(contact => ({
        tenant_id: tenantId,
        campaign_id: id,
        contact_id: contact.id,
        direction: 'outbound',
        channel: 'sms',
        body: (campaign?.message || '').replace(/\{first_name\}/gi, contact.first_name),
        status: 'delivered',
        twilio_sid: `DEMO_${Date.now()}_${contact.id}`,
        to_phone: null,
        from_phone: null,
      }))

      if (fakeMessages.length > 0) {
        await supabaseAdmin.from('messages').insert(fakeMessages)
      }

      await supabaseAdmin
        .from('campaigns')
        .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: fakeMessages.length })
        .eq('id', id)

      return NextResponse.json({ sent: fakeMessages.length, failed: 0, demo: true })
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()
    if (campaignError) throw campaignError

    // Get Twilio config for tenant
    const { data: twilioConfig, error: twilioError } = await supabaseAdmin
      .from('twilio_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()
    if (twilioError || !twilioConfig) {
      return NextResponse.json({ error: 'Twilio not configured. Please connect Twilio in Settings.' }, { status: 400 })
    }

    // Get contacts from new schema
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('people')
      .select(`
        id, first_name, last_name, phone,
        students (
          message_routing, is_minor,
          accounts ( phone )
        )
      `)
      .in('id', recipientIds)
      .eq('opted_out', false)
    if (contactsError) throw contactsError

    function resolvePhone(person: any): string | null {
      const student = person.students?.[0] || {}
      const accountPhone = student.accounts?.phone || null
      const routing = student.is_minor ? 'account_holder' : (student.message_routing || 'account_holder')

      if (routing === 'student') return person.phone || accountPhone
      if (routing === 'account_holder') return accountPhone || person.phone
      return person.phone || accountPhone
    }

    // Partition recipients into "sendable" (has a resolvable phone) vs "missing phone"
    // so we surface a clear error instead of silently marking the campaign "sent" with 0 deliveries.
    const missingPhone = (contacts || []).filter(c => !resolvePhone(c))
    const sendable = (contacts || []).filter(c => resolvePhone(c))

    if (sendable.length === 0) {
      await supabaseAdmin
        .from('campaigns')
        .update({ status: 'failed', recipient_count: 0 })
        .eq('id', id)

      return NextResponse.json({
        error: 'No recipients have a phone number on file. Add a phone number before sending.',
        skipped: missingPhone.length,
      }, { status: 422 })
    }

    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token)
    const results = await Promise.allSettled(
      sendable.map(async (contact) => {
        const toPhone = resolvePhone(contact)
        const body = campaign.message.replace(/\{first_name\}/gi, contact.first_name)
        const messageParams: any = {
          body,
          from: twilioConfig.phone_number,
          to: toPhone,
        }
        if (campaign.media_url) messageParams.mediaUrl = [campaign.media_url]

        const msg = await client.messages.create(messageParams)

        // Twilio accepts the request even when delivery fails (e.g. unregistered A2P 10DLC),
        // so treat terminal failure statuses as non-delivery instead of a fake success.
        const failedStatus = msg.status === 'undelivered' || msg.status === 'failed'
        const errorMessage = [msg.errorCode, msg.errorMessage].filter(Boolean).join(' ') || null

        const messageRow = {
          tenant_id: tenantId,
          campaign_id: campaign.id,
          contact_id: contact.id,
          direction: 'outbound',
          channel: 'sms',
          body,
          media_url: campaign.media_url || null,
          status: msg.status || 'sent',
          error_message: errorMessage,
          twilio_sid: msg.sid,
          to_phone: toPhone,
          from_phone: twilioConfig.phone_number,
        }

        // messages.contact_id still has an FK to the legacy `contacts` table; fall back to
        // null when the person isn't present there so the message is still recorded.
        const { error: insertError } = await supabaseAdmin.from('messages').insert(messageRow)
        if (insertError) {
          await supabaseAdmin.from('messages').insert({ ...messageRow, contact_id: null })
        }

        await new Promise(r => setTimeout(r, 50))
        return { delivered: !failedStatus, errorMessage }
      })
    )

    const delivered = results.filter(r => r.status === 'fulfilled' && r.value?.delivered).length
    const rejected = results.filter(r => r.status === 'rejected').length
    const undelivered = results.filter(r => r.status === 'fulfilled' && !r.value?.delivered).length
    const failed = rejected + undelivered

    if (delivered === 0) {
      let firstError: string | null = null
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (!r.value.delivered && r.value.errorMessage) { firstError = r.value.errorMessage; break }
        } else if (r.reason && typeof r.reason === 'object' && 'message' in r.reason) {
          firstError = (r.reason as any).message; break
        }
      }

      await supabaseAdmin
        .from('campaigns')
        .update({ status: 'failed', recipient_count: 0 })
        .eq('id', id)

      return NextResponse.json({
        error: firstError
          ? `Message not delivered: ${firstError}`
          : 'Message could not be delivered. Check your Twilio number registration (A2P 10DLC).',
        sent: 0,
        failed,
        missing_phone: missingPhone.length,
      }, { status: 502 })
    }

    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: delivered })
      .eq('id', id)

    return NextResponse.json({ ok: true, sent: delivered, failed, missing_phone: missingPhone.length })
  } catch (error) {
    console.error('Send error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}