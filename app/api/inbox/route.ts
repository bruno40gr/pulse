import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { normalizePhoneNumber } from '@/lib/phone'
import { getAccessScope, getRequestActor } from '@/lib/access'
import { PERMISSIONS } from '@/lib/permissions'
import { requireAccountAdministrator, requirePermission } from '@/lib/request-context'
import { attributeInboundMessagesToCampaigns } from '@/lib/campaign-message-attribution'

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
  profile_type: 'contact' | 'lead' | null
  profile_id: string | null
  profile_intake_type: string | null
}

type CrmContact = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
}

type LeadProfile = {
  id: string
  contact_id: string
  intake_type: string
  created_at: string
}

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

function getCampaignId(request: Request): string | null {
  const url = new URL(request.url)
  return url.searchParams.get('campaign_id') || null
}

async function authorizeInboxRead(request: Request, tenantId: string) {
  const actor = await getRequestActor(request)
  if (actor && getAccessScope(actor).kind === 'demo') {
    const scope = getAccessScope(actor)
    return scope.kind === 'demo' && scope.tenantId === tenantId
      ? { ok: true as const }
      : { ok: false as const, status: 403, error: 'You do not have access to this account.' }
  }
  return requirePermission(request, tenantId, PERMISSIONS.communicationsRead)
}

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const countOnly = new URL(request.url).searchParams.get('count_only') === '1'

    const campaignId = getCampaignId(request)
    if (countOnly) {
      let countQuery = supabaseAdmin
        .from('messages')
        .select('from_phone, status')
        .eq('tenant_id', tenantId)
        .eq('direction', 'inbound')

      if (campaignId) countQuery = countQuery.eq('campaign_id', campaignId)

      const { data: inboundMessages, error: countError } = await countQuery
      if (countError) throw countError

      const attentionThreads = new Set<string>()
      for (const message of inboundMessages || []) {
        if (message.status === 'read') continue
        const otherPhone = normalizePhoneNumber(message.from_phone)
        if (otherPhone) attentionThreads.add(otherPhone)
      }
      return NextResponse.json({ count: attentionThreads.size })
    }

    // Step 1: Get all messages
    const query = supabaseAdmin
      .from('messages')
      .select('id, body, direction, status, error_message, created_at, contact_id, to_phone, from_phone, campaign_id, media_url')
      .eq('tenant_id', tenantId)

    const { data: messages, error: msgError } = await query
      .order('created_at', { ascending: false })

    if (msgError) throw msgError
    const campaignByInboundMessageId = campaignId ? attributeInboundMessagesToCampaigns(messages || []) : null
    const visibleMessages = campaignId
      ? (messages || []).filter(message => message.campaign_id === campaignId || campaignByInboundMessageId?.get(message.id) === campaignId)
      : (messages || [])

    if (visibleMessages.length === 0) {
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
    const personByPhone = new Map<string, InboxPerson>()
    for (const p of people || []) {
      const person = p as InboxPerson
      personMap.set(person.id, person)
      const personPhone = normalizePhoneNumber(person.phone)
      if (personPhone && !personByPhone.has(personPhone)) personByPhone.set(personPhone, person)
      const student = person.students?.[0]
      const account = Array.isArray(student?.accounts) ? student.accounts[0] : student?.accounts
      const accountPhone = normalizePhoneNumber(account?.phone)
      if (accountPhone && !personByPhone.has(accountPhone)) personByPhone.set(accountPhone, person)
    }

    const { data: crmContacts, error: crmContactsError } = await crmSupabaseAdmin
      .from('crm_contacts')
      .select('id, first_name, last_name, full_name, phone')
      .eq('tenant_id', tenantId)
    if (crmContactsError) throw crmContactsError

    const crmContactById = new Map<string, CrmContact>()
    const crmContactByPhone = new Map<string, CrmContact>()
    for (const contact of (crmContacts || []) as CrmContact[]) {
      crmContactById.set(contact.id, contact)
      const phone = normalizePhoneNumber(contact.phone)
      if (phone && !crmContactByPhone.has(phone)) crmContactByPhone.set(phone, contact)
    }

    const crmContactIds = [...crmContactById.keys()]
    const [{ data: leadIntakes, error: leadIntakesError }, { data: jobApplications, error: jobApplicationsError }] = await Promise.all([
      crmContactIds.length > 0
        ? crmSupabaseAdmin.from('lead_intakes').select('id, contact_id, intake_type, created_at').eq('tenant_id', tenantId).in('contact_id', crmContactIds)
        : Promise.resolve({ data: [], error: null }),
      crmContactIds.length > 0
        ? crmSupabaseAdmin.from('job_applications').select('id, contact_id, created_at').eq('tenant_id', tenantId).in('contact_id', crmContactIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (leadIntakesError) throw leadIntakesError
    if (jobApplicationsError) throw jobApplicationsError

    const latestLeadByContact = new Map<string, LeadProfile>()
    const leadProfiles: LeadProfile[] = [
      ...((leadIntakes || []) as LeadProfile[]),
      ...((jobApplications || []).map((application) => ({ ...application, intake_type: 'job_application' })) as LeadProfile[]),
    ].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    for (const lead of leadProfiles) {
      if (!latestLeadByContact.has(lead.contact_id)) latestLeadByContact.set(lead.contact_id, lead)
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

    for (const msg of visibleMessages) {
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
        const person = (contactId ? personMap.get(contactId) : undefined) || (normalizedPhone ? personByPhone.get(normalizedPhone) : undefined)
        const crmContact = (contactId ? crmContactById.get(contactId) : undefined) || (normalizedPhone ? crmContactByPhone.get(normalizedPhone) : undefined)
        const leadProfile = crmContact ? latestLeadByContact.get(crmContact.id) : undefined
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

        const crmName = crmContact?.full_name || `${crmContact?.first_name || ''} ${crmContact?.last_name || ''}`.trim()
        const studentName = person
          ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'
          : crmName || otherPhone

        threads.set(threadKey, {
          thread_key: threadKey,
          contact_id: contactId,
          other_phone: normalizedPhone && normalizedPhone.length === 10 ? `+1${normalizedPhone}` : otherPhone,
          first_name: person?.first_name || crmContact?.first_name || (contactId ? 'Unknown' : ''),
          last_name: person?.last_name || crmContact?.last_name || '',
          student_name: studentName,
          display_name: displayName || studentName,
          account_holder_name: displayName,
          client_status: student?.client_status || null,
          messages: [],
          last_message_at: null,
          last_message_body: null,
          last_message_direction: null,
          has_unread: false,
          profile_type: person ? 'contact' : leadProfile ? 'lead' : null,
          profile_id: person?.id || leadProfile?.id || null,
          profile_intake_type: leadProfile?.intake_type || null,
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

      if (msg.direction === 'inbound' && msg.status !== 'read') thread.has_unread = true
    }

    const sorted = Array.from(threads.values()).sort(
      (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
    )

    return NextResponse.json(sorted)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const access = await authorizeInboxRead(request, tenantId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const body = await request.json().catch(() => ({})) as { other_phone?: unknown }
    const normalizedTarget = normalizePhoneNumber(typeof body.other_phone === 'string' ? body.other_phone : null)
    if (!normalizedTarget) return NextResponse.json({ error: 'A valid conversation phone number is required.' }, { status: 400 })

    const { data: inboundMessages, error: lookupError } = await supabaseAdmin
      .from('messages')
      .select('id, from_phone, status')
      .eq('tenant_id', tenantId)
      .eq('direction', 'inbound')
    if (lookupError) throw lookupError

    const messageIds = (inboundMessages || [])
      .filter((message) => message.status !== 'read' && normalizePhoneNumber(message.from_phone) === normalizedTarget)
      .map((message) => message.id)

    if (messageIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('messages')
        .update({ status: 'read' })
        .eq('tenant_id', tenantId)
        .in('id', messageIds)
      if (updateError) throw updateError
    }

    return NextResponse.json({ marked_read: messageIds.length })
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
