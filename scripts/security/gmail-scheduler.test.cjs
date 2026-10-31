/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic scheduler execution, no provider access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { timingSafeEqual, createHmac } = require('node:crypto')
const root = path.resolve(__dirname, '../..')

function scheduler(env, options = {}) {
  const calls = []
  const rows = options.connections || [{ id: 'mailbox', tenant_id: 'tenant', connected_by: 'member' }]
  const db = { async rpc(name, args) {
    assert.equal(name, 'gmail_schedule_sync'); assert.equal(args.p_limit, 5)
    calls.push('connections'); await options.onDatabase?.('schedule')
    return { data: rows, error: null }
  }, from(table) {
    const query = { select() { return query }, eq() { return query }, order() { return query },
      async limit() { calls.push('connections'); return { data: rows, error: null } },
      async maybeSingle() {
        await options.onDatabase?.(table)
        return { data: table === 'tenant_memberships'
          ? { status: options.revoked ? 'inactive' : 'active', role_id: 'role' }
          : { key: 'owner' }, error: null }
      },
    }
    return query
  } }
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'app/api/internal/gmail-sync/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dependencies = {
    'node:crypto': { createHmac },
    'next/server': { NextResponse: Response },
    '@/lib/gmail/security': { secretMatches: (a, b) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)) },
    '@/lib/gmail/conversation-worker': { runConversationEmailJob: async deadline => { if (options.failConversation) throw Error('synthetic queue outage'); return options.conversation ? options.conversation(deadline) : { idle: true } } },
    '@/lib/gmail/conversation-preload': { preloadConversationEmail: async deadline => { if (options.preload) await options.preload(deadline) } },
    '@/lib/gmail/sync': { syncMailbox: async (...args) => { calls.push(args); if (options.failSync) throw Error('synthetic failure'); return options.sync ? await options.sync(...args) || {} : {} } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: db },
    '@/lib/supabase/admin': { supabaseAdmin: db },
    '@/lib/permissions': { PERMISSIONS: {} },
  }
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Date: options.Clock || Date, process: { env }, require: id => {
    assert.ok(dependencies[id], `Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return { GET: loaded.exports.GET, calls }
}

test('cron rejects missing, wrong, and weak secrets before database access', async () => {
  for (const [env, authorization] of [[{}, ''], [{ CRON_SECRET: 'short' }, 'Bearer short'], [{ CRON_SECRET: 'x'.repeat(40) }, 'Bearer wrong']]) {
    const run = scheduler(env)
    const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization } }))
    assert.equal(response.status, 401)
    assert.equal(run.calls.length, 0)
  }
})

test('scheduler bearer authenticates and syncs authorized membership', async () => {
  const secret = 'x'.repeat(40)
  const run = scheduler({ CRON_SECRET: secret })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 1, failed: 0 })
  assert.equal(run.calls[1][0], 'tenant')
  assert.equal(run.calls[1][1], 'mailbox')
})

test('background preload runs before conversation jobs and only with stored mode enabled', async () => {
  const secret = 'x'.repeat(40)
  for (const enabled of [false, true]) {
    const events = []
    const run = scheduler({ CRON_SECRET: secret, ...(enabled ? { CONVERSATION_EMAIL_STORE: '1' } : {}) }, {
      preload(deadline) { assert.ok(deadline > Date.now()); events.push('preload') },
      conversation() { events.push('worker'); return { idle: true } },
    })
    await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
    assert.deepEqual(events, enabled ? ['preload', 'worker'] : [])
  }
})

test('preload failure does not stop already queued jobs or legacy capture', async () => {
  const secret = 'x'.repeat(40)
  let worked = false
  const run = scheduler({ CRON_SECRET: secret, CONVERSATION_EMAIL_STORE: '1' }, {
    preload() { throw Error('Unavailable') },
    conversation() { worked = true; return { idle: true } },
  })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.equal(worked, true)
  assert.deepEqual(await response.json(), { synced: 1, failed: 0, conversationFailed: true })
})

test('cron refuses a revoked membership without syncing', async () => {
  const secret = 'x'.repeat(40)
  const run = scheduler({ CRON_SECRET: secret }, { revoked: true })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 0, failed: 1 })
  assert.equal(run.calls.length, 1)
})

test('conversation queue failure does not prevent existing lead-note capture', async () => {
  const secret = 'x'.repeat(40)
  const run = scheduler({ CRON_SECRET: secret, CONVERSATION_EMAIL_STORE: '1' }, { failConversation: true })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 1, failed: 0, conversationFailed: true })
  assert.equal(run.calls[1][1], 'mailbox')
})

test('Vercel does not schedule Gmail capture on Hobby', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.equal(config.crons, undefined)
})

test('scheduler shares a 150-second budget and defers mailboxes after conversation work', async () => {
  const secret = 'x'.repeat(40)
  let now = 100000
  class Clock extends Date { static now() { return now } }
  let jobs = 0
  const run = scheduler({ CRON_SECRET: secret, CONVERSATION_EMAIL_STORE: '1' }, {
    Clock,
    connections: Array.from({ length: 5 }, (_, i) => ({ id: `mailbox-${i}`, tenant_id: 'tenant', connected_by: 'member' })),
    conversation(deadline) { assert.equal(deadline, now + 20000); now = deadline; jobs++; return { complete: false } },
    sync(tenant, mailbox, budget) { assert.equal(budget, 30000); now += budget },
  })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 3, failed: 0, deferred: 2 })
  assert.equal(jobs, 3)
  assert.equal(now, 250000)
})

test('scheduler shrinks the final mailbox budget instead of starting another full batch', async () => {
  const secret = 'x'.repeat(40)
  let now = 100000
  class Clock extends Date { static now() { return now } }
  const budgets = []
  const run = scheduler({ CRON_SECRET: secret }, {
    Clock,
    connections: Array.from({ length: 5 }, () => ({ id: 'mailbox', tenant_id: 'tenant', connected_by: 'member' })),
    sync(tenant, mailbox, budget) { budgets.push(budget); now += 35000 },
  })
  await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(budgets, [30000, 30000, 30000, 30000, 10000])
})

for (const stage of ['schedule', 'tenant_memberships']) test(`scheduler stops admission after a slow ${stage} query`, async () => {
  const secret = 'x'.repeat(40)
  let now = 100000
  class Clock extends Date { static now() { return now } }
  const run = scheduler({ CRON_SECRET: secret }, { Clock, onDatabase(name) { if (name === stage) now += 160000 } })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 0, failed: 0, deferred: 1 })
  assert.equal(run.calls.length, 1)
})

test('busy legacy mailbox is deferred rather than reported synced', async () => {
  const secret = 'x'.repeat(40)
  const run = scheduler({ CRON_SECRET: secret }, { sync: () => ({ busy: true }) })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 0, failed: 0, deferred: 1 })
})

test('Supabase signed requests authenticate without a reusable bearer', async () => {
  const secret = 'x'.repeat(40)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', secret).update(`gmail-sync:${timestamp}`).digest('hex')
  const run = scheduler({ CRON_SECRET: secret })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: {
    'x-gmail-sync-timestamp': timestamp, 'x-gmail-sync-signature': signature,
  } }))
  assert.deepEqual(await response.json(), { synced: 1, failed: 0 })
})

test('expired, future, malformed and invalid signatures reject before database access', async () => {
  const secret = 'x'.repeat(40)
  const now = Math.floor(Date.now() / 1000)
  for (const timestamp of [String(now - 180), String(now + 180), 'invalid', String(now)]) {
    const signature = createHmac('sha256', timestamp === String(now) ? 'wrong' : secret).update(`gmail-sync:${timestamp}`).digest('hex')
    const run = scheduler({ CRON_SECRET: secret })
    const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: {
      'x-gmail-sync-timestamp': timestamp, 'x-gmail-sync-signature': signature,
    } }))
    assert.equal(response.status, 401)
    assert.equal(run.calls.length, 0)
  }
})