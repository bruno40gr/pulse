import { NextResponse } from 'next/server'
import { resolveMembershipRequestContext } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
    const context = await resolveMembershipRequestContext(request, tenantId)
    if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status })
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100)

    const [listResult, unreadResult] = await Promise.all([
      supabaseAdmin
        .from('notifications')
        .select('id, reason, entity_type, entity_id, title, body, link, read_at, created_at, actor_membership_id')
        .eq('tenant_id', tenantId)
        .eq('recipient_membership_id', context.context.membershipId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('recipient_membership_id', context.context.membershipId)
        .is('read_at', null),
    ])
    const { data, error } = listResult
    if (error) throw error
    if (unreadResult.error) throw unreadResult.error
    const notifications = data || []
    const actorIds = [...new Set(notifications.map((item) => item.actor_membership_id).filter((id): id is string => Boolean(id)))]
    const { data: actors, error: actorError } = actorIds.length
      ? await supabaseAdmin.from('tenant_memberships').select('id, person:people(first_name, last_name)').in('id', actorIds).eq('tenant_id', tenantId)
      : { data: [], error: null }
    if (actorError) throw actorError
    const actorMap = new Map((actors || []).map((actor) => {
      const value = actor.person as unknown
      const person = (Array.isArray(value) ? value[0] : value) as { first_name: string | null; last_name: string | null } | null
      return [actor.id, `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'A staff member']
    }))
    return NextResponse.json({
      notifications: notifications.map((item) => ({ ...item, actor_name: item.actor_membership_id ? actorMap.get(item.actor_membership_id) || 'A staff member' : 'A staff member' })),
      unread_count: unreadResult.count || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
    const context = await resolveMembershipRequestContext(request, tenantId)
    if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json()
    let query = supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('recipient_membership_id', context.context.membershipId)
    if (body.all !== true) {
      if (typeof body.id !== 'string') return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 })
      query = query.eq('id', body.id)
    } else {
      query = query.is('read_at', null)
    }
    const { error } = await query
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}