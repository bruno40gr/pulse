import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import twilio from 'twilio'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const tenantId = getTenantId(request)
  try {
    const { recipientIds } = await request.json()
    if (!recipientIds?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
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

    // Get contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, phone, account_holder_phone, message_routing, is_minor')
      .in('id', recipientIds)
      .eq('opted_out', false)
    if (contactsError) throw contactsError

    function resolvePhone(contact: any, sendTo?: string): string | null {
      const routing = contact.is_minor ? 'account_holder' : (contact.message_routing || 'account_holder')

      if (routing === 'student') {
        return contact.phone || contact.account_holder_phone || null
      }
      if (routing === 'account_holder') {
        return contact.account_holder_phone || contact.phone || null
      }
      if (routing === 'account_holder_fallback') {
        return contact.account_holder_phone || contact.phone || null
      }
      return contact.phone || null
    }

    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token)
    const results = await Promise.allSettled(
      contacts
        .filter(c => resolvePhone(c))
        .map(async (contact) => {
          const toPhone = resolvePhone(contact)
          const body = campaign.message.replace(/\{first_name\}/gi, contact.first_name)
          const messageParams: any = {
            body,
            from: twilioConfig.phone_number,
            to: toPhone,
          }
          if (campaign.media_url) messageParams.mediaUrl = [campaign.media_url]

          const msg = await client.messages.create(messageParams)

          await supabaseAdmin.from('messages').insert({
            tenant_id: tenantId,
            campaign_id: campaign.id,
            contact_id: contact.id,
            direction: 'outbound',
            channel: 'sms',
            body,
            media_url: campaign.media_url || null,
            status: msg.status,
            twilio_sid: msg.sid,
          })

          await new Promise(r => setTimeout(r, 50))
          return msg
        })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: sent })
      .eq('id', campaign.id)

    return NextResponse.json({ sent, failed })
  } catch (error) {
    console.error('Send error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}