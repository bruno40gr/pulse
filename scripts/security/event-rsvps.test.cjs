/* eslint-disable @typescript-eslint/no-require-imports -- Isolated synthetic route tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

const publicRequest = (body, key = 'synthetic-rsvp-key') => new Request('http://synthetic.invalid/api/event-rsvps/public', {
  method: 'POST', headers: key === null ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
})
const guest = { name: ' Synthetic Guest ', email: ' GUEST@EXAMPLE.COM ', partySize: '3' }
function ownerScenario(extra = {}) {
  return { authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'mine', tenant_id: HEAD, auth_user_id: 'auth', role_id: 'owner', status: 'active' }],
    roles: [{ id: 'owner', tenant_id: HEAD, key: 'owner' }],
  }, ...extra }
}

test('public capture writes only the dedicated RSVP RPC, pins account/event and normalizes details', async () => {
  const harness = createHarness()
  harness.setScenario({ rpcResults: { capture_event_rsvp: 'synthetic-receipt' } })
  const route = harness.load('app/api/event-rsvps/public/route.ts')
  const response = await route.POST(publicRequest({ ...guest, tenant_id: DEMO, event_id: 'other' }))
  assert.equal(response.status, 201)
  const writes = harness.getQueries()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].database, 'primary')
  assert.equal(writes[0].table, 'capture_event_rsvp')
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].payload)), {
    p_tenant: HEAD, p_event: 'headliner-grand-opening', p_key: 'synthetic-rsvp-key',
    p_name: 'Synthetic Guest', p_email: 'guest@example.com', p_party_size: 3,
  })
  assert.ok(!writes.some(write => ['lead_intakes', 'crm_contacts', 'odeon_crm_capture'].includes(write.table)))
})

test('invalid details and missing/invalid retry keys cause no database writes', async () => {
  const harness = createHarness()
  const route = harness.load('app/api/event-rsvps/public/route.ts')
  for (const body of [null, [], {}, { ...guest, email: 'bad' }, { ...guest, name: 'a'.repeat(121) },
    ...[0, 100, 1.5, true, {}, ''].map(partySize => ({ ...guest, partySize }))]) {
    assert.equal((await route.POST(publicRequest(body))).status, 400)
  }
  for (const key of [null, '', 'bad key', 'a'.repeat(161)]) assert.equal((await route.POST(publicRequest(guest, key))).status, 400)
  assert.equal(harness.getQueries().length, 0)
})

test('retry conflict and storage failures do not report successful capture', async () => {
  const harness = createHarness()
  const route = harness.load('app/api/event-rsvps/public/route.ts')
  harness.setScenario({ rpcErrors: { capture_event_rsvp: { code: '22023' } } })
  assert.equal((await route.POST(publicRequest(guest))).status, 409)
  harness.setScenario({ rpcErrors: { capture_event_rsvp: { code: '42P01' } } })
  assert.equal((await route.POST(publicRequest(guest))).status, 503)
})

test('guest list requires membership/permission and prevents cross-account reads', async () => {
  const harness = createHarness()
  const route = harness.load('app/api/event-rsvps/route.ts')
  const request = tenant => new Request(`http://synthetic.invalid/api/event-rsvps?tenant=${tenant}`)
  assert.notEqual((await route.GET(request(HEAD))).status, 200)
  assert.ok(!harness.getQueries().some(query => query.table === 'event_rsvp_workspace'))
  harness.setScenario(ownerScenario({ rpcResults: { event_rsvp_workspace: { parties: 2, guests: 5, rows: [] } } }))
  const response = await route.GET(request(HEAD))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { parties: 2, guests: 5, rows: [] })
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(harness.getQueries().find(query => query.table === 'event_rsvp_workspace').payload.p_tenant, HEAD)
  harness.setScenario(ownerScenario())
  assert.equal((await route.GET(request(DEMO))).status, 403)
  assert.ok(!harness.getQueries().some(query => query.table === 'event_rsvp_workspace'))
})

test('CSV escapes quotes, commas and spreadsheet formulas', () => {
  const { rsvpCsv } = createHarness().load('lib/event-rsvps.ts')
  const csv = rsvpCsv([{ name: '=SUM(1,2)', email: 'guest@example.com', party_size: 3, created_at: '2026-10-22' },
    { name: 'Guest "One", Jr.', email: '  +formula@example.com', party_size: 2, created_at: '2026-10-22' }])
  assert.match(csv, /"'=SUM\(1,2\)"/)
  assert.ok(csv.includes('"Guest ""One"", Jr."'))
  assert.ok(csv.includes('"\'  +formula@example.com"'))
})

test('non-admin membership and demo sessions cannot read guest emails', async () => {
  const harness = createHarness()
  const route = harness.load('app/api/event-rsvps/route.ts')
  harness.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'mine', tenant_id: HEAD, auth_user_id: 'auth', role_id: 'staff', status: 'active' }],
    roles: [{ id: 'staff', tenant_id: HEAD, key: 'staff' }],
  } })
  assert.equal((await route.GET(new Request(`http://synthetic.invalid/api/event-rsvps?tenant=${HEAD}`))).status, 403)
  assert.ok(!harness.getQueries().some(query => query.table === 'event_rsvp_workspace'))
  harness.setScenario({ actor: { instructorId: null, personId: 'demo', displayName: 'Demo', role: 'demo', tenantId: DEMO } })
  assert.notEqual((await route.GET(new Request(`http://synthetic.invalid/api/event-rsvps?tenant=${HEAD}`))).status, 200)
  assert.ok(!harness.getQueries().some(query => query.table === 'event_rsvp_workspace'))
})

test('migration enforces private access, atomic retry identity and uncapped database totals', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/202610220001_event_rsvps.sql'), 'utf8')
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON public.event_rsvps FROM anon, authenticated/)
  assert.match(sql, /UNIQUE \(tenant_id, event_id, submission_key\)/)
  assert.match(sql, /ON CONFLICT .* DO NOTHING/)
  assert.match(sql, /IS DISTINCT FROM p_party_size/)
  assert.match(sql, /count\(\*\)/)
  assert.match(sql, /sum\(party_size\)/)
  assert.ok(!sql.includes('lead_intakes') && !sql.includes('crm_contacts'))
})