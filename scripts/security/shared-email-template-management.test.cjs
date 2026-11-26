/* eslint-disable @typescript-eslint/no-require-imports -- Offline tenant-isolation and persistence fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const OTHER = '00000000-0000-0000-0000-000000000003'
const file = 'app/api/conversations/templates/route.ts'
const input = { id: 'custom-fixture', version: 0, name: 'Fixture template', subject: 'Fixture subject', body: 'Hello {{firstName}}' }
const request = (method = 'GET', body, tenant = HEAD) => new Request(`https://synthetic.invalid/api/conversations/templates?tenant=${tenant}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
function setup(options = {}) {
  const h = createHarness(), rows = options.rows || [], grants = options.grants || ['communications.read', 'communications.send']
  h.setScenario({ authUser: options.anonymous ? null : { id: 'user' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, auth_user_id: 'user', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'staff' }],
    permissions: grants.map(key => ({ id: key, key })), role_permissions: grants.map(key => ({ role_id: 'role', permission_id: key })),
  }, queryResult(query) {
    if (query.table !== 'shared_email_templates') return
    if (options.error) return { data: null, error: options.error }
    if (query.operation === 'select') {
      const tenant = query.filters.find(f => f[0] === 'eq' && f[1] === 'tenant_id')?.[2]
      const range = query.filters.find(f => f[0] === 'range')
      return { data: rows.filter(row => row.tenant_id === tenant).slice(range?.[1], range ? range[2] + 1 : undefined), error: null }
    }
    if (query.operation === 'insert') {
      if (rows.some(row => row.tenant_id === query.payload.tenant_id && row.id === query.payload.id)) return { data: null, error: { code: '23505' } }
      rows.push({ ...query.payload }); return { data: { id: query.payload.id }, error: null }
    }
    if (query.operation === 'update') {
      const row = rows.find(row => query.filters.filter(f => ['eq', 'is'].includes(f[0])).every(f => (row[f[1]] ?? null) === f[2]))
      if (!row) return { data: null, error: null }
      Object.assign(row, query.payload); return { data: { id: row.id }, error: null }
    }
  } })
  return { h, rows, route: h.load(file) }
}
test('created templates survive new requests, edits compare versions, and removed templates stay removed', async () => {
  const rows = [], first = setup({ rows })
  assert.equal((await first.route.POST(request('POST', input))).status, 200)
  const second = setup({ rows })
  let library = await (await second.route.GET(request())).json()
  assert.equal(library.can_manage, true)
  assert.equal(library.templates.find(row => row.id === input.id).body, input.body)
  assert.equal((await second.route.PUT(request('PUT', { ...input, version: 1, body: 'Changed message' }))).status, 200)
  assert.equal((await first.route.PUT(request('PUT', { ...input, version: 1, body: 'Stale edit' }))).status, 409)
  assert.equal(rows[0].body, 'Changed message')
  assert.equal((await second.route.DELETE(request('DELETE', { id: input.id, version: 2 }))).status, 200)
  library = await (await setup({ rows }).route.GET(request())).json()
  assert.equal(library.templates.some(row => row.id === input.id), false)
  assert.equal((await second.route.PUT(request('PUT', { ...input, version: 3 }))).status, 409)
  assert.equal(rows[0].version, 3)
})
test('approved defaults can be overridden and archived without reappearing or changing source copy', async () => {
  const fixture = setup(), initial = await (await fixture.route.GET(request())).json(), seed = initial.templates[0]
  assert.equal(seed.version, 0)
  assert.equal((await fixture.route.PUT(request('PUT', { ...seed, subject: 'Updated approved subject' }))).status, 200)
  const changed = await (await fixture.route.GET(request())).json()
  assert.equal(changed.templates.filter(row => row.id === seed.id).length, 1)
  assert.equal(changed.templates.find(row => row.id === seed.id).subject, 'Updated approved subject')
  assert.equal((await fixture.route.DELETE(request('DELETE', { id: seed.id, version: 1 }))).status, 200)
  const refreshed = await (await setup({ rows: fixture.rows }).route.GET(request())).json()
  assert.equal(refreshed.templates.length, initial.templates.length - 1)
  assert.equal((await fixture.route.PUT(request('PUT', seed))).status, 409)
  assert.notEqual(fixture.h.load('lib/headliner-email-templates.ts').headlinerEmailTemplates[0].subject, 'Updated approved subject')
})
test('readers retain selection access but cannot create, edit or remove templates', async () => {
  const fixture = setup({ grants: ['communications.read'] })
  const data = await (await fixture.route.GET(request())).json()
  assert.equal(data.templates.length, 4); assert.equal(data.can_manage, false)
  for (const verb of ['POST', 'PUT', 'DELETE']) assert.equal((await fixture.route[verb](request(verb, input))).status, 403)
  assert.equal(fixture.h.getQueries().some(q => q.table === 'shared_email_templates' && q.operation !== 'select'), false)
})
test('anonymous and cross-school requests never reach template storage', async () => {
  for (const verb of ['GET', 'POST', 'PUT', 'DELETE']) {
    for (const [options, tenant] of [[{ anonymous: true }, HEAD], [{}, OTHER]]) {
      const fixture = setup(options), response = await fixture.route[verb](request(verb, verb === 'GET' ? undefined : input, tenant))
      assert.ok([401, 403].includes(response.status))
      assert.equal(fixture.h.getQueries().some(q => q.table === 'shared_email_templates'), false)
    }
  }
})
test('every update includes tenant, id, expected version and archive state; foreign rows are excluded', async () => {
  const rows = [{ tenant_id: OTHER, ...input, version: 1, archived_at: null }], fixture = setup({ rows })
  const library = await (await fixture.route.GET(request())).json()
  assert.equal(library.templates.some(row => row.id === input.id), false)
  assert.equal((await fixture.route.PUT(request('PUT', { ...input, version: 1 }))).status, 409)
  assert.equal(rows[0].version, 1)
  const update = fixture.h.getQueries().find(q => q.table === 'shared_email_templates' && q.operation === 'update')
  for (const filter of [['eq', 'tenant_id', HEAD], ['eq', 'id', input.id], ['eq', 'version', 1], ['is', 'archived_at', null]]) assert.ok(update.filters.some(f => JSON.stringify(f) === JSON.stringify(filter)))
})
test('invalid fields, invented defaults, tenant mismatches and invalid versions never write', async () => {
  for (const body of [{ ...input, subject: 'Bad\nheader' }, { ...input, name: '' }, { ...input, body: 'x'.repeat(20001) }, { ...input, version: -1 }, { ...input, tenantId: OTHER }, { ...input, name: 12 }, { ...input, id: 'bad/id' }]) {
    const fixture = setup()
    assert.equal((await fixture.route.POST(request('POST', body))).status, 400)
    assert.equal(fixture.h.getQueries().some(q => q.table === 'shared_email_templates'), false)
  }
  const fixture = setup()
  assert.equal((await fixture.route.PUT(request('PUT', input))).status, 404)
  assert.equal((await fixture.route.DELETE(request('DELETE', input))).status, 404)
})
test('missing migration keeps approved defaults readable and fails writes; other failures do not mask removals', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    const fixture = setup({ error: { code, message: 'internal detail' } })
    const data = await (await fixture.route.GET(request())).json()
    assert.equal(data.templates.length, 4); assert.equal(data.can_manage, false); assert.equal(data.storage_available, false)
    assert.equal((await fixture.route.POST(request('POST', input))).status, 503)
  }
  const fixture = setup({ error: { code: 'XX000', message: 'internal detail' } })
  const response = await fixture.route.GET(request())
  assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /internal detail/)
})
test('template reads exhaust pagination including archived rows', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({ tenant_id: HEAD, ...input, id: `custom-${i}`, version: 1, archived_at: i === 1000 ? '2026-11-26' : null }))
  const fixture = setup({ rows }), data = await (await fixture.route.GET(request())).json()
  assert.equal(data.templates.length, 1004)
  assert.equal(fixture.h.getQueries().filter(q => q.table === 'shared_email_templates').length, 2)
})