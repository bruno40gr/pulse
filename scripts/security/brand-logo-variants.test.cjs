/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic database only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

function setup() {
  const harness = createHarness()
  harness.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'mine', tenant_id: HEAD, auth_user_id: 'auth', role_id: 'owner', status: 'active' }],
    roles: [{ id: 'owner', tenant_id: HEAD, key: 'owner' }],
    tenant_settings: [{ tenant_id: HEAD }],
  } })
  return { harness, route: harness.load('app/api/brand-settings/route.ts') }
}
const request = body => new Request(`http://synthetic.invalid/api/brand-settings?tenant=${HEAD}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('Brand saves both logo URLs scoped to the tenant and preserves the legacy white logo field', async () => {
  const { harness, route } = setup()
  const response = await route.PUT(request({ logo_on_white_url: ' https://assets.example.com/white.png ', logo_on_dark_url: 'https://assets.example.com/dark.png' }))
  assert.equal(response.status, 200)
  const write = harness.getWrites().find(write => write.table === 'tenant_settings')
  assert.equal(write.payload.tenant_id, HEAD)
  assert.equal(write.payload.logo_on_white_url, 'https://assets.example.com/white.png')
  assert.equal(write.payload.logo_on_dark_url, 'https://assets.example.com/dark.png')
  assert.equal(write.payload.logo_url, write.payload.logo_on_white_url)
})

test('Brand rejects unsafe, malformed and oversized logo URLs before any write', async () => {
  const { harness, route } = setup()
  for (const key of ['logo_on_white_url', 'logo_on_dark_url']) {
    for (const value of ['http://example.com/logo.png', 'javascript:alert(1)', 'https://user:pass@example.com/logo.png', 'x'.repeat(2049), 123]) {
      assert.equal((await route.PUT(request({ [key]: value }))).status, 400)
    }
  }
  assert.equal(harness.getWrites().length, 0)
})