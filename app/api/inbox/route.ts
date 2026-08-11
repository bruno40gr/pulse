import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

function getCampaignId(request: Request): string | null {
  const url = new URL(request.url)
  return url.searchParams.get('campaign_id') || null
}

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)

    // Step 1: Get all messages
    const campaignId = getCampaignId(request)
    let query = supabaseAdmin
      .from('messages')
      .select('id, body, direction, status, created_at, contact_id, to_phone, from_phone, campaign_id')
      .eq('tenant_id', tenantId)

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: messages, error: msgError } = await query
      .order('created_at', { ascending: false })

    if (msgError) throw msgError
    if (!messages || messages.length === 0) {
      return NextResponse.json([])
    }

    // Step 2: Get unique contact IDs and fetch people with students + accounts
    const contactIds = [...new Set(messages.map(m => m.contact_id).filter(Boolean))]
    const { data: people, error: peopleError } = await supabaseAdmin
      .from('people')
      .select(`
        id, first_name, last_name, phone, custom_fields,
        students (
          client_status, is_minor, message_routing, account_id,
          accounts ( id, name, phone, email )
        )
      `)
      .in('id', contactIds)
      .eq('tenant_id', tenantId)

    if (peopleError) throw peopleError

    // Build a lookup map: contact_id -> person data
    const personMap = new Map<string, any>()
    for (const p of people || []) {
      personMap.set(p.id, p)
    }

    // Step 3: Thread messages by contact_id + other_phone
    const threads = new Map<string, any>()

    for (const msg of messages) {
      const contactId = msg.contact_id
      if (!contactId) continue

      const otherPhone = msg.direction === 'outbound'
        ? msg.to_phone
        : msg.from_phone
      if (!otherPhone) continue

      const threadKey = `${contactId}::${otherPhone}`

      if (!threads.has(threadKey)) {
        const person = personMap.get(contactId)
        const student = person?.students?.[0] || {}
        const account = student?.accounts || {}

        // Determine who we're talking to on this phone number
        let displayName: string | null = null

        // 1. Check if the other phone matches the account phone (parent/guardian)
        if (account.phone && account.phone === otherPhone && account.name) {
          displayName = account.name.replace(' (account)', '').trim() || null
        }
        // 2. If otherPhone matches the student's own phone, display the student name
        if (!displayName && person?.phone === otherPhone) {
          displayName = `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || null
        }
        // 3. Fallback to student name
        if (!displayName) {
          displayName = `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unknown'
        }

        const studentName = `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unknown'

        threads.set(threadKey, {
          thread_key: threadKey,
          contact_id: contactId,
          other_phone: otherPhone,
          first_name: person?.first_name || 'Unknown',
          last_name: person?.last_name || '',
          student_name: studentName,
          display_name: displayName || studentName,
          account_holder_name: displayName,
          client_status: student?.client_status || null,
          messages: [],
          last_message_at: null,
          last_message_body: null,
          last_message_direction: null,
          has_unread: false,
        })
      }

      const thread = threads.get(threadKey)
      thread.messages.push({
        id: msg.id,
        body: msg.body,
        direction: msg.direction,
        status: msg.status,
        created_at: msg.created_at,
        to_phone: msg.to_phone,
        from_phone: msg.from_phone,
      })

      if (!thread.last_message_at || msg.created_at > thread.last_message_at) {
        thread.last_message_at = msg.created_at
        thread.last_message_body = msg.body
        thread.last_message_direction = msg.direction
      }

      if (msg.direction === 'inbound') thread.has_unread = true
    }

    const sorted = Array.from(threads.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    )

    return NextResponse.json(sorted)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}