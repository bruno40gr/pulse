/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing synthetic Node test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup({ legacy = false, demo = false, missingName = false, status = 'active', firstName = '  Current ', lastName = ' Staff  ' } = {}) {
  const harness = createHarness()
  harness.setScenario({
    actor: legacy || demo ? {
      instructorId: 'teacher', personId: 'staff', fullName: 'Legacy Staff', displayName: 'Legacy S.',
      access: demo ? { kind: 'demo', tenantId: DEMO } : { kind: 'headliner' },
    } : null,
    authUser: legacy || demo ? null : { id: 'auth' },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status, legacy_access_enabled: true }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'instructor' }],
      role_permissions: [],
      people: [{ id: 'staff', tenant_id: HEAD, first_name: missingName ? null : firstName, last_name: missingName ? null : lastName }],
    },
  })
  const route = harness.load('app/api/account/identity/route.ts')
  return { harness, get: (tenant = demo ? DEMO : HEAD) => route.GET(new Request(`http://synthetic.invalid/api/account/identity?tenant=${tenant}`)) }
}

for (const legacy of [false, true]) {
  test(`${legacy ? 'legacy' : 'personal'} session returns the current full name without caching`, async () => {
    const { get } = setup({ legacy })
    const response = await get()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { fullName: 'Current Staff', firstName: 'Current', avatarUrl: null, isDemo: false })
  })
}

test('legacy session can fall back to its verified actor name', async () => {
  const response = await setup({ legacy: true, missingName: true }).get()
  assert.equal((await response.json()).fullName, 'Legacy Staff')
})

test('missing personal name is not presented as a verified identity', async () => {
  assert.equal((await setup({ missingName: true }).get()).status, 404)
})

test('demo sessions are explicitly labeled and do not query people', async () => {
  const { get, harness } = setup({ demo: true })
  assert.deepEqual(await (await get()).json(), { fullName: 'Demo session', firstName: 'Demo', avatarUrl: null, isDemo: true })
  assert.equal(harness.getQueries().some(query => query.table === 'people'), false)
})

test('other tenant and suspended membership cannot reveal an identity', async () => {
  assert.equal((await setup().get(DEMO)).status, 403)
  assert.equal((await setup({ status: 'suspended' }).get()).status, 403)
})

test('signed-out requests do not return an identity', async () => {
  const { harness, get } = setup()
  harness.setScenario({ fixtures: {} })
  assert.equal((await get()).status, 401)
})

test('identity returns first name and the matching teacher photo', async () => {
  const response = await setup({ firstName: 'Isaias', lastName: 'W Pallib' }).get()
  const data = await response.json()
  assert.equal(data.firstName, 'Isaias')
  assert.ok(data.avatarUrl.endsWith('02e7a8a4-d3d1-4156-b1eb-8b6bdd6e2fe2.png'))
})