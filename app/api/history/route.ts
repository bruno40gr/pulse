import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { attributeInboundMessagesToCampaigns } from '@/lib/campaign-message-attribution'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)

    // Get all campaigns
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, campaign_id, status, direction, contact_id, to_phone, from_phone, created_at')
      .eq('tenant_id', tenantId)
    if (messagesError) throw messagesError

    const campaignByInboundMessageId = attributeInboundMessagesToCampaigns(messages || [])

    const enriched = (campaigns || []).map((campaign) => {
      const campaignMessages = (messages || []).filter(message =>
        message.campaign_id === campaign.id || campaignByInboundMessageId.get(message.id) === campaign.id
      )

      const outbound = campaignMessages.filter(m => m.direction === 'outbound')
      const delivered = outbound.filter(m => ['delivered', 'read'].includes(m.status)).length
      const failed = outbound.filter(m => ['failed', 'undelivered', 'canceled'].includes(m.status)).length
      const pending = outbound.filter(m => ['queued', 'scheduled', 'sending', 'accepted', 'sent'].includes(m.status)).length

      const inbound = campaignMessages.filter(m => m.direction === 'inbound')
      const replies = inbound.length

      const uniqueContacts = new Set(outbound.map(m => m.contact_id)).size

      return {
        ...campaign,
        stats: {
          total: uniqueContacts,
          delivered,
          failed,
          pending,
          replies,
          delivery_rate: uniqueContacts > 0 ? Math.round((delivered / uniqueContacts) * 100) : 0,
        }
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}