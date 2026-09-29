import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/phone'
import { requireAccountAdministrator } from '@/lib/request-context'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

type InboxPerson = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  students?: Array<{
    client_status?: string | null
    accounts?: { name?: string | null; phone?: string | null } | null
  }>
}

type InboxThread = {
  thread_key: string
  contact_id: string | null
  other_phone: string
  first_name: string
  last_name: string
  student_name: string
  display_name: string
  account_holder_name: string | null
  client_status: string | null
  messages: Array<Record<string, unknown>>
  last_message_at: string | null
  last_message_body: string | null
  last_message_direction: string | null
  has_unread: boolean
}

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
      .select('id, body, direction, status, error_message, created_at, contact_id, to_phone, from_phone, campaign_id, media_url')
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
    const { data: people, error: peopleError } = await supabaseAdmin
      .from('people')
      .select(`
        id, first_name, last_name, phone, custom_fields,
        students (
          client_status, is_minor, message_routing, account_id,
          accounts ( id, name, phone, email )
        )
      `)
      .eq('tenant_id', tenantId)

    if (peopleError) throw peopleError

    // Build a lookup map: contact_id -> person data
    const personMap = new Map<string, InboxPerson>()
    for (const p of people || []) {
      personMap.set(p.id, p as InboxPerson)
    }

    // Step 3: Thread by the canonical recipient. A contact-backed recipient stays in one
    // conversation across campaigns and dates; unknown recipients fall back to normalized phone.
    const threads = new Map<string, InboxThread>()

    const phoneToContact = new Map<string, string>()
    for (const person of people || []) {
      const personPhone = normalizePhoneNumber(person.phone)
      if (personPhone && !phoneToContact.has(personPhone)) phoneToContact.set(personPhone, person.id)
      const student = person.students?.[0]
      const account = Array.isArray(student?.accounts) ? student.accounts[0] : student?.accounts
      const accountPhone = normalizePhoneNumber(account?.phone)
      if (accountPhone && !phoneToContact.has(accountPhone)) phoneToContact.set(accountPhone, person.id)
    }
    for (const message of messages) {
      const otherPhone = message.direction === 'outbound' ? message.to_phone : message.from_phone
      const normalizedPhone = normalizePhoneNumber(otherPhone)
      if (message.contact_id && normalizedPhone) phoneToContact.set(normalizedPhone, message.contact_id)
    }

    for (const msg of messages) {
      const rawContactId = msg.contact_id || null
      const otherPhone = msg.direction === 'outbound'
        ? msg.to_phone
        : msg.from_phone
      if (!otherPhone) continue
      const normalizedPhone = normalizePhoneNumber(otherPhone)
      const contactId = rawContactId || (normalizedPhone ? phoneToContact.get(normalizedPhone) : null) || null

      const recipientKey = normalizedPhone || otherPhone
      const threadKey = `phone::${recipientKey}`

      if (!threads.has(threadKey)) {
        const person = contactId ? personMap.get(contactId) : undefined
        const student = person?.students?.[0] || {}
        const account = student?.accounts || {}

        // Determine who we're talking to on this phone number
        let displayName: string | null = null

        if (person) {
          // 1. Check if the other phone matches the account phone (parent/guardian)
          if (account.phone && normalizePhoneNumber(account.phone) === normalizedPhone && account.name) {
            displayName = account.name.replace(' (account)', '').trim() || null
          }
          // 2. If otherPhone matches the student's own phone, display the student name
          if (!displayName && normalizePhoneNumber(person.phone) === normalizedPhone) {
            displayName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || null
          }
          // 3. Fallback to student name
          if (!displayName) {
            displayName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || null
          }
        }

        const studentName = person
          ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
          : otherPhone

        threads.set(threadKey, {
          thread_key: threadKey,
          contact_id: contactId,
          other_phone: normalizedPhone && normalizedPhone.length === 10 ? `+1${normalizedPhone}` : otherPhone,
          first_name: person?.first_name || (contactId ? 'Unknown' : ''),
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
      if (!thread) continue
      if (!thread.contact_id && contactId) thread.contact_id = contactId
      thread.messages.push({
        id: msg.id,
        body: msg.body,
        direction: msg.direction,
        status: msg.status,
        error_message: msg.error_message,
        created_at: msg.created_at,
        to_phone: msg.to_phone,
        from_phone: msg.from_phone,
        media_url: msg.media_url,
      })

      if (!thread.last_message_at || msg.created_at > thread.last_message_at) {
        thread.last_message_at = msg.created_at
        thread.last_message_body = msg.body
        thread.last_message_direction = msg.direction
      }

      if (msg.direction === 'inbound') thread.has_unread = true
    }

    const sorted = Array.from(threads.values()).sort(
      (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
    )

    return NextResponse.json(sorted)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const access = await requireAccountAdministrator(request, tenantId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const body = await request.json().catch(() => ({})) as { other_phone?: unknown }
    const normalizedTarget = normalizePhoneNumber(typeof body.other_phone === 'string' ? body.other_phone : null)
    if (!normalizedTarget) return NextResponse.json({ error: 'A valid conversation phone number is required.' }, { status: 400 })

    const { data: messages, error: lookupError } = await supabaseAdmin
      .from('messages')
      .select('id, direction, to_phone, from_phone')
      .eq('tenant_id', tenantId)
    if (lookupError) throw lookupError

    const messageIds = (messages || [])
      .filter((message) => normalizePhoneNumber(message.direction === 'outbound' ? message.to_phone : message.from_phone) === normalizedTarget)
      .map((message) => message.id)

    if (messageIds.length === 0) return NextResponse.json({ deleted: 0 })

    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', messageIds)
    if (deleteError) throw deleteError

    return NextResponse.json({ deleted: messageIds.length })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
