/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic middleware tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function scenario(role, tenant = HEAD) {
  return { authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: tenant, person_id: 'person', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: tenant, key: role }], role_permissions: [], permissions: [],
  } }
}

for (const path of ['/odeon-demo', '/odeon-demo/school-setup', '/beta']) {
  for (const [name, setup, allowed] of [
    ['anonymous', {}, false], ['staff', scenario('staff'), false],
    ['other tenant', scenario('admin', DEMO), false],
    ['owner', scenario('owner'), true], ['admin', scenario('admin'), true],
  ]) test(`${name} ${allowed ? 'can' : 'cannot'} access ${path}`, async () => {
    const h = createHarness(); h.setScenario(setup)
    const url = new URL(`http://synthetic.invalid${path}?tenant=${HEAD}`)
    const request = new Request(url)
    request.nextUrl = url
    request.cookies = { get: () => undefined, getAll: () => [], set: () => {} }
    const response = await h.load('middleware.ts').middleware(request)
    assert.equal(response.status, allowed ? 200 : 307)
    if (allowed) {
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow')
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    } else {
      assert.match(response.headers.get('location'), name === 'anonymous' ? /\/login\?/ : /\/dashboard\/settings/)
    }
    assert.equal(h.getWrites().length, 0)
  })
}