/* eslint-disable @typescript-eslint/no-require-imports -- Isolated worker/store with no credentials or network. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, dependencies, globals = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Buffer, Date, URLSearchParams, Set, Map, Math, require(id) {
    if (id.startsWith('node:')) return require(id)
    assert.ok(id in dependencies, `Unexpected dependency ${id}`)
    return dependencies[id]
  }, ...globals })
  return loaded.exports
}
const rules = load('lib/gmail/rules.ts', {})
const conversations = load('lib/gmail/conversations.ts', { '@/lib/supabase/crm-admin': {}, './security': {}, './google': {}, './rules': rules, '@/lib/organisation-email': {} })
const live = load('lib/conversations-live.ts', {})
const emailQuery = load('lib/conversation-email-query.ts', {})
const person = { id: 'lead:one', name: 'Parent', email: 'parent@example.com', phone: '', student: '', stage: '', profileType: 'lead', profileId: 'one', smsContactId: 'one' }
const mailbox = { id: 'box', email: 'office@example.com' }
function worker(db, overrides = {}, globals = {}) {
  return load('lib/gmail/conversation-worker.ts', {
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: db }, '@/lib/supabase/admin': {}, '@/lib/permissions': {}, '@/lib/conversations-directory': {}, '@/lib/conversation-email-range': {}, '@/lib/conversation-email-query': {},
    './security': {}, './google': {}, './conversations': conversations, './rules': rules, ...overrides,
  }, globals)
}
test('store retains genuine inbound/outbound lead messages but excludes notification copies and copied inbound contacts', () => {
  const { storeConversationMessage } = worker({})
  const raw = { id: 'm', threadId: 't', internalDate: String(Date.parse('2026-10-20T12:00:00Z')), labelIds: ['UNREAD'], payload: { mimeType: 'text/plain', body: { data: Buffer.from('Hello').toString('base64url') }, headers: [{ name: 'From', value: 'parent@example.com' }, { name: 'To', value: mailbox.email }] } }
  const inbound = storeConversationMessage(raw, mailbox.email, new Set([person.email]))
  assert.equal(inbound.direction, 'inbound'); assert.equal(inbound.body, 'Hello'); assert.equal(inbound.unread, true)
  const cc = structuredClone(raw); cc.payload.headers[0].value = 'someone@example.com'; cc.payload.headers.push({ name: 'Cc', value: person.email })
  assert.equal(storeConversationMessage(cc, mailbox.email, new Set([person.email])), null)
  const notification = structuredClone(raw); notification.payload.headers.push({ name: 'Return-Path', value: 'copy@notifications.opus1.io' })
  assert.equal(storeConversationMessage(notification, mailbox.email, new Set([person.email])), null)
  raw.labelIds = ['SENT']; raw.payload.headers[0].value = mailbox.email; raw.payload.headers[1].value = person.email
  const sent = storeConversationMessage(raw, mailbox.email, new Set([person.email]))
  assert.equal(sent.direction, 'outbound'); assert.equal(sent.unread, false)
})

function executingWorker(kind, provider, options = {}) {
  const commits = [], writes = [], reads = []
  const job = { id: 'job', tenant_id: 'tenant', connection_id: 'box', kind, range_start: '2026-10-01T00:00:00Z', range_end: '2026-11-01T00:00:00Z', addresses: [person.email], checkpoint: {}, lease_token: 'lease', attempts: 0 }
  if (options.checkpoint) job.checkpoint = options.checkpoint
  if (options.addresses) job.addresses = options.addresses
  const db = {
    async rpc(name, args) { await options.onDatabase?.(name); if (name === 'conversation_email_claim') return { data: [job] }; commits.push(args); return { data: options.rejectCommit ? false : true } },
    from(table) {
      const q = { select() { return q }, eq(field, value) { reads.push([table, field, value]); return q }, update(value) { writes.push([table, value]); return q },
        async single() { await options.onDatabase?.(table); return { data: { email: mailbox.email, refresh_token_ciphertext: 'encrypted', connected_by: 'member' } } },
        async maybeSingle() { await options.onDatabase?.(table); return { data: table === 'tenant_memberships' ? { status: options.revoked ? 'inactive' : 'active', role_id: 'role' } : table === 'roles' ? { key: 'owner' } : kind === 'history' && !options.noBaseline ? { history_id: 'old' } : null } },
        then(resolve, reject) { return Promise.resolve(options.onDatabase?.(`cleanup:${table}`)).then(() => ({ error: null })).then(resolve, reject) },
      }
      return q
    },
  }
  const run = worker(db, {
    '@/lib/supabase/admin': { supabaseAdmin: db },
    '@/lib/conversations-directory': { conversationDirectory: async tenant => { assert.equal(tenant, 'tenant'); return options.people || [person] } },
    '@/lib/conversation-email-range': { isLeadEmailContact: () => true },
    '@/lib/conversation-email-query': options.realQuery ? emailQuery : { conversationEmailQuery: () => ({ audience: person.email, empty: false, nextCursor: () => null }) },
    './security': { decryptToken: () => 'refresh' },
    './google': { googleToken: options.token || (async () => ({ access_token: 'access' })), GmailReadError: ProviderError, GoogleTokenError: TokenError, gmailGet: provider },
  }, options.globals)
  return { run, commits, writes, reads }
}
class ProviderError extends Error { constructor(status) { super('synthetic'); this.status = status } }
class TokenError extends Error { constructor(reconnect) { super('synthetic'); this.reconnect = reconnect } }

test('resumed import preserves its queued search groups when current lead addresses change', async () => {
  const addresses = Array.from({ length: 26 }, (_, i) => `parent${String(i).padStart(2, '0')}@example.com`)
  const cursor = `lead-range:${encodeURIComponent(JSON.stringify({ group: 1, page: 'saved-page' }))}`
  let searched = false
  const fixture = executingWorker('import', async (token, path) => {
    if (path === 'profile') return { historyId: 'initial' }
    if (path.startsWith('messages?')) {
      const query = new URLSearchParams(path.slice('messages?'.length))
      assert.equal(query.get('pageToken'), 'saved-page')
      assert.ok(query.get('q').includes(addresses[25]))
      searched = true
      return { messages: [{ id: 'removed-lead-message' }] }
    }
    assert.match(path, /^messages\/removed-lead-message/)
    return { id: 'removed-lead-message', threadId: 'thread', internalDate: String(Date.parse('2026-10-20T12:00:00Z')),
      payload: { headers: [{ name: 'From', value: addresses[25] }, { name: 'To', value: mailbox.email }] } }
  }, { addresses, checkpoint: { cursor }, people: [], realQuery: true })
  const result = await fixture.run.runConversationEmailJob()
  assert.equal(searched, true)
  assert.equal(result.complete, true)
  assert.equal(fixture.commits.length, 1)
  assert.equal(fixture.commits[0].p_messages.length, 0, 'Removed leads are not materialized')
  assert.equal(fixture.commits[0].p_deleted.join(','), 'removed-lead-message')
})

for (const stage of ['conversation_email_claim', 'tenant_memberships']) test(`database delay at ${stage} prevents provider work and completion`, async () => {
  let now = 100000
  class Clock extends Date { static now() { return now } }
  const fixture = executingWorker('history', async () => assert.fail('Provider work after budget expiry'), {
    globals: { Date: Clock }, token: async () => assert.fail('Token after budget expiry'),
    onDatabase(name) { if (name === stage) now += 20000 },
  })
  assert.equal((await fixture.run.runConversationEmailJob(120000)).delayed, true)
  assert.equal(fixture.commits.length, 0)
  assert.equal(fixture.writes[0][1].status, 'delayed')
})

test('rejected slow commit and delayed cleanup never report completion', async () => {
  let now = 100000
  class Clock extends Date { static now() { return now } }
  const fixture = executingWorker('history', async () => ({ historyId: 'new' }), {
    globals: { Date: Clock }, rejectCommit: true,
    onDatabase(name) { if (name === 'conversation_email_commit' || name.startsWith('cleanup:')) now += 120000 },
  })
  const result = await fixture.run.runConversationEmailJob(120000)
  assert.equal(result.delayed, true)
  assert.equal(result.complete, undefined)
  assert.equal(now, 340000, 'Cleanup was awaited even after the work budget')
  assert.ok(fixture.reads.some(([table, field, value]) => table === 'conversation_email_jobs' && field === 'lease_token' && value === 'lease'))
})

test('initial history profile establishes a baseline without claiming a completed sync', async () => {
  const fixture = executingWorker('history', async (token, path) => { assert.equal(path, 'profile'); return { historyId: 'initial' } }, { noBaseline: true })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.commits[0].p_history, 'initial')
  assert.equal(fixture.commits[0].p_complete, false)
})

test('revoked membership stops before token or provider access', async () => {
  const unexpected = async () => { assert.fail('Provider access after revocation') }
  const fixture = executingWorker('import', unexpected, { revoked: true, token: unexpected })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.commits.length, 0)
  assert.equal(fixture.writes[0][1].status, 'delayed')
})

test('invalid refresh grants pause for reconnect while temporary token failures retry', async () => {
  for (const reconnect of [true, false]) {
    const fixture = executingWorker('import', async () => assert.fail('No Gmail call expected'), { token: async () => { throw new TokenError(reconnect) } })
    await fixture.run.runConversationEmailJob()
    assert.equal(fixture.commits.length, 0)
    assert.equal(fixture.writes[0][1].status, reconnect ? 'reconnect' : 'delayed')
    assert.ok(fixture.reads.some(([table, field, value]) => table === 'conversation_email_jobs' && field === 'lease_token' && value === 'lease'))
  }
})

test('history yields outstanding IDs without advancing history and resumes without re-listing', async () => {
  let now = 100000
  class Clock extends Date { static now() { return now } }
  const raw = { id: 'one', threadId: 'thread', internalDate: String(Date.parse('2026-10-20T12:00:00Z')), payload: { headers: [{ name: 'From', value: person.email }, { name: 'To', value: mailbox.email }] } }
  const first = executingWorker('history', async (token, path, deadline) => {
    assert.equal(deadline, 117000)
    if (path.startsWith('history?')) return { historyId: 'next', nextPageToken: 'page-two', history: [{ messagesAdded: [{ message: { id: 'one' } }, { message: { id: 'two' } }] }] }
    assert.match(path, /^messages\/one/); now = 116000; return raw
  }, { globals: { Date: Clock } })
  await first.run.runConversationEmailJob(120000)
  const commit = first.commits[0]
  assert.equal(commit.p_messages.length, 1)
  assert.equal(commit.p_history, null)
  assert.equal(commit.p_complete, false)
  assert.equal(commit.p_checkpoint.batch.ids.join(','), 'two')
  assert.equal(commit.p_checkpoint.batch.next.cursor, 'page-two')
  assert.equal(commit.p_checkpoint.batch.next.history, 'old')
  const second = executingWorker('history', async (token, path) => {
    assert.match(path, /^messages\/two/); return { ...raw, id: 'two' }
  }, { checkpoint: commit.p_checkpoint })
  await second.run.runConversationEmailJob()
  assert.equal(second.commits[0].p_checkpoint.cursor, 'page-two')
  assert.equal(second.commits[0].p_history, null)
})

test('finishing a suspended final history page advances its baseline exactly once', async () => {
  const fixture = executingWorker('history', async () => { throw new ProviderError(404) }, {
    checkpoint: { batch: { ids: ['gone'], deleted: [], next: {}, complete: true, history: 'final' } },
  })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.commits[0].p_history, 'final')
  assert.equal(fixture.commits[0].p_complete, true)
  assert.equal(fixture.commits[0].p_deleted.join(','), 'gone')
})

test('no remaining runtime avoids claiming work', async () => {
  const fixture = executingWorker('history', async () => assert.fail('No provider work expected'))
  assert.equal((await fixture.run.runConversationEmailJob(Date.now())).idle, true)
  assert.equal(fixture.reads.length, 0)
})

test('range filtering never deletes a valid message stored by another overlapping import', async () => {
  const fixture = executingWorker('import', async (token, path) => {
    if (path === 'profile') return { historyId: 'baseline' }
    if (path.startsWith('messages?')) return { messages: [{ id: 'outside' }] }
    return { id: 'outside', threadId: 'thread', internalDate: String(Date.parse('2026-09-30T23:59:59Z')), payload: { headers: [{ name: 'From', value: person.email }, { name: 'To', value: mailbox.email }] } }
  })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.commits[0].p_messages.length, 0)
  assert.equal(fixture.commits[0].p_deleted.length, 0)
})

test('initial import obtains history baseline before listing messages and commits both together', async () => {
  const paths = []
  const fixture = executingWorker('import', async (token, path) => {
    assert.equal(token, 'access'); paths.push(path)
    return path === 'profile' ? { historyId: 'baseline' } : { messages: [] }
  })
  await fixture.run.runConversationEmailJob()
  assert.equal(paths[0], 'profile'); assert.match(paths[1], /^messages\?/)
  assert.equal(fixture.commits[0].p_history, 'baseline')
  assert.equal(fixture.commits[0].p_complete, true)
  assert.ok(fixture.reads.some(([table, field, value]) => table === 'gmail_connections' && field === 'tenant_id' && value === 'tenant'))
})

test('expired provider history requests fenced recovery without directly resetting imports', async () => {
  const fixture = executingWorker('history', async (token, path) => {
    if (path.startsWith('history?')) throw new ProviderError(404)
    assert.equal(path, 'profile'); return { historyId: 'replacement' }
  })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.writes.length, 0)
  assert.equal(fixture.commits.length, 1)
  assert.equal(fixture.commits[0].p_history, 'replacement')
  assert.equal(fixture.commits[0].p_checkpoint.recover, true)
})

test('history deletions and disappeared changed messages commit as scoped removals', async () => {
  const fixture = executingWorker('history', async (token, path) => {
    if (path.startsWith('history?')) return { historyId: 'next', history: [{ messagesDeleted: [{ message: { id: 'deleted' } }], messagesAdded: [{ message: { id: 'gone' } }] }] }
    throw new ProviderError(404)
  })
  await fixture.run.runConversationEmailJob()
  assert.equal(fixture.commits[0].p_deleted.join(','), 'deleted,gone')
  assert.equal(fixture.commits[0].p_history, 'next')
})
test('stored message projection enforces message-level association and stable thread IDs without Bcc', () => {
  const { storedEmailThreads } = load('lib/gmail/conversation-store.ts', { '@/lib/supabase/crm-admin': {}, '@/lib/organisation-email': {}, '@/lib/conversations-live': live, './conversations': conversations })
  const row = { provider_message_id: 'm', provider_thread_id: 't', sent_at: '2026-10-20T12:00:00Z', direction: 'inbound', sender: person.email, recipients: [mailbox.email], copied_recipients: [], participants: [person.email], subject: 'Lesson', body: 'Full message', unread: true }
  const threads = storedEmailThreads([row, row], [person], mailbox, false)
  assert.equal(threads.length, 1); assert.equal(threads[0].id, 'email:box:t:lead:one'); assert.equal(threads[0].messages.length, 1)
  assert.equal(threads[0].messages[0].body, 'Full message')
  assert.equal(storedEmailThreads([row], [person], mailbox, true)[0].messages[0].body, '')
  assert.equal(storedEmailThreads([row], [{ ...person, email: 'other@example.com' }], mailbox, false).length, 0)
})
test('an empty durable queue performs no provider work', async () => {
  let calls = 0
  const result = await worker({ rpc: async name => { calls++; assert.equal(name, 'conversation_email_claim'); return { data: [], error: null } } }).runConversationEmailJob()
  assert.equal(result.idle, true); assert.equal(calls, 1)
})
test('schema fences stale workers, commits checkpoints with messages, isolates tenants and bounds global concurrency', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202610290001_conversation_email_store.sql'), 'utf8')
  assert.match(sql, /FOR UPDATE SKIP LOCKED/)
  assert.match(sql, /lease_token=p_lease AND lease_until>now\(\)/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /pg_advisory_xact_lock\(72910377\);\s+wall := clock_timestamp\(\)/)
  assert.match(sql, /lease_until>wall\)>=4/)
  assert.match(sql, /lease_until=clock_timestamp\(\)\+interval '120 seconds'/)
  assert.match(sql, /FOREIGN KEY \(tenant_id,connection_id\)/)
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 3)
  assert.match(sql, /FROM PUBLIC,anon,authenticated/)
})

test('database pages of the same thread merge without dropping messages or duplicating boundaries', () => {
  const { mergeEmailPages } = load('lib/conversation-email-merge.ts', {})
  const base = { ...live.personThread(person), id: 'email:box:t:lead:one', channel: 'email' }
  const older = { id: 'older', channel: 'email', direction: 'inbound', timestamp: '2026-10-10T12:00:00Z', body: 'Older', time: '' }
  const newer = { ...older, id: 'newer', timestamp: '2026-10-20T12:00:00Z', unread: true }
  const result = mergeEmailPages([{ ...base, messages: [newer] }], [{ ...base, messages: [older, newer] }])
  assert.equal(result.length, 1)
  assert.equal(result[0].messages.length, 2)
  assert.equal(result[0].messages[0].id, 'older')
  assert.equal(result[0].unread, true)
})