import { crmSupabaseAdmin as db } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions'
import { conversationDirectory } from '@/lib/conversations-directory'
import { isLeadEmailContact } from '@/lib/conversation-email-range'
import { conversationEmailQuery } from '@/lib/conversation-email-query'
import { decryptToken } from './security'
import { gmailGet, googleToken, GmailReadError, GoogleTokenError } from './google'
import { gmailConversationMessages, gmailConversationBody, gmailHeader, gmailMessageDirection, validEmail, type GmailConversationMessage } from './conversations'
import { emailAddresses } from './rules'
import type { StoredEmail } from './conversation-store'

type Checkpoint = { cursor?: string | null; history?: string; recover?: boolean; batch?: { ids: string[]; deleted: string[]; next: Checkpoint; complete: boolean; history: string | null } }
type Job = { id: string; tenant_id: string; connection_id: string; kind: 'import' | 'history'; range_start: string; range_end: string; addresses: string[]; checkpoint: Checkpoint; lease_token: string; attempts: number }
type History = { id: string; messagesAdded?: { message: { id: string } }[]; messagesDeleted?: { message: { id: string } }[]; labelsAdded?: { message: { id: string } }[]; labelsRemoved?: { message: { id: string } }[] }

export function storeConversationMessage(message: GmailConversationMessage, mailbox: string, addresses: Set<string>): StoredEmail | null {
  if (!gmailConversationMessages({ id: message.threadId, messages: [message] }).length) return null
  const sender = emailAddresses(gmailHeader(message, 'From')).join(', ')
  const recipients = emailAddresses(gmailHeader(message, 'To')), copied = emailAddresses(gmailHeader(message, 'Cc'))
  const direction = gmailMessageDirection(message, mailbox)
  const participants = [...new Set(direction === 'inbound' ? emailAddresses(sender) : [...emailAddresses(sender), ...recipients, ...copied])].filter(address => addresses.has(address))
  const timestamp = Number(message.internalDate)
  if (!participants.length || !Number.isFinite(timestamp)) return null
  return { provider_message_id: message.id, provider_thread_id: message.threadId, sent_at: new Date(timestamp).toISOString(), direction, sender, recipients, copied_recipients: copied, participants,
    subject: gmailHeader(message, 'Subject').slice(0, 500), body: gmailConversationBody(message.payload), unread: direction === 'inbound' && !!message.labelIds?.includes('UNREAD') }
}

async function permitted(tenant: string, memberId: string) {
  const member = await supabaseAdmin.from('tenant_memberships').select('status,role_id,legacy_access_enabled').eq('tenant_id', tenant).eq('id', memberId).maybeSingle()
  if (member.error || !member.data || (member.data.status !== 'active' && !(member.data.legacy_access_enabled && ['invited', 'unclaimed'].includes(member.data.status)))) return false
  const role = await supabaseAdmin.from('roles').select('key').eq('tenant_id', tenant).eq('id', member.data.role_id).maybeSingle()
  if (role.error || !role.data) return false
  if (role.data.key === 'owner') return true
  const mappings = await supabaseAdmin.from('role_permissions').select('permission_id').eq('role_id', member.data.role_id)
  if (mappings.error || !mappings.data?.length) return false
  const permissions = await supabaseAdmin.from('permissions').select('key').in('id', mappings.data.map(row => row.permission_id))
  const keys = new Set((permissions.data || []).map(row => row.key))
  return !permissions.error && keys.has(PERMISSIONS.communicationsConfigure) && keys.has(PERMISSIONS.leadsManage)
}

/** One provider page per claim. Data and checkpoint commit in one fenced transaction. */
export async function runConversationEmailJob(deadline = Date.now() + 20000) {
  if (Date.now() + 5000 >= deadline) return { idle: true }
  const claimed = await db.rpc('conversation_email_claim')
  if (claimed.error) throw new Error('Conversation sync schema unavailable.')
  const job = (claimed.data as Job[] | null)?.[0]
  if (!job) return { idle: true }
  try {
    const checkDeadline = () => { if (Date.now() + 3000 >= deadline) throw new GmailReadError(0) }
    checkDeadline()
    const connection = await db.from('gmail_connections').select('email,refresh_token_ciphertext,connected_by').eq('tenant_id', job.tenant_id).eq('id', job.connection_id).single()
    if (connection.error || !connection.data || !await permitted(job.tenant_id, connection.data.connected_by)) throw new Error('Mailbox access revoked.')
    checkDeadline()
    const token = await googleToken({ grant_type: 'refresh_token', refresh_token: decryptToken(connection.data.refresh_token_ciphertext) }, deadline - 3000)
    const read = <T>(path: string) => gmailGet<T>(token.access_token, path, deadline - 3000)
    const people = (await conversationDirectory(job.tenant_id, false, true)).filter(isLeadEmailContact)
    const addresses = new Set(people.map(person => person.email.trim().toLowerCase()).filter(validEmail))
    let checkpoint: Checkpoint = {}, complete = false, history: string | null = null
    let ids: string[] = [], deleted: string[] = []
    let recovering = false
    if (job.checkpoint.batch) {
      const batch = job.checkpoint.batch
      ids = batch.ids; deleted = batch.deleted; checkpoint = batch.next; complete = batch.complete; history = batch.history
    } else if (job.kind === 'import') {
      // Capture a baseline BEFORE the first import page. History closes changes
      // that arrive while a multi-page import is in progress.
      const state = await db.from('conversation_email_mailboxes').select('history_id').eq('tenant_id', job.tenant_id).eq('connection_id', job.connection_id).maybeSingle()
      if (state.error) throw new Error('Mailbox checkpoint unavailable.')
      if (!state.data?.history_id) {
        const profile = await read<{ historyId: string }>('profile')
        history = profile.historyId
      }
      // Provider cursors belong to the original query, including its address
      // groups. Directory changes must not shift those groups during a resume.
      // Current lead eligibility is still enforced when materializing messages.
      const search = conversationEmailQuery(job.addresses, job.checkpoint.cursor || null)
      if (search.empty) complete = true
      else {
        const query = new URLSearchParams({ maxResults: '10', q: `-in:trash -in:spam after:${Date.parse(job.range_start) / 1000 - 1} before:${Date.parse(job.range_end) / 1000} ${search.audience}` })
        if (search.page) query.set('pageToken', search.page)
        const page = await read<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?${query}`)
        ids = (page.messages || []).map(item => item.id)
        const cursor = search.nextCursor(page.nextPageToken || null)
        checkpoint = { cursor }; complete = !cursor
      }
    } else {
      const state = await db.from('conversation_email_mailboxes').select('history_id').eq('tenant_id', job.tenant_id).eq('connection_id', job.connection_id).maybeSingle()
      if (state.error) throw new Error('Mailbox checkpoint unavailable.')
      const start = job.checkpoint.history || state.data?.history_id
      if (!start) {
        const profile = await read<{ historyId: string }>('profile')
        // Establishing a baseline is not a completed history scan. The next
        // claim must actually read history before reporting mailbox freshness.
        history = profile.historyId; complete = false
      } else {
        const query = new URLSearchParams({ startHistoryId: start, maxResults: '10' })
        if (job.checkpoint.cursor) query.set('pageToken', job.checkpoint.cursor)
        let page: { history?: History[]; historyId: string; nextPageToken?: string }
        try { page = await read(`history?${query}`) }
        catch (error) {
          if (!(error instanceof GmailReadError) || error.status !== 404) throw error
          // Recovery is applied only inside the fenced commit, together with the
          // new baseline. Clearing stale rows also reconciles missed deletions.
          const profile = await read<{ historyId: string }>('profile')
          page = { historyId: profile.historyId }
          recovering = true
        }
        ids = [...new Set((page.history || []).flatMap(item => [...(item.messagesAdded || []), ...(item.labelsAdded || []), ...(item.labelsRemoved || [])].map(change => change.message.id)))]
        deleted = [...new Set((page.history || []).flatMap(item => (item.messagesDeleted || []).map(change => change.message.id)))]
        complete = !page.nextPageToken
        checkpoint = complete ? {} : { history: start, cursor: page.nextPageToken }
        if (recovering) checkpoint = { recover: true }
        if (complete) history = page.historyId
      }
    }
    const messages: StoredEmail[] = []
    let consumed = 0
    for (const id of ids) {
      // Leave time for the fenced commit. Persist the rest of a large history
      // page, not just its next-page cursor, so yielding cannot skip messages.
      if (Date.now() + 5000 >= deadline) break
      try {
        const raw = await read<GmailConversationMessage>(`messages/${encodeURIComponent(id)}?format=full`)
        const stored = storeConversationMessage(raw, connection.data.email, addresses)
        if (stored && (job.kind !== 'import' || (Date.parse(stored.sent_at) >= Date.parse(job.range_start) && Date.parse(stored.sent_at) < Date.parse(job.range_end)))) messages.push(stored)
        else if (!stored) deleted.push(id)
      } catch (error) { if (error instanceof GmailReadError && error.status === 404) deleted.push(id); else throw error }
      consumed++
    }
    if (consumed < ids.length) {
      checkpoint = { batch: { ids: ids.slice(consumed), deleted: [], next: checkpoint, complete, history: job.kind === 'history' ? history : null } }
      complete = false
      // Publish an import's initial baseline with its first partial commit.
      // A history page must not advance its baseline until every ID is handled.
      if (job.kind === 'history') history = null
    }
    checkDeadline()
    const result = await db.rpc('conversation_email_commit', { p_job: job.id, p_lease: job.lease_token, p_messages: messages, p_deleted: deleted, p_checkpoint: checkpoint, p_complete: complete, p_history: history })
    if (result.error || result.data !== true) throw new Error('Email sync lease expired; batch will replay.')
    return { processed: messages.length, complete }
  } catch (error) {
    const reconnect = (error instanceof GmailReadError && error.status === 401) || (error instanceof GoogleTokenError && error.reconnect)
    const delay = Math.min(3600000, 15000 * 2 ** Math.min(job.attempts, 8)) + Math.floor(Math.random() * 5000)
    await db.from('conversation_email_jobs').update({ status: reconnect ? 'reconnect' : 'delayed', attempts: job.attempts + 1, last_error: reconnect ? 'reconnect_required' : 'provider_delayed', next_attempt_at: new Date(Date.now() + delay).toISOString(), lease_token: null, lease_until: null, updated_at: new Date().toISOString() }).eq('tenant_id', job.tenant_id).eq('id', job.id).eq('lease_token', job.lease_token)
    return { delayed: true }
  }
}