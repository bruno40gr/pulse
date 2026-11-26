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
    const requestedLimit = Number(url.searchParams.get('limit') || 30)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 30
    const offset = Number(url.searchParams.get('offset') || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + limit)) return NextResponse.json({ error: 'Invalid notification offset.' }, { status: 400 })
    const history = url.searchParams.get('history') === 'true'
    const mentions = url.searchParams.get('mentions') === 'true'
    let list = supabaseAdmin.from('notifications')
      .select('id, reason, entity_type, entity_id, title, body, link, read_at, dismissed_at, created_at, actor_membership_id')
      .eq('tenant_id', tenantId)
      .eq('recipient_membership_id', context.context.membershipId)
    if (!history) list = list.is('dismissed_at', null)
    if (mentions) list = list.eq('reason', 'mention.created')

    const [listResult, unreadResult] = await Promise.all([
      list.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit),
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('recipient_membership_id', context.context.membershipId)
        .is('read_at', null)
        .is('dismissed_at', null),
    ])
    const { data, error } = listResult
    if (error) throw error
    if (unreadResult.error) throw unreadResult.error
    const hasMore = (data || []).length > limit
    const notifications = (data || []).slice(0, limit)
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
      has_more: hasMore,
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
    const action = body.action || 'dismiss'
    if (!['seen', 'dismiss'].includes(action) || (action === 'seen' && body.all === true)) {
      return NextResponse.json({ error: 'Invalid notification action.' }, { status: 400 })
    }
    if (body.all !== true && typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 })
    }
    let query = supabaseAdmin
      .from('notifications')
      .update(action === 'seen' ? { read_at: new Date().toISOString() } : { dismissed_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('recipient_membership_id', context.context.membershipId)
    if (action === 'dismiss') query = query.is('dismissed_at', null)
    if (action === 'seen') query = query.is('read_at', null)
    if (body.all !== true) {
      query = query.eq('id', body.id)
    }
    const { error } = await query
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}