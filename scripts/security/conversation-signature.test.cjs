/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic database; no real writes. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

function setup({ permissions = ['communications.read', 'tenant_settings.manage'], error = null } = {}) {
  const harness = createHarness()
  harness.setScenario({
    authUser: { id: 'auth' },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, auth_user_id: 'auth', role_id: 'role', status: 'active', email_signoff: { name: 'Alex', role: 'Teacher', logoUrl: 'https://example.com/personal-logo.png', phone: '012-3456789' } }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }],
      role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })),
      permissions: permissions.map((key, i) => ({ id: String(i), key })),
      tenants: [{ id: HEAD, name: 'STAGING — Synthetic Music School' }],
      tenant_settings: [{ tenant_id: HEAD, logo_url: 'https://example.com/white-logo.png', logo_on_white_url: 'https://example.com/white-logo.png', logo_on_dark_url: 'https://example.com/dark-logo.png', email_signature: { company: 'Public Music School', phone: '+12025550100', name: 'Office', logoUrl: 'https://example.com/black-logo.png' } }],
      twilio_config: [{ tenant_id: HEAD, phone_number: '+12025550999', auth_token: 'secret' }],
    },
    errors: error ? { tenant_settings: error } : {},
  })
  return { harness, route: harness.load('app/api/conversations/signature/route.ts') }
}
const request = body => new Request(`http://synthetic.invalid/api/conversations/signature?tenant=${HEAD}`, body === undefined ? {} : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const valid = { company: 'Public Company', name: '', phone: '+12025550100', logoUrl: 'https://example.com/black.png' }

test('signature reads personal fields and the shared Brand logo, not internal workspace name or credentials', async () => {
  const { route } = setup()
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.company, '')
  assert.equal(data.name, 'Alex')
  assert.equal(data.title, 'Teacher')
  assert.equal(data.phone, '012-3456789')
  assert.equal(data.logoUrl, 'https://example.com/white-logo.png')
  assert.doesNotMatch(JSON.stringify(data), /STAGING|Synthetic|personal-logo|secret/)
})

test('unified signature is independent of legacy workspace signature storage and Twilio', async () => {
  const { route } = setup({ error: { code: '42703', message: 'column missing' } })
  const data = await (await route.GET(request())).json()
  assert.equal(data.company, '')
  assert.equal(data.logoUrl, '')
  assert.equal(data.phone, '012-3456789')
  assert.equal(data.storageAvailable, true)
})

test('signature updates require settings-manage permission', async () => {
  const { route } = setup({ permissions: ['communications.read'] })
  assert.equal((await route.PUT(request(valid))).status, 403)
})

test('signature requires a phone and rejects unsafe logos and oversized fields', async () => {
  const { route } = setup()
  for (const patch of [{ phone: '' }, { logoUrl: 'javascript:alert(1)' }, { logoUrl: 'https://user:pass@example.com/x' }, { name: 'x'.repeat(201) }]) {
    assert.equal((await route.PUT(request({ ...valid, ...patch }))).status, 400)
  }
  assert.equal((await route.PUT(request(valid))).status, 200)
})

test('missing migration returns actionable save error rather than claiming persistence', async () => {
  const { route } = setup({ error: { code: '42703' } })
  const response = await route.PUT(request(valid))
  assert.equal(response.status, 503)
  assert.match((await response.json()).error, /Migration 025/)
})