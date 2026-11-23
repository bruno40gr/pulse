/* eslint-disable @typescript-eslint/no-require-imports -- Offline integration contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const read = file => readFileSync(resolve(__dirname, '../..', file), 'utf8')

function cacheModule(globals = {}) {
  const loaded = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read('lib/contact-insights-cache.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: loaded, exports: loaded.exports, ...globals })
  return loaded.exports
}

test('retired private insights are purged without touching unrelated account or Beta state', () => {
  const values = new Map([['pulse_contact_insights_one', 'private'], ['pulse_contact_insights_time_one', 'date'],
    ['pulse_contact_insights_two', 'other account'], ['pulse_active_tenant', HEAD], ['beta_workspace', 'keep']])
  const storage = { get length() { return values.size }, key: index => [...values.keys()][index], removeItem: key => values.delete(key) }
  cacheModule({ window: { localStorage: storage } }).clearLegacyContactInsights()
  assert.deepEqual([...values.keys()], ['pulse_active_tenant', 'beta_workspace'])
  assert.doesNotThrow(() => cacheModule().clearLegacyContactInsights())
  assert.doesNotThrow(() => cacheModule({ window: { get localStorage() { throw new Error('Blocked') } } }).clearLegacyContactInsights())
  for (const file of ['components/layout/IdentityProvider.tsx', 'components/layout/LogoutButton.tsx', 'lib/tenant.ts']) {
    assert.match(read(file), /clearLegacyContactInsights\(\)/)
  }
})

test('band reads default on but writes require explicit enablement and respect either disable', () => {
  for (const [env, expected] of [[{}, false], [{ ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }, true],
    [{ NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }, true],
    [{ NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES: 'false', ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }, false],
    [{ NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true', ENABLE_CONTACT_BAND_OPPORTUNITIES: 'false' }, false]]) {
    const h = createHarness(); h.setScenario({ env })
    const flags = h.load('lib/band-feature.ts')
    assert.equal(flags.bandWritesEnabled(), expected)
    if (!Object.keys(env).length) assert.equal(flags.bandWorkspaceEnabled(), true)
  }
})

test('private contact insights are not persisted in either live or Beta browser caches', () => {
  for (const file of ['components/contacts/ContactSlidePanel.tsx', 'beta-source/components/contacts/ContactSlidePanel.tsx']) {
    const source = read(file)
    assert.doesNotMatch(source, /pulse_contact_insights_|localStorage\.setItem\(cacheKey/)
    const effect = source.slice(source.indexOf('// ── Load insights'), source.indexOf('// Normalize both'))
    assert.match(effect, /if \(cancelled\) return/)
    assert.match(effect, /return \(\) => \{ cancelled = true \}/)
  }
})

test('unread badge filters before transfer and paginates beyond the response cap', async () => {
  const h = createHarness(), ranges = []
  h.setScenario({ actor: { personId: 'staff', access: { kind: 'demo', tenantId: HEAD } }, queryResult: ({ table, filters }) => {
    if (table !== 'messages') return null
    assert.ok(filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD))
    assert.ok(filters.some(f => f[0] === 'eq' && f[1] === 'direction' && f[2] === 'inbound'))
    assert.ok(filters.some(f => f[0] === 'or' && f[1] === 'status.is.null,status.neq.read'))
    assert.ok(filters.some(f => f[0] === 'eq' && f[1] === 'campaign_id' && f[2] === 'campaign'))
    const range = filters.find(f => f[0] === 'range'); ranges.push(range.slice(1))
    return { data: range[1] === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: i, from_phone: '9165550100' })) : [{ id: 500, from_phone: null }, { id: 501, from_phone: '9165550101' }], error: null }
  } })
  const response = await h.load('app/api/inbox/route.ts').GET(new Request(`https://synthetic.invalid/api/inbox?tenant=${HEAD}&count_only=1&campaign_id=campaign`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).count, 501)
  assert.deepEqual(ranges, [[0, 499], [500, 999]])
  assert.equal(h.getWrites().length, 0)
})

test('durable group-email reservations are tenant/actor scoped and fail closed', async () => {
  const operation = { tenantId: HEAD, membershipId: 'staff', operationId: 'op', fingerprint: 'a'.repeat(64) }
  const h = createHarness(); h.setScenario({})
  assert.equal(await h.load('lib/group-email-operation.ts').reserveGroupEmail(operation), 'reserved')
  assert.equal(h.getWrites()[0].payload.status, 'uncertain')
  for (const status of ['sent', 'uncertain']) {
    const replay = createHarness()
    replay.setScenario({ queryResult: ({ operation: kind }) => kind === 'insert'
      ? { error: { code: '23505' } }
      : { data: { membership_id: 'staff', fingerprint: operation.fingerprint, status }, error: null } })
    assert.equal(await replay.load('lib/group-email-operation.ts').reserveGroupEmail(operation), status)
    assert.ok(replay.getQueries().filter(q => q.operation === 'select').every(q => q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD)))
  }
  const missing = createHarness(); missing.setScenario({ errors: { group_email_operations: { code: '42P01' } } })
  await assert.rejects(missing.load('lib/group-email-operation.ts').reserveGroupEmail(operation), /No email was sent/)
  const foreign = createHarness(); foreign.setScenario({ queryResult: ({ operation: kind }) => kind === 'insert'
    ? { error: { code: '23505' } } : { data: { membership_id: 'other', fingerprint: operation.fingerprint, status: 'sent' }, error: null } })
  await assert.rejects(foreign.load('lib/group-email-operation.ts').reserveGroupEmail(operation), /different sender or message/)
})

test('group email ledger migration has a unique tenant operation key and no client grants', () => {
  const sql = read('supabase/migrations/202611200005_group_email_operations.sql')
  assert.match(sql, /PRIMARY KEY \(tenant_id, operation_id\)/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL .* FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(sql, /GRANT .* TO (?:anon|authenticated)/)
  assert.doesNotMatch(sql, /REFERENCES public\.tenant_memberships/)
})