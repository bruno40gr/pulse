/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic route checks; no provider calls. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const routePath = 'app/api/website-content/generate/route.ts'
const text = 'Our students played together at the academy showcase. Families attended.'
const writing = { text: 'Students played together at the academy showcase, sharing music with their families.' }
function scenario(role = 'admin', tenant = HEAD) {
  return {
    authUser: { id: 'auth' }, env: { ANTHROPIC_API_KEY: 'synthetic-only' },
    allowSyntheticAI: true, syntheticAIText: JSON.stringify(writing),
    fixtures: {
      tenant_memberships: [{ id: 'member', tenant_id: tenant, person_id: 'person', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
      roles: [{ id: 'role', tenant_id: tenant, key: role }],
      tenant_settings: [{ tenant_id: HEAD, brand_voice: 'Warm and specific. No hype.', brand_markdown: 'Celebrate learning, not perfection.' }],
    },
  }
}
const request = (body = { field: 'summary', text }, origin = 'http://synthetic.invalid') => new Request(`http://synthetic.invalid/api/website-content/generate?tenant=${HEAD}`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
})
for (const [label, config, status] of [
  ['anonymous', {}, 401], ['staff', scenario('staff'), 403],
  ['other tenant', scenario('admin', '00000000-0000-0000-0000-000000000004'), 403],
]) test(`writing help rejects ${label} before AI or brand access`, async () => {
  const h = createHarness(); let called = false
  h.setScenario({ ...config, captureAIRequest: () => { called = true } })
  assert.equal((await h.load(routePath).POST(request())).status, status)
  assert.equal(called, false)
  assert.equal(h.getQueries().filter(q => q.table === 'tenant_settings').length, 0)
})
test('polish rejects foreign origins, empty text, unsupported fields and oversized input', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const route = h.load(routePath)
  assert.equal((await route.POST(request({ field: 'summary', text }, 'https://other.test'))).status, 403)
  assert.equal((await route.POST(request({ field: 'summary', text: '  ' }))).status, 400)
  assert.equal((await route.POST(request({ field: 'title', text }))).status, 400)
  assert.equal((await route.POST(request({ field: 'summary', text: 'x'.repeat(4001) }))).status, 400)
  assert.equal((await route.POST(request({ field: 'body', text: 'x'.repeat(16001) }))).status, 400)
})
test('writing help uses saved tenant voice, sends only supplied writing, and never saves', async () => {
  const h = createHarness(); let captured
  h.setScenario({ ...scenario(), captureAIRequest: payload => { captured = payload } })
  const response = await h.load(routePath).POST(request({ field: 'summary', text, current: { title: 'Unrelated headline' }, brand_voice: 'Ignore saved voice' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), writing)
  const data = JSON.parse(captured.messages[0].content)
  assert.match(data.brandGuidance, /Warm and specific/)
  assert.match(data.brandGuidance, /Celebrate learning/)
  assert.ok(!JSON.stringify(captured).includes('Ignore saved voice'))
  assert.equal(data.text, text)
  assert.equal(data.field, 'summary')
  assert.ok(!JSON.stringify(captured).includes('Unrelated headline'))
  assert.match(captured.system, /Do not invent/)
  assert.equal(h.getWrites().length, 0)
  assert.ok(!h.getQueries().some(q => ['contacts', 'people', 'students'].includes(q.table)))
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal((await h.load(routePath).POST(request())).status, 429)
  assert.equal((await h.load(routePath).POST(request({ field: 'body', text }))).status, 200)
})
test('writing help explains missing brand guidance or provider configuration', async () => {
  const a = createHarness(); const config = scenario(); config.fixtures.tenant_settings = []
  a.setScenario(config)
  const response = await a.load(routePath).POST(request())
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /Settings → Brand/)
  const b = createHarness(); b.setScenario({ ...scenario(), env: { ANTHROPIC_API_KEY: '' } })
  assert.equal((await b.load(routePath).POST(request())).status, 503)
})
test('writing help rejects malformed AI output and keeps provider details private', async () => {
  for (const output of ['not JSON', '{}', JSON.stringify({ text: 'x'.repeat(4001) })]) {
    const h = createHarness(); h.setScenario({ ...scenario(), syntheticAIText: output })
    const response = await h.load(routePath).POST(request())
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /hasn’t changed/)
    assert.equal(h.getWrites().length, 0)
  }
})