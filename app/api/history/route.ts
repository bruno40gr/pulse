import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

    // For each campaign get message stats
    const enriched = await Promise.all((campaigns || []).map(async (campaign) => {
      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('id, status, direction, contact_id')
        .eq('campaign_id', campaign.id)
        .eq('tenant_id', tenantId)

      const outbound = messages?.filter(m => m.direction === 'outbound') || []
      const delivered = outbound.filter(m => ['delivered', 'sent'].includes(m.status)).length
      const failed = outbound.filter(m => m.status === 'failed').length
      const pending = outbound.filter(m => ['queued', 'sending', 'accepted'].includes(m.status)).length

      const inbound = messages?.filter(m => m.direction === 'inbound') || []
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
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}