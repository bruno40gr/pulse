/* eslint-disable @typescript-eslint/no-require-imports -- Offline route/query regression. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

test('lead list verifies membership without unused viewer enrichment', async () => {
  const h = createHarness()
  h.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'viewer', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'owner' }], role_permissions: [],
  } })
  const response = await h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=lesson_inquiry&include_activity=0`))
  assert.equal(response.status, 200)
  assert.equal(h.getQueries().some(q => ['people', 'instructors'].includes(q.table)), false)
  assert.equal(h.getQueries().filter(q => q.table === 'tenant_memberships').length, 1)
  assert.equal(h.getWrites().length, 0)
})

test('contacts profile, funding and staff reads start before contact rows complete', { timeout: 3000 }, async () => {
  const h = createHarness()
  const started = new Set(); let release
  const gate = new Promise(resolve => { release = resolve })
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, queryResult: ({ table }) => {
    started.add(table)
    if (['import_profiles', 'funding_cases', 'instructors', 'people'].every(table => started.has(table))) release()
    if (table === 'people') return gate.then(() => ({ data: [], error: null }))
    return null
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [])
  assert.equal(h.getQueries().filter(q => q.table === 'instructors').length, 1)
  assert.equal(h.getWrites().length, 0)
})

test('contact rows are not gated on tenant field configuration', () => {
  const source = readFileSync(resolve(__dirname, '../../app/dashboard/contacts/page.tsx'), 'utf8')
  const start = source.indexOf('if (sampleContacts) { setContacts')
  const effect = source.slice(start, source.indexOf('}, [tenantId, sampleContacts])', start))
  assert.ok(!effect.includes('Promise.all'))
  assert.ok(effect.includes('controller.abort()'))
  assert.ok(effect.includes('if (!cancelled) setLoading(false)'))
})