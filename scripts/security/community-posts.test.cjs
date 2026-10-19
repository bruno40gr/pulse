/* eslint-disable @typescript-eslint/no-require-imports -- Built-in synthetic test runner. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const OTHER = '00000000-0000-0000-0000-000000000004'
const id = '00000000-0000-0000-0000-000000000005'
const request = (body, tenant = HEAD) => new Request(`http://synthetic.invalid/api/community-posts?tenant=${tenant}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
function scenario(tenant = HEAD, permission = true) {
  return { authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: tenant, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: tenant, key: 'admin' }],
    role_permissions: permission ? [{ role_id: 'role', permission_id: 'permission' }] : [],
    permissions: [{ id: 'permission', key: 'tenant_settings.manage' }],
  }, rpcResults: { community_post_workspace: { revision: 0, posts: [] }, community_post_command: { revision: 1, posts: [] } } }
}
test('canonical URLs strip tracking and reject unsupported hosts, scripts and short links', () => {
  const lib = createHarness().load('lib/community-posts.ts')
  assert.equal(lib.canonicalCommunityUrl('https://instagram.com/reel/abc_123/?utm_source=test').url, 'https://www.instagram.com/reel/abc_123/')
  for (const value of ['javascript:alert(1)', 'https://instagram.com.evil.test/p/a/', 'https://www.instagram.com/profile/', 'https://vm.tiktok.com/abc', 'https://user@instagram.com/p/a/']) assert.throws(() => lib.canonicalCommunityUrl(value))
})
test('commands require permission review, unique four-slot selection and revision', () => {
  const { communityCommand } = createHarness().load('lib/community-posts.ts')
  assert.throws(() => communityCommand({ action: 'add', url: 'https://instagram.com/p/a/' }))
  assert.throws(() => communityCommand({ action: 'review', revision: 0, id, status: 'approved', permission_notes: '', permission_confirmed: true }))
  assert.throws(() => communityCommand({ action: 'homepage', revision: 0, ids: [id, id] }))
  assert.throws(() => communityCommand({ action: 'homepage', revision: 0, ids: Array(5).fill(id) }))
  assert.equal(communityCommand({ action: 'homepage', revision: 0, ids: [] }).action, 'homepage')
})
for (const [name, config, expected] of [
  ['anonymous', {}, 401], ['missing permission', scenario(HEAD, false), 403], ['other tenant', scenario(OTHER), 403],
  ['demo', { actor: { displayName: 'Demo', access: { kind: 'demo', tenantId: DEMO } } }, 403],
]) test(`${name} cannot read or mutate community posts`, async () => {
  const h = createHarness(); h.setScenario(config)
  const route = h.load('app/api/community-posts/route.ts')
  assert.equal((await route.GET(request())).status, expected)
  assert.equal((await route.POST(request({ action: 'add', revision: 0, url: 'https://instagram.com/p/a/' }))).status, expected)
  assert.equal(h.getQueries().filter(q => q.operation === 'rpc').length, 0)
})
test('authorized command uses verified membership and tenant and canonical URL', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const route = h.load('app/api/community-posts/route.ts')
  assert.equal((await route.POST(request({ action: 'add', revision: 0, url: 'https://instagram.com/p/a/?tracking=1' }))).status, 200)
  const call = h.getQueries().find(q => q.operation === 'rpc')
  assert.equal(call.payload.p_actor, 'membership')
  assert.equal(call.payload.p_tenant, HEAD)
  assert.equal(call.payload.p_data.original_url, 'https://www.instagram.com/p/a/')
})
test('stale workspace reports conflict without database details', async () => {
  const h = createHarness(); h.setScenario({ ...scenario(), rpcErrors: { community_post_command: { code: '40001', message: 'private database detail' } } })
  const response = await h.load('app/api/community-posts/route.ts').POST(request({ action: 'homepage', revision: 0, ids: [] }))
  assert.equal(response.status, 409)
  assert(!JSON.stringify(await response.json()).includes('private database detail'))
})