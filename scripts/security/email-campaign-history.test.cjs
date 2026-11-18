/* eslint-disable @typescript-eslint/no-require-imports -- Runs with Node's built-in test runner. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

const operation = '3f78ca5f-2e62-4b2b-ab11-d073f7389d64'
const table = 'organisation_email_deliveries'
const route = 'app/api/history/email/route.ts'
const request = (params = '') => new Request(`http://synthetic.invalid/api/history/email?tenant=${HEAD}${params}`)

function setup({ role = 'owner', ...overrides } = {}) {
  const h = createHarness()
  h.setScenario({ authUser: { id: 'auth' }, ...overrides, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: role }], ...overrides.fixtures,
  } })
  return h
}

test('Campaigns is visible under Operations', () => {
  const nav = createHarness().load('lib/work-area-navigation.ts')
  const operations = nav.workAreasForAccess({ roleKey: 'owner' }).find(row => row.id === 'operations')
  assert.ok(operations.links.some(link => link.label === 'Campaigns' && link.href === '/dashboard/history'))
})

test('unauthorized staff cannot query a recipient address', async () => {
  const h = setup({ role: 'staff' })
  const response = await h.load(route).GET(request(`&operation=${operation}`))
  assert.equal(response.status, 403)
  assert.ok(h.getQueries().every(q => q.table !== table))
})

test('the second page requests rows 51–100 with an exact total and tenant and operation scope', async () => {
  const attempts = Array.from({ length: 57 }, (_, i) => ({ destination: `recipient-${String(i + 1).padStart(2, '0')}@example.test`, status: 'sent', created_at: '2026-11-18T16:35:00Z' }))
  const h = setup({ queryResult({ table: name, filters }) {
    if (name !== table) return
    assert.ok(filters.some(([method, key, value]) => method === 'eq' && key === 'tenant_id' && value === HEAD))
    assert.ok(filters.some(([method, key, value]) => method === 'eq' && key === 'operation_id' && value === operation))
    assert.ok(filters.some(([method, columns, options]) => method === 'select' && columns === 'destination,status,created_at' && options.count === 'exact'))
    assert.ok(filters.some(([method, key]) => method === 'order' && key === 'destination'))
    const [, start, end] = filters.find(([method]) => method === 'range')
    assert.equal(start, 50)
    assert.equal(end, 99)
    return { data: attempts.slice(start, end + 1), count: attempts.length, error: null }
  } })
  const response = await h.load(route).GET(request(`&operation=${operation}&page=2`))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const { total, recipients } = await response.json()
  assert.equal(total, 57)
  assert.equal(recipients.length, 7)
  assert.equal(recipients[0].destination, 'recipient-51@example.test')
  assert.equal(h.getWrites().length, 0)
})

test('newest progress totals win, previous error is kept, and foreign campaigns are not included', async () => {
  const event_type = 'communications.bulk_email_sent'
  const h = setup({ fixtures: { account_audit_events: [
    { tenant_id: HEAD, event_type, metadata: { operation_id: operation, subject: 'Synthetic showcase', sent: 56, pending: 108, failed: 1, excluded: 4 } },
    { tenant_id: HEAD, event_type, metadata: { operation_id: operation, subject: 'Synthetic showcase', sent: 53, pending: 112, diagnostic: { httpStatus: 429, category: 'rate_limit', reason: 'rateLimitExceeded', payload: 'private' } } },
    { tenant_id: DEMO, event_type, metadata: { operation_id: '5c46ca5f-2e62-4b2b-ab11-d073f7389d64', subject: 'Foreign campaign' } },
  ] } })
  const response = await h.load(route).GET(request())
  const { campaigns } = await response.json()
  assert.equal(campaigns.length, 1)
  assert.equal(campaigns[0].accepted, 56)
  assert.equal(campaigns[0].unattempted, 108)
  assert.equal(campaigns[0].failed, 1)
  assert.deepEqual(campaigns[0].diagnostic, { httpStatus: 429, category: 'rate_limit', reason: 'rateLimitExceeded' })
})

test('provider diagnostics distinguish throttling, mailbox access, rejection and ambiguity without including raw errors', async () => {
  const { gmailSendDiagnostic } = createHarness().load('lib/bulk-email-history.ts')
  for (const [status, reason, category] of [[403, 'userRateLimitExceeded', 'rate_limit'], [401, 'authError', 'mailbox_access'], [400, 'private-recipient@example.test', 'rejected'], [503, 'backendError', 'uncertain']]) {
    const result = await gmailSendDiagnostic(Response.json({ error: { message: 'private payload', errors: [{ reason }] } }, { status }))
    assert.equal(result.category, category)
    assert.equal(result.httpStatus, status)
    assert.doesNotMatch(JSON.stringify(result), /private/)
  }
})