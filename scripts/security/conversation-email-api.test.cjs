/* eslint-disable @typescript-eslint/no-require-imports -- Execute real route/store with an isolated fluent database and no provider. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Buffer, URL, URLSearchParams, Date, console: { warn() {} }, process: { env: { CONVERSATION_EMAIL_STORE: '1' } }, require(id) {
    if (id.startsWith('node:')) return require(id)
    assert.ok(id in dependencies, `Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  return loaded.exports
}
const person = { id: 'lead:one', name: 'Parent', email: 'parent@example.com', phone: '', student: '', stage: '', profileType: 'lead', profileId: 'one', smsContactId: 'one' }
const other = { ...person, id: 'lead:other', email: 'other@example.com' }
const base = { tenant_id: 'tenant', connection_id: 'box', provider_message_id: 'm', provider_thread_id: 'thread', sent_at: '2026-10-20T12:00:00Z', direction: 'inbound', sender: person.email, recipients: ['office@example.com'], copied_recipients: [], participants: [person.email], subject: 'Lesson', body: 'Saved body', unread: true }
const unexpected = () => assert.fail('Stored reads must not call Gmail or refresh credentials')
const rules = load('lib/gmail/rules.ts')
const live = load('lib/conversations-live.ts')
const conversations = load('lib/gmail/conversations.ts', { '@/lib/supabase/crm-admin': {}, './security': {}, './google': {}, './rules': rules, '@/lib/organisation-email': {} })

function harness(options = {}) {
  const reads = [], writes = []
  const connections = options.connections || [{ id: 'box', tenant_id: 'tenant', connected_by: 'member', email: 'office@example.com' }]
  const messages = options.messages || [base]
  const db = { from(table) {
    const filters = [], sorting = []
    let pageSize, before
    const result = () => {
      reads.push({ table, filters: [...filters], sorting: [...sorting], pageSize, before })
      if (options.failTable === table) return { data: null, error: { message: 'synthetic database error' } }
      if (table === 'conversation_email_mailboxes') return { data: { last_synced_at: options.lastSyncedAt === undefined ? new Date().toISOString() : options.lastSyncedAt }, error: null }
      if (table === 'conversation_email_jobs') return { data: { status: filters.some(([key, value]) => key === 'job_key' && value === 'history') ? (options.historyStatus || 'pending') : (options.importStatus || 'complete'), processed: 12 }, error: null }
      let data = (table === 'gmail_connections' ? connections : messages).filter(row => filters.every(([key, value, op]) => op === 'gte' ? row[key] >= value : op === 'lt' ? row[key] < value : op === 'overlaps' ? row[key].some(item => value.includes(item)) : row[key] === value))
      if (table === 'gmail_connections') return { data: data[0] ? { id: data[0].id, email: data[0].email } : null, error: null }
      data = data.sort((a, b) => b.sent_at.localeCompare(a.sent_at) || b.provider_message_id.localeCompare(a.provider_message_id))
      if (before) {
        const match = /^sent_at.lt.(.+),and\(sent_at.eq.(.+),provider_message_id.lt.([\w-]+)\)$/.exec(before)
        assert.ok(match, 'Keyset predicate is constrained')
        data = data.filter(row => row.sent_at < match[1] || (row.sent_at === match[2] && row.provider_message_id < match[3]))
      }
      return { data: data.slice(0, pageSize), error: null }
    }
    const q = {
      select() { return q }, eq(key, value) { filters.push([key, value]); return q },
      gte(key, value) { filters.push([key, value, 'gte']); return q }, lt(key, value) { filters.push([key, value, 'lt']); return q },
      overlaps(key, value) { filters.push([key, value, 'overlaps']); return q }, or(value) { before = value; return q },
      order(key, value) { sorting.push([key, value]); return q }, limit(value) { pageSize = value; return Promise.resolve(result()) },
      maybeSingle: async () => result(), single: async () => result(),
      async upsert(rows, config) { writes.push({ table, rows, config }); return { error: options.failQueue ? {} : null } },
    }
    return q
  } }
  const organisation = { organisationEmailSettings: async tenant => { assert.equal(tenant, 'tenant'); return options.shared ? { connection_id: 'box' } : null }, organisationSender: unexpected }
  const store = load('lib/gmail/conversation-store.ts', { '@/lib/supabase/crm-admin': { crmSupabaseAdmin: db }, '@/lib/organisation-email': organisation, '@/lib/conversations-live': live, './conversations': conversations })
  const api = load('app/api/conversations/email/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/organisation-email': organisation,
    '@/lib/headliner-email-templates': {}, '@/lib/tenant-request': { authorizeTenantRequest: async () => options.denied ? { ok: false, status: 403, error: 'Denied' } : { ok: true, tenantId: 'tenant', context: { membershipId: 'member', roleKey: 'staff', permissions: new Set(['leads']) } } },
    '@/lib/permissions': { PERMISSIONS: { communicationsRead: 'read', leadsRead: 'leads', contactsRead: 'contacts' } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: db }, '@/lib/conversations-directory': { conversationDirectory: async (tenant, contacts, leads) => { assert.equal(tenant, 'tenant'); assert.equal(contacts, false); return leads ? [person, other, { ...person, id: 'contact:one', profileType: 'contact' }] : [] } },
    '@/lib/gmail/conversations': { ...conversations, conversationMailbox: unexpected, gmailGet: unexpected }, '@/lib/gmail/rules': rules,
    '@/lib/conversations-live': live, '@/lib/account-audit': {}, '@/lib/conversations-preview': {},
    '@/lib/gmail/google': { GmailReadError: class extends Error {} }, '@/lib/conversation-email-range': load('lib/conversation-email-range.ts'),
    '@/lib/conversation-email-query': {}, '@/lib/gmail/conversation-store': store,
  })
  const get = query => api.GET(new Request(`https://example.com/api/conversations/email?tenant=tenant&mailbox=box&person=lead:one&from=2026-10-01&to=2026-10-28&${query || ''}`))
  return { get, reads, writes, store }
}

test('stored API reads saved bodies without provider access and scopes every query/job to the mailbox tenant', async () => {
  const h = harness({ messages: [base, { ...base, tenant_id: 'foreign', provider_message_id: 'foreign' }, { ...base, connection_id: 'other', provider_message_id: 'other' }, { ...base, participants: [other.email], provider_message_id: 'unrelated' }] })
  const response = await h.get()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const data = await response.json()
  assert.equal(data.threads.length, 1)
  assert.equal(data.threads[0].messages.length, 1)
  assert.equal(data.threads[0].messages[0].body, 'Saved body')
  assert.equal(data.sync.state, 'complete')
  for (const read of h.reads) {
    assert.ok(read.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant'))
    assert.ok(read.filters.some(([key, value]) => ['connection_id', 'id'].includes(key) && value === 'box'))
  }
  assert.equal(h.writes.length, 1)
  assert.ok(h.writes[0].rows.every(job => job.tenant_id === 'tenant' && job.connection_id === 'box'))
  assert.ok(h.writes[0].rows.every(job => Array.isArray(job.addresses)), 'Bulk queue rows must not turn missing addresses into SQL NULL')
  assert.equal(h.writes[0].config.ignoreDuplicates, true)
})

test('denied membership, foreign tenants and unowned private mailboxes cannot read or queue imports', async () => {
  for (const options of [{ denied: true }, { connections: [{ id: 'box', tenant_id: 'foreign', connected_by: 'member' }] }, { connections: [{ id: 'box', tenant_id: 'tenant', connected_by: 'someone-else' }] }]) {
    const h = harness(options)
    const response = await h.get()
    assert.notEqual(response.status, 200)
    assert.equal(h.writes.length, 0)
    assert.equal(h.reads.filter(read => read.table === 'conversation_email_messages').length, 0)
  }
})

test('configured shared mailbox permits authorized staff without ownership but never crosses tenants', async () => {
  const h = harness({ shared: true, connections: [{ id: 'box', tenant_id: 'tenant', connected_by: 'owner', email: 'office@example.com' }] })
  assert.equal((await h.get()).status, 200)
  assert.ok(!h.reads[0].filters.some(([key]) => key === 'connected_by'))
  const foreign = harness({ shared: true, connections: [{ id: 'box', tenant_id: 'foreign', connected_by: 'owner' }] })
  assert.notEqual((await foreign.get()).status, 200)
  assert.equal(foreign.writes.length, 0)
})

test('stored API rejects malformed cursors before queueing or reading messages', async () => {
  for (const cursor of ['legacy', 'store:%', 'store:null', `store:${encodeURIComponent(JSON.stringify({ at: base.sent_at, id: 'x),tenant_id.eq.foreign' }))}`, `store:${'x'.repeat(1025)}`]) {
    const h = harness()
    const response = await h.get(`cursor=${encodeURIComponent(cursor)}`)
    assert.equal(response.status, 400)
    assert.equal(h.writes.length, 0)
    assert.equal(h.reads.filter(read => read.table === 'conversation_email_messages').length, 0)
  }
})

test('stored keyset pagination preserves same-thread messages and ignores new rows above the cursor', async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ ...base, provider_message_id: `m${String(index).padStart(3, '0')}` }))
  const first = await (await harness({ messages: rows }).get()).json()
  assert.equal(first.threads[0].messages.length, 200)
  assert.ok(first.nextCursor.startsWith('store:'))
  const second = await (await harness({ messages: [...rows, { ...base, provider_message_id: 'new', sent_at: '2026-10-21T12:00:00Z' }] }).get(`cursor=${encodeURIComponent(first.nextCursor)}`)).json()
  assert.equal(second.threads[0].messages.length, 1)
  assert.equal(second.threads[0].messages[0].id, 'm000')
  assert.equal(second.nextCursor, null)
  const ids = [...first.threads, ...second.threads].flatMap(thread => thread.messages.map(message => message.id))
  assert.equal(new Set(ids).size, 201)
})

test('summary hides bodies and contacts that are not leads', async () => {
  const data = await (await harness().get('summary=1')).json()
  assert.equal(data.threads[0].messages[0].body, '')
  assert.ok(data.threads.every(thread => !thread.id.includes('contact:one')))
})

test('history delay/reconnect override import completeness while unfinished imports remain pending', async () => {
  for (const [options, state] of [[{ historyStatus: 'reconnect' }, 'reconnect'], [{ historyStatus: 'delayed' }, 'delayed'], [{ importStatus: 'pending' }, 'pending']]) {
    const data = await (await harness(options).get()).json()
    assert.equal(data.sync.state, state)
  }
})

test('database failures never report empty complete history', async () => {
  for (const options of [{ failQueue: true }, { failTable: 'conversation_email_jobs' }, { failTable: 'conversation_email_messages' }, { failTable: 'conversation_email_mailboxes' }]) {
    const response = await harness(options).get()
    assert.equal(response.status, 503)
    const data = await response.json()
    assert.ok(data.error)
    assert.equal(data.sync, undefined)
  }
})

test('completed imports do not claim fresh history without a recent completed history sync', async () => {
  for (const [lastSyncedAt, freshness] of [[null, 'pending'], ['invalid', 'pending'], [new Date(Date.now() + 60000).toISOString(), 'pending'], [new Date(Date.now() - 1200000).toISOString(), 'stale'], [new Date(Date.now() - 600000).toISOString(), 'current']]) {
    const data = await (await harness({ lastSyncedAt }).get()).json()
    assert.equal(data.sync.importComplete, true)
    assert.equal(data.sync.freshness, freshness)
    assert.equal(data.sync.state, freshness === 'current' ? 'complete' : freshness)
    assert.equal(data.sync.lastSyncedAt, freshness === 'pending' ? null : lastSyncedAt)
  }
})