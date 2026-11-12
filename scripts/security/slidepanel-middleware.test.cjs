/* eslint-disable @typescript-eslint/no-require-imports -- Offline middleware regression. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

async function setup({ status = 'active', legacy = false, legacyEnabled = true, tenant = HEAD, beforeGetUser, queryResult } = {}) {
  const h = createHarness()
  h.setScenario({ authUser: legacy ? null : { id: 'auth' }, beforeGetUser, queryResult,
    fixtures: { tenant_memberships: [{ id: 'membership', person_id: 'person', tenant_id: HEAD, auth_user_id: 'auth', status, legacy_access_enabled: legacyEnabled }] } })
  const cookie = legacy ? await h.load('lib/access.ts').createAccessSession({ personId: 'person', instructorId: 'teacher', displayName: 'Fixture' }) : undefined
  const url = new URL(`https://synthetic.invalid/api/leads/lead?tenant=${tenant}`)
  const req = new Request(url); req.nextUrl = url
  req.cookies = { get: () => cookie ? { value: cookie } : undefined, getAll: () => [], set() {} }
  return { h, run: () => h.load('middleware.ts').middleware(req) }
}

for (const legacy of [false, true]) for (const status of ['active', 'suspended', 'deactivated']) {
  test(`middleware retains ${legacy ? 'legacy' : 'personal'} ${status} checks`, async () => {
    const { h, run } = await setup({ legacy, status })
    assert.equal((await run()).status, status === 'active' ? 200 : 401)
    assert.equal(h.getWrites().length, 0)
  })
}
test('middleware retains personal tenant isolation and legacy eligibility', async () => {
  assert.equal((await (await setup({ tenant: DEMO })).run()).status, 403)
  assert.equal((await (await setup({ legacy: true, legacyEnabled: false })).run()).status, 401)
})
test('legacy membership check starts before personal identity completes', { timeout: 3000 }, async () => {
  let releaseAuth
  const authGate = new Promise(resolve => { releaseAuth = resolve })
  const { run } = await setup({ legacy: true, beforeGetUser: () => authGate,
    queryResult: ({ table }) => { if (table === 'tenant_memberships') releaseAuth(); return null } })
  assert.equal((await run()).status, 200)
})