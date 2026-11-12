/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic security tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup({ auth = 'secondary', status = 'active', revoked = false, role = 'owner' } = {}) {
  const h = createHarness()
  h.setScenario({ authUser: { id: auth, email: `${auth}@example.test` }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'person', role_id: 'role', auth_user_id: 'primary', status, legacy_access_enabled: false }],
    membership_login_links: [{ membership_id: 'membership', auth_user_id: 'secondary', revoked_at: revoked ? '2026-11-10' : null }],
    roles: [{ id: 'role', tenant_id: HEAD, key: role }], role_permissions: [], permissions: [],
    people: [{ id: 'person', tenant_id: HEAD, email: 'contact@example.test' }],
  } })
  return h
}
const request = () => new Request('https://synthetic.invalid/api/account/me')

for (const auth of ['primary', 'secondary']) test(`${auth} login resolves same staff membership without writes`, async () => {
  const h = setup({ auth })
  const result = await h.load('lib/request-context.ts').requireAccountAdministrator(request(), HEAD)
  assert.equal(result.ok, true)
  assert.equal(result.context.membershipId, 'membership')
  assert.equal(result.context.personId, 'person')
  assert.equal(result.context.authUserId, auth)
  assert.equal(h.getWrites().length, 0)
})
for (const input of [{ revoked: true }, { auth: 'unrelated' }, { status: 'suspended' }, { status: 'deactivated' }]) {
  test(`secondary access denied: ${JSON.stringify(input)}`, async () => {
    const h = setup(input)
    assert.equal((await h.load('lib/request-context.ts').requireAccountAdministrator(request(), HEAD)).ok, false)
  })
}
test('secondary login cannot choose another tenant', async () => {
  const h = setup()
  assert.equal((await h.load('lib/request-context.ts').requireAccountAdministrator(request(), DEMO)).ok, false)
})
test('secondary login resolves tenant when omitted', async () => {
  const h = setup()
  const result = await h.load('lib/request-context.ts').resolveMembershipRequestContext(request())
  assert.equal(result.ok, true)
  assert.equal(result.context.tenantId, HEAD)
})
test('secondary login embeds membership without a separate linked membership query', async () => {
  const h = setup()
  const result = await h.load('lib/request-context.ts').requireAccountAdministrator(request(), HEAD)
  assert.equal(result.ok, true)
  assert.equal(h.getQueries().filter(q => q.table === 'tenant_memberships').length, 1)
  assert.equal(h.getQueries().filter(q => q.table === 'membership_login_links').length, 1)
})
test('malformed linked membership fails closed', async () => {
  const h = createHarness()
  h.setScenario({ authUser: { id: 'secondary' }, queryResult: ({ table }) => table === 'membership_login_links'
    ? { data: { membership_id: 'expected', tenant_memberships: { id: 'wrong', tenant_id: HEAD, status: 'active' } }, error: null } : null })
  const result = await h.load('lib/tenant-request.ts').authorizeTenantRequest(request())
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})
test('staff secondary login does not gain admin privileges', async () => {
  const h = setup({ role: 'staff' })
  assert.equal((await h.load('lib/request-context.ts').requireAccountAdministrator(request(), HEAD)).status, 403)
})
test('account settings and reset accept explicitly linked personal session', async () => {
  const h = setup()
  const response = await h.load('app/api/account/me/route.ts').GET(request())
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.canUpdateCredentials, true)
  assert.equal(body.email, 'secondary@example.test')
})
for (const [name, input, allowed] of [['owner', {}, true], ['staff', { role: 'staff' }, false], ['revoked', { revoked: true }, false]]) {
  test(`Beta middleware secondary ${name}`, async () => {
    const h = setup(input)
    const url = new URL(`https://synthetic.invalid/odeon-demo?tenant=${HEAD}`)
    const req = new Request(url); req.nextUrl = url
    req.cookies = { get: () => undefined, getAll: () => [], set() {} }
    const response = await h.load('middleware.ts').middleware(req)
    assert.equal(response.status, allowed ? 200 : 307)
    assert.equal(h.getWrites().length, 0)
  })
}