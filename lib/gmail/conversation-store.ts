import { createHash } from 'node:crypto'
import { crmSupabaseAdmin as db } from '@/lib/supabase/crm-admin'
import { organisationEmailSettings } from '@/lib/organisation-email'
import { personThread, type ConversationPerson, type LiveThread } from '@/lib/conversations-live'
import { gmailMessageMatches, validEmail, type GmailConversationMessage } from './conversations'

export type StoredEmail = {
  provider_message_id: string; provider_thread_id: string; sent_at: string
  direction: 'inbound' | 'outbound'; sender: string; recipients: string[]; copied_recipients: string[]
  participants: string[]; subject: string; body: string; unread: boolean
}

export class InvalidStoredEmailCursor extends Error {
  constructor() { super('Invalid email cursor.') }
}

function storedCursor(cursor: string | null) {
  if (!cursor) return null
  try {
    if (!cursor.startsWith('store:') || cursor.length > 1024) throw new Error()
    const before: { at: string; id: string } = JSON.parse(decodeURIComponent(cursor.slice(6)))
    if (!before || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|\+00:00)$/.test(before.at) || !Number.isFinite(Date.parse(before.at)) || !/^[a-zA-Z0-9_-]+$/.test(before.id)) throw new Error()
    return before
  } catch { throw new InvalidStoredEmailCursor() }
}

/** Authorize ownership without refreshing a token or making any provider request. */
export async function storedMailbox(tenant: string, connection: string, member: string) {
  const shared = await organisationEmailSettings(tenant, { readOnly: true })
  let query = db.from('gmail_connections').select('id,email').eq('tenant_id', tenant).eq('id', connection)
  if (shared?.connection_id !== connection) query = query.eq('connected_by', member)
  const { data, error } = await query.maybeSingle()
  if (error || !data) throw new Error('Mailbox unavailable.')
  return data as { id: string; email: string }
}

export function storedEmailThreads(rows: StoredEmail[], people: ConversationPerson[], mailbox: { id: string; email: string }, summary: boolean) {
  const threads = new Map<string, LiveThread>()
  const byEmail = new Map<string, ConversationPerson[]>()
  for (const person of people) {
    const address = person.email.trim().toLowerCase()
    byEmail.set(address, [...(byEmail.get(address) || []), person])
  }
  for (const row of rows) {
    const message: GmailConversationMessage = { id: row.provider_message_id, threadId: row.provider_thread_id, internalDate: String(Date.parse(row.sent_at)), labelIds: row.direction === 'outbound' ? ['SENT'] : [], payload: { headers: [
      { name: 'From', value: row.sender }, { name: 'To', value: row.recipients.join(', ') }, { name: 'Cc', value: row.copied_recipients.join(', ') },
    ] } }
    for (const address of row.participants) for (const person of byEmail.get(address) || []) {
      if (!gmailMessageMatches(message, address, mailbox.email)) continue
      const id = `email:${mailbox.id}:${row.provider_thread_id}:${person.id}`
      const thread = threads.get(id) || { ...personThread(person), id, channel: 'email' as const, mailboxId: mailbox.id, providerThreadId: row.provider_thread_id, subject: row.subject, messages: [] }
      if (!thread.messages.some(item => item.id === row.provider_message_id)) thread.messages.push({ id: row.provider_message_id, channel: 'email', direction: row.direction, timestamp: row.sent_at, time: new Date(row.sent_at).toLocaleString('en-US'), subject: row.subject, body: summary ? '' : row.body, unread: row.unread, emailFrom: row.sender, emailTo: row.recipients, emailCc: row.copied_recipients })
      thread.messages.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
      thread.unread = thread.messages.some(item => item.unread)
      threads.set(id, thread)
    }
  }
  return [...threads.values()]
}

/** Both scheduled preloading and selected-range reads use the same durable job. */
export async function queueStoredEmailImport(tenant: string, connection: string, addresses: string[], range: { start: number; end: number }) {
  const audience = createHash('sha256').update(addresses.join('\n')).digest('hex')
  const key = `import:${range.start}:${range.end}:${audience}`
  const jobs = [
    { tenant_id: tenant, connection_id: connection, kind: 'import', job_key: key, range_start: new Date(range.start).toISOString(), range_end: new Date(range.end).toISOString(), addresses },
    { tenant_id: tenant, connection_id: connection, kind: 'history', job_key: 'history', addresses: [] },
  ]
  const queued = await db.from('conversation_email_jobs').upsert(jobs, { onConflict: 'tenant_id,connection_id,job_key', ignoreDuplicates: true })
  if (queued.error) throw new Error('Email storage is not ready. Your draft has not changed.')
  return key
}

/** GET reads saved messages and schedules missing coverage, never scans Gmail. */
export async function readStoredEmail(tenant: string, mailbox: { id: string; email: string }, people: ConversationPerson[], range: { start: number; end: number }, summary: boolean, cursor: string | null) {
  const before = storedCursor(cursor)
  const addresses = [...new Set(people.map(person => person.email.trim().toLowerCase()).filter(validEmail))].sort()
  if (!addresses.length || range.start >= Date.now()) return { threads: [], nextCursor: null, sync: { state: 'complete', processed: 0 } }
  const key = await queueStoredEmailImport(tenant, mailbox.id, addresses, range)
  const state = await db.from('conversation_email_jobs').select('status,processed,last_error').eq('tenant_id', tenant).eq('connection_id', mailbox.id).eq('job_key', key).single()
  if (state.error) throw new Error('Email import status unavailable.')
  const historyState = await db.from('conversation_email_jobs').select('status').eq('tenant_id', tenant).eq('connection_id', mailbox.id).eq('job_key', 'history').single()
  if (historyState.error) throw new Error('Email update status unavailable.')
  const mailboxState = await db.from('conversation_email_mailboxes').select('last_synced_at').eq('tenant_id', tenant).eq('connection_id', mailbox.id).maybeSingle()
  if (mailboxState.error) throw new Error('Email freshness unavailable.')
  const syncedAt = mailboxState.data?.last_synced_at
  const timestamp = typeof syncedAt === 'string' ? Date.parse(syncedAt) : NaN
  const lastSyncedAt = Number.isFinite(timestamp) && timestamp <= Date.now() ? new Date(timestamp).toISOString() : null
  // The checked-in scheduler runs every five minutes. Allow three cycles before
  // calling saved data stale, rather than flapping at each normal invocation.
  const freshness = !lastSyncedAt ? 'pending' : Date.now() - timestamp > 900000 ? 'stale' : 'current'
  let query = db.from('conversation_email_messages').select('*').eq('tenant_id', tenant).eq('connection_id', mailbox.id)
    .gte('sent_at', new Date(range.start).toISOString()).lt('sent_at', new Date(range.end).toISOString())
    .overlaps('participants', addresses)
  if (before) query = query.or(`sent_at.lt.${before.at},and(sent_at.eq.${before.at},provider_message_id.lt.${before.id})`)
  const result = await query.order('sent_at', { ascending: false }).order('provider_message_id', { ascending: false }).limit(200)
  if (result.error) throw new Error('Stored email history unavailable.')
  const rows = (result.data || []) as StoredEmail[]
  const last = rows.at(-1)
  return { threads: storedEmailThreads(rows, people, mailbox, summary), nextCursor: rows.length === 200 && last ? `store:${encodeURIComponent(JSON.stringify({ at: last.sent_at, id: last.provider_message_id }))}` : null,
    sync: { state: ['delayed', 'reconnect'].includes(historyState.data.status) ? historyState.data.status : state.data.status === 'complete' && freshness !== 'current' ? freshness : state.data.status,
      processed: state.data.processed, importComplete: state.data.status === 'complete', freshness, lastSyncedAt } }
}