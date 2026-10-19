/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node tests with mocked providers. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')

function load(file, dependencies) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require: id => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return loaded.exports
}

function route(options = {}) {
  const calls = []
  const query = { select(value) { calls.push(['select', value]); return query }, eq(...args) { calls.push(['eq', ...args]); return query }, order() { return query }, async limit() {
    return { data: options.connections ?? [{ id: 'mailbox' }], error: options.dbError ? {} : null }
  } }
  return { calls, ...load('app/api/leads/sync/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => {
      calls.push(['authorize'])
      return options.denied ? { ok: false, error: 'Forbidden', status: 403 } : { ok: true, tenantId: 'tenant-a', context: options.noContext ? null : {
        roleKey: options.role || 'admin', permissions: new Set(options.permissions || []),
      } }
    } },
    '@/lib/permissions': { PERMISSIONS: { leadsManage: 'leads.manage' } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from: table => { calls.push(['from', table]); return query } } },
    '@/lib/gmail/sync': { syncMailbox: async (...args) => {
      calls.push(['sync', ...args])
      if (options.fail || args[1] === 'broken') throw Error('private provider details')
      return options.result || { recorded: 2, review: 1, more: false }
    } },
  }) }
}
const request = () => new Request('https://example.com/api/leads/sync', { method: 'POST', body: JSON.stringify({ tenantId: 'foreign', id: 'foreign-mailbox' }) })

test('lead email sync requires a verified account before querying or capturing', async () => {
  for (const method of ['GET', 'POST']) {
    const run = route({ denied: true })
    assert.equal((await run[method](request())).status, 403)
    assert.deepEqual(run.calls, [['authorize']])
  }
})

test('all admins and owners can check status and sync without special permission grants', async () => {
  for (const role of ['admin', 'owner']) {
    for (const method of ['GET', 'POST']) {
      assert.equal((await route({ role, permissions: [] })[method](request())).status, 200)
    }
  }
})

test('delegated lead managers retain access but other staff and demo contexts cannot capture', async () => {
  for (const method of ['GET', 'POST']) {
    assert.equal((await route({ role: 'staff', permissions: ['leads.manage'] })[method](request())).status, 200)
    for (const options of [{ role: 'staff' }, { noContext: true }]) {
      const run = route(options)
      assert.equal((await run[method](request())).status, 403)
      assert.deepEqual(run.calls, [['authorize']])
    }
  }
})

test('lead sync is tenant scoped and ignores client supplied mailbox IDs', async () => {
  const run = route()
  const response = await run.POST(request())
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Cache-Control'), /no-store/)
  assert.deepEqual(await response.json(), { recorded: 2, review: 1, busy: 0, failed: 0, more: false })
  assert.ok(run.calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'tenant_id', 'tenant-a'])))
  assert.deepEqual(run.calls.find(call => call[0] === 'sync'), ['sync', 'tenant-a', 'mailbox', 30000])
  assert.deepEqual(run.calls.find(call => call[0] === 'select'), ['select', 'id'])
})

test('status exposes connection availability only', async () => {
  const run = route()
  assert.deepEqual(await (await run.GET(request())).json(), { connected: true })
  assert.ok(!run.calls.some(call => call[0] === 'sync'))
})

test('missing mailboxes and database failures are actionable without capture', async () => {
  assert.equal((await route({ connections: [] }).POST(request())).status, 409)
  assert.equal((await route({ dbError: true }).POST(request())).status, 503)
})

test('busy and pagination results do not falsely claim capture', async () => {
  const run = route({ result: { recorded: 0, review: 0, busy: true, more: true } })
  assert.deepEqual(await (await run.POST(request())).json(), { recorded: 0, review: 0, busy: 1, failed: 0, more: true })
})

test('partial failures retain successful results; complete failure returns 503 without private errors', async () => {
  const run = route({ connections: [{ id: 'mailbox' }, { id: 'broken' }] })
  const response = await run.POST(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).failed, 1)
  const failed = await route({ fail: true }).POST(request())
  assert.equal(failed.status, 503)
  assert.ok(!(await failed.text()).includes('private provider'))
})

test('a request processes at most five mailboxes and reports remaining work', async () => {
  const run = route({ connections: Array.from({ length: 6 }, (_, id) => ({ id: String(id) })) })
  assert.equal((await (await run.POST(request())).json()).more, true)
  assert.equal(run.calls.filter(call => call[0] === 'sync').length, 5)
})

test('shared sync control preserves Dashboard styling and accessible busy state', () => {
  const tokens = load('lib/tokens.ts', {})
  const jsx = require('react/jsx-runtime')
  const base = load('components/ui/ButtonBase.tsx', { react: React, 'react/jsx-runtime': jsx })
  const button = load('components/ui/Button.tsx', { 'react/jsx-runtime': jsx, '@/components/ui/ButtonBase': base, '@/lib/tokens': tokens })
  const { SyncButton } = load('components/ui/SyncButton.tsx', { 'react/jsx-runtime': jsx, './Button': button, 'lucide-react': require('lucide-react') })
  const idle = renderToStaticMarkup(React.createElement(SyncButton, { syncing: false, onClick() {}, label: 'Sync emails' }))
  const busy = renderToStaticMarkup(React.createElement(SyncButton, { syncing: true, onClick() {}, syncingLabel: 'Syncing emails' }))
  assert.ok(idle.includes('Sync emails'))
  assert.ok(!idle.includes('disabled=""'))
  assert.ok(busy.includes('disabled=""'))
  assert.ok(busy.includes('aria-busy="true"'))
  assert.ok(busy.includes('Syncing emails'))
  assert.ok(busy.includes('spin 0.8s linear infinite'))
  for (const file of ['app/dashboard/page.tsx', 'components/leads/LeadEmailSync.tsx']) {
    assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes('<SyncButton'))
  }
})