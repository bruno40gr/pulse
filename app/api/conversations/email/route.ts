import { organisationEmailSettings, organisationSender } from '@/lib/organisation-email'
import { NextResponse } from 'next/server'
import { unresolvedEmailPlaceholders } from '@/lib/headliner-email-templates'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { conversationDirectory } from '@/lib/conversations-directory'
import { conversationMailbox, gmailConversationBody, gmailConversationMessages, gmailMessageDirection, gmailMessageMatches, gmailGet, gmailHeader, gmailMime, gmailThreadMatches, validEmail, type GmailConversationThread } from '@/lib/gmail/conversations'
import { emailAddresses } from '@/lib/gmail/rules'
import { personThread, type LiveThread } from '@/lib/conversations-live'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { isConversationEmailPreview } from '@/lib/conversations-preview'
import { GmailReadError } from '@/lib/gmail/google'
import { emailDateRange, isLeadEmailContact } from '@/lib/conversation-email-range'
import { conversationEmailQuery } from '@/lib/conversation-email-query'
import { readStoredEmail, storedMailbox, InvalidStoredEmailCursor } from '@/lib/gmail/conversation-store'
import { formatCommunicationTimestamp } from '@/lib/communication-time'

export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }
type Access = Extract<Awaited<ReturnType<typeof authorizeTenantRequest>>, { ok: true }>
async function directory(access: Access) {
  const can = (key: typeof PERMISSIONS.contactsRead | typeof PERMISSIONS.leadsRead) => access.context?.roleKey === 'owner' || Boolean(access.context?.permissions.has(key))
  return conversationDirectory(access.tenantId, can(PERMISSIONS.contactsRead), can(PERMISSIONS.leadsRead))
}

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to read email.' }, { status: 403, headers })
  let stage: 'mailboxes' | 'directory' | 'mailbox' | 'list' | 'threads' | 'messages' = 'mailboxes'
  try {
    const params = new URL(request.url).searchParams
    const mailboxId = params.get('mailbox')
    if (!mailboxId) {
      const { data, error } = await crmSupabaseAdmin.from('gmail_connections').select('id,email,scopes').eq('tenant_id', access.tenantId).eq('connected_by', access.context.membershipId).order('email')
      if (error) throw error
      const shared = await organisationEmailSettings(access.tenantId, { readOnly: true })
      const mailboxes = data || []
      if (shared && !mailboxes.some(mailbox => mailbox.id === shared.connection_id)) {
        const { data: connection, error: sharedError } = await crmSupabaseAdmin.from('gmail_connections').select('id,email,scopes').eq('tenant_id', access.tenantId).eq('id', shared.connection_id).maybeSingle()
        if (sharedError) throw sharedError
        if (connection) mailboxes.unshift(connection)
      }
      return NextResponse.json({ emailPreview: isConversationEmailPreview({ databaseUrl: process.env.CRM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, deployment: process.env.VERCEL_ENV }), mailboxes: mailboxes.map(mailbox => ({ id: mailbox.id, email: mailbox.email, canSend: shared?.connection_id === mailbox.id && (mailbox.scopes?.includes('https://www.googleapis.com/auth/gmail.send') || false) })).sort((a, b) => Number(b.canSend) - Number(a.canSend)) }, { headers })
    }
    const summary = params.get('summary') === '1'
    stage = 'directory'
    const people = (await directory(access)).filter(isLeadEmailContact)
    const person = people.find(person => person.id === params.get('person'))
    if (!summary && (!person || !validEmail(person.email))) return NextResponse.json({ error: 'Email contact not found.' }, { status: 404, headers })
    let range: ReturnType<typeof emailDateRange>
    try { range = emailDateRange(params.get('from'), params.get('to')) }
    catch { return NextResponse.json({ error: 'Choose a valid email date range.' }, { status: 400, headers }) }
    if (process.env.CONVERSATION_EMAIL_STORE === '1') {
      const mailbox = await storedMailbox(access.tenantId, mailboxId, access.context.membershipId)
      return NextResponse.json(await readStoredEmail(access.tenantId, mailbox, summary ? people : [person!], range, summary, params.get('cursor')), { headers })
    }
    let search: ReturnType<typeof conversationEmailQuery>
    try { search = conversationEmailQuery((summary ? people : [person!]).map(person => person.email).filter(validEmail), params.get('cursor')) }
    catch { return NextResponse.json({ error: 'Invalid email cursor.' }, { status: 400, headers }) }
    if (search.empty) return NextResponse.json({ threads: [], nextCursor: null }, { headers })
    stage = 'mailbox'
    const mailbox = await conversationMailbox(access.tenantId, mailboxId, access.context.membershipId)
    const query = new URLSearchParams({ maxResults: '10', q: `-in:trash -in:spam after:${range.start / 1000 - 1} before:${range.end / 1000} ${search.audience}` })
    if (search.page) query.set('pageToken', search.page)
    stage = 'list'
    const page = await gmailGet<{ threads?: { id: string }[]; nextPageToken?: string }>(mailbox.token, `threads?${query}`)
    const threads: LiveThread[] = []
    // Bounded concurrency keeps a mailbox summary within the route's execution window.
    const references = page.threads || []
    const histories: GmailConversationThread[] = []
    stage = 'threads'
    for (let offset = 0; offset < references.length; offset += 2) {
      const batch = await Promise.all(references.slice(offset, offset + 2).map(async reference => {
        try {
          return await gmailGet<GmailConversationThread>(mailbox.token, `threads/${encodeURIComponent(reference.id)}?format=${summary ? 'metadata' : 'full'}`)
        } catch (error) {
          // A thread can be deleted between list and get. Other failures must
          // remain visible rather than silently presenting incomplete history.
          if (error instanceof GmailReadError && error.status === 404) return null
          throw error
        }
      }))
      histories.push(...batch.filter((thread): thread is GmailConversationThread => thread !== null))
    }
    stage = 'messages'
    for (const thread of histories) {
      const matches = (summary ? people : [person!]).filter(person => validEmail(person.email) && gmailThreadMatches(thread, person.email, mailbox.email))
      if (!matches.length) continue
      for (const person of matches) {
        const messages = gmailConversationMessages(thread).filter(message => gmailMessageMatches(message, person.email, mailbox.email))
          .sort((a, b) => Number(a.internalDate) - Number(b.internalDate)).map(message => {
            const internalDate = message.internalDate?.trim() ? new Date(Number(message.internalDate)) : new Date(NaN)
            const headerDate = new Date(gmailHeader(message, 'Date'))
            const date = Number.isFinite(internalDate.getTime()) ? internalDate : Number.isFinite(headerDate.getTime()) ? headerDate : null
            return ({
            id: message.id, channel: 'email' as const,
            direction: gmailMessageDirection(message, mailbox.email),
            body: summary ? '' : gmailConversationBody(message.payload), time: date ? formatCommunicationTimestamp(date.toISOString()) : 'Date unavailable',
            timestamp: date?.toISOString() || '', subject: gmailHeader(message, 'Subject'),
            unread: gmailMessageDirection(message, mailbox.email) === 'inbound' && (message.labelIds?.includes('UNREAD') || false),
            emailFrom: emailAddresses(gmailHeader(message, 'From')).join(', '),
            emailTo: emailAddresses(gmailHeader(message, 'To')), emailCc: emailAddresses(gmailHeader(message, 'Cc')),
          }) }).filter(message => {
            const timestamp = Date.parse(message.timestamp)
            return timestamp >= range.start && timestamp < range.end
          })
        if (messages.length) threads.push({ ...personThread(person), id: `email:${mailbox.id}:${thread.id}:${person.id}`, channel: 'email',
          providerThreadId: thread.id, mailboxId: mailbox.id, subject: messages[0].subject, messages, unread: messages.some(message => message.unread) })
      }
    }
    return NextResponse.json({ threads, nextCursor: search.nextCursor(page.nextPageToken || null) }, { headers })
  } catch (error) {
    if (error instanceof InvalidStoredEmailCursor) return NextResponse.json({ error: 'Invalid email cursor.' }, { status: 400, headers })
    const code = error instanceof GmailReadError ? `history_${stage}_${error.status}_${error.reason}` : `history_${stage}`
    // Only fixed stage/status identifiers are exposed. No provider errors,
    // mailbox addresses, message content or tokens are logged or returned.
    console.warn('Email history request failed', { code })
    const message = error instanceof GmailReadError && error.retryable
      ? 'Email history is temporarily busy. Please try again shortly.'
      : 'Email history is unavailable right now. Your draft has not been changed.'
    return NextResponse.json({ error: message, code, retryable: error instanceof GmailReadError && error.retryable }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to send email.' }, { status: 403, headers })
  const input = await request.json().catch(() => null)
  if (!input || typeof input.mailboxId !== 'string' || typeof input.body !== 'string' || typeof input.subject !== 'string' || (input.html !== undefined && (typeof input.html !== 'string' || input.html.length > 200000))
    || !['to', 'cc', 'bcc'].every(key => Array.isArray(input[key]) && input[key].every((id: unknown) => typeof id === 'string'))
    || [...input.to, ...input.cc, ...input.bcc].length > 50 || /[\r\n]/.test(input.subject) || input.subject.length > 500 || !input.subject.trim() || !input.body.trim() || input.body.length > 100000) {
    return NextResponse.json({ error: 'Invalid email content or recipients.' }, { status: 400, headers })
  }
  if (unresolvedEmailPlaceholders(`${input.subject}\n${input.body}\n${input.html || ''}`).length) {
    return NextResponse.json({ error: 'Complete all template placeholders before sending.' }, { status: 400, headers })
  }
  try {
    const people = await directory(access)
    const ids: string[] = [...input.to, ...input.cc, ...input.bcc]
    if (!input.to.length || ids.length !== new Set(ids).size || ids.some(id => !people.some(person => person.id === id && person.email))) return NextResponse.json({ error: 'Choose valid recipients from this account.' }, { status: 400, headers })
    const resolve = (values: string[]) => values.map(id => people.find(person => person.id === id)!.email)
    const mailbox = await organisationSender(access.tenantId, access.context.membershipId, input.senderEmail)
    if (mailbox.id !== input.mailboxId) return NextResponse.json({ error: 'Use the configured shared organisation mailbox.' }, { status: 403, headers })
    if (!mailbox.scopes?.includes('https://www.googleapis.com/auth/gmail.send')) return NextResponse.json({ error: 'Reconnect this mailbox in Settings to allow sending.' }, { status: 409, headers })
    let thread: GmailConversationThread | undefined
    if (input.threadId) {
      if (typeof input.threadId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(input.threadId)) return NextResponse.json({ error: 'Invalid email thread.' }, { status: 400, headers })
      thread = await gmailGet<GmailConversationThread>(mailbox.token, `threads/${encodeURIComponent(input.threadId)}?format=full`)
      if (!resolve(input.to).some(email => gmailThreadMatches(thread!, email))) return NextResponse.json({ error: 'The reply recipient does not belong to this thread.' }, { status: 400, headers })
    }
    const raw = gmailMime({ from: mailbox.sender.email, fromName: mailbox.sender.name, to: resolve(input.to), cc: resolve(input.cc), bcc: resolve(input.bcc), subject: input.subject, body: input.body, html: input.html, reply: thread?.messages?.at(-1) })
    // Do not retry a send automatically: a timeout can mean Google already accepted it.
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${mailbox.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url'), ...(thread ? { threadId: thread.id } : {}) }), signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return NextResponse.json({ error: 'Gmail did not accept the message. Check the connection before trying again.' }, { status: 502, headers })
    const sent = await response.json()
    const auditRecorded = await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: access.context.membershipId, eventType: 'communications.email_sent', metadata: { mailbox_id: mailbox.id, provider_message_id: sent.id, recipient_count: ids.length } }).catch(() => false)
    return NextResponse.json({ id: sent.id, threadId: sent.threadId, auditRecorded }, { headers })
  } catch {
    return NextResponse.json({ error: 'Email could not be confirmed. Check Sent in Gmail before trying again to avoid a duplicate.' }, { status: 503, headers })
  }
}