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
  const db = { from(table) {
    const query = { select() { return query }, eq() { return query }, order() { return query },
      async limit() { calls.push('connections'); return { data: rows, error: null } },
      async maybeSingle() {
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
    '@/lib/gmail/sync': { syncMailbox: async (...args) => { calls.push(args); if (options.failSync) throw Error('synthetic failure') } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: db },
    '@/lib/supabase/admin': { supabaseAdmin: db },
    '@/lib/permissions': { PERMISSIONS: {} },
  }
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, process: { env }, require: id => {
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

test('cron refuses a revoked membership without syncing', async () => {
  const secret = 'x'.repeat(40)
  const run = scheduler({ CRON_SECRET: secret }, { revoked: true })
  const response = await run.GET(new Request('https://example.com/api/internal/gmail-sync', { headers: { authorization: `Bearer ${secret}` } }))
  assert.deepEqual(await response.json(), { synced: 0, failed: 1 })
  assert.equal(run.calls.length, 1)
})

test('Vercel does not schedule Gmail capture on Hobby', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  assert.equal(config.crons, undefined)
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