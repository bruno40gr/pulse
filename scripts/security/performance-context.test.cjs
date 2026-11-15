/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic regression tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function client(fetch) {
  const testModule = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '../../lib/account-context-client.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: testModule, exports: testModule.exports, fetch, AbortController, setTimeout, clearTimeout, Map })
  return testModule.exports.loadAccountContext
}

test('overlapping account consumers share one request, with no settled identity cache', async () => {
  let calls = 0, complete
  const load = client(async (_url, options) => {
    calls++
    assert.equal(options.cache, 'no-store')
    await new Promise(resolve => { complete = resolve })
    return Response.json({ tenantId: HEAD, membershipId: 'staff' })
  })
  const first = load(HEAD), second = load(HEAD), third = load(HEAD)
  assert.equal(first, second); assert.equal(second, third); assert.equal(calls, 1)
  complete(); await first
  const next = load(HEAD)
  assert.equal(calls, 2)
  complete(); await next
})

test('tenants never share account promises and failures do not persist', async () => {
  let calls = 0
  const load = client(async url => {
    calls++
    return calls === 1 ? Response.json({ error: 'Denied' }, { status: 403 })
      : Response.json({ tenantId: new URL(url, 'http://synthetic.invalid').searchParams.get('tenant'), membershipId: 'staff' })
  })
  await assert.rejects(load(HEAD), /Denied/)
  await Promise.all([load(HEAD), load(DEMO)])
  assert.equal(calls, 3)
})

test('mismatched account identity fails closed', async () => {
  await assert.rejects(client(async () => Response.json({ tenantId: DEMO, membershipId: 'other' }))(HEAD), /verify/)
})

test('authorization reuse is limited to the same Request and tenant', async () => {
  const h = createHarness()
  const scenario = status => ({
    authUser: { id: 'auth' },
    fixtures: {
      tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'owner' }], role_permissions: [],
    },
  })
  h.setScenario(scenario('active'))
  const resolve = h.load('lib/request-context.ts').resolveMembershipRequestContext
  const request = new Request('http://synthetic.invalid/')
  const one = resolve(request, HEAD), two = resolve(request, HEAD)
  assert.equal(one, two)
  assert.equal((await one).ok, true)
  assert.equal((await resolve(request, DEMO)).ok, false)
  h.setScenario(scenario('suspended'))
  assert.equal((await resolve(new Request(request), HEAD)).ok, false)
})

test('summary and records modes remain tenant-authorized and records skip summaries', async () => {
  const h = createHarness()
  h.setScenario({ actor: { personId: 'staff', displayName: 'Demo', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: { tenants: [{ id: HEAD, is_demo: true }], lead_intakes: [] } })
  const get = h.load('app/api/leads/route.ts').GET
  const list = await get(new Request(`http://synthetic.invalid/api/leads?tenant=${HEAD}&include_counts=0&include_activity=0`))
  assert.equal(list.status, 200)
  assert.deepEqual(await list.json(), [])
  const listQueries = h.getQueries().length
  const summary = await get(new Request(`http://synthetic.invalid/api/leads?tenant=${HEAD}&summary_only=1`))
  assert.equal(summary.status, 200)
  assert.equal(summary.headers.get('cache-control'), 'private, no-store')
  assert.ok((await summary.json()).counts)
  assert.ok(h.getQueries().length > listQueries)
  assert.equal((await get(new Request(`http://synthetic.invalid/api/leads?tenant=${DEMO}&summary_only=1`))).status, 403)
  h.setScenario({ fixtures: {} })
  assert.equal((await get(new Request(`http://synthetic.invalid/api/leads?tenant=${HEAD}&summary_only=1`))).status, 401)
})