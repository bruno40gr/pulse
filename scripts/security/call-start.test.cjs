const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, DEMO } = require('./synthetic-harness.cjs')
const leadId = '10000000-0000-0000-0000-000000000001'
const contactId = '20000000-0000-0000-0000-000000000001'
const otherId = '20000000-0000-0000-0000-000000000002'
const actor = { personId: 'staff', access: { kind: 'demo', tenantId: DEMO }, displayName: 'Synthetic' }
function setup(extra = {}) {
  const h = createHarness()
  h.setScenario({ actor, fixtures: {
    lead_intakes: [{ id: leadId, tenant_id: DEMO, contact_id: contactId }],
    crm_contacts: [{ id: contactId, tenant_id: DEMO }],
  }, ...extra })
  return { h, POST: h.load('app/api/calls/route.ts').POST }
}
function request(body = {}) {
  return new Request('https://synthetic.invalid/api/calls', { method: 'POST',
    body: JSON.stringify({ to_phone: '+12025550111', lead_id: leadId, contact_id: contactId, ...body }),
    headers: { 'content-type': 'application/json' } })
}
test('lead call derives tenant-owned CRM contact and writes CRM history', async () => {
  const { h, POST } = setup()
  assert.equal((await POST(request())).status, 200)
  const event = h.getWrites().find(q => q.table === 'lead_events')
  assert.equal(event.database, 'crm')
  assert.equal(event.payload.contact_id, contactId)
  assert.equal(event.payload.tenant_id, DEMO)
})
test('foreign lead or mismatched related contact refused before side effects', async () => {
  for (const body of [{ lead_id: otherId }, { contact_id: otherId }]) {
    const { h, POST } = setup()
    assert.equal((await POST(request(body))).status, 404)
    assert.equal(h.getWrites().length, 0)
  }
})
test('capture mode pauses new calls without database or provider writes', async () => {
  const { h, POST } = setup({ env: { ODEON_CRM_CALLBACK_MODE: 'capture' } })
  assert.equal((await POST(request())).status, 503)
  assert.equal(h.getWrites().length, 0)
})
test('demo history failure is not reported as success and private error stays private', async () => {
  const { POST } = setup({ errors: { lead_events: { message: 'private synthetic database error' } } })
  const response = await POST(request())
  assert.equal(response.status, 500)
  assert.ok(!(await response.text()).includes('private synthetic database error'))
})
test('malformed phone or record identifier cannot write', async () => {
  for (const body of [{ to_phone: '<Number>evil</Number>' }, { contact_id: 'invalid' }]) {
    const { h, POST } = setup()
    assert.equal((await POST(request(body))).status, 400)
    assert.equal(h.getWrites().length, 0)
  }
})
test('signed callback path bypasses session middleware but call initiation does not', async () => {
  const h = createHarness()
  h.setScenario({})
  const middleware = h.load('middleware.ts').middleware
  const requestFor = path => {
    const request = new Request(`https://synthetic.invalid${path}`)
    request.nextUrl = new URL(request.url)
    request.cookies = { get: () => undefined, getAll: () => [] }
    return request
  }
  const callback = await middleware(requestFor('/api/calls/status'))
  assert.equal(callback.headers.get('x-synthetic-next'), 'true')
  assert.equal(h.getQueries().length, 0)
  assert.equal((await middleware(requestFor('/api/calls'))).status, 401)
})

function staffSetup(errors = {}) {
  return setup({ actor: null, authUser: { id: 'auth' }, allowSyntheticCalls: true, errors,
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: DEMO, person_id: 'staff',
        auth_user_id: 'auth', role_id: 'role', status: 'active' }],
      roles: [{ id: 'role', tenant_id: DEMO, key: 'owner' }],
      people: [{ id: 'staff', tenant_id: DEMO, phone: '+12025550133' }],
      twilio_config: [{ tenant_id: DEMO, account_sid: 'synthetic', auth_token: 'synthetic', phone_number: '+12025550122' }],
      lead_intakes: [{ id: leadId, tenant_id: DEMO, contact_id: contactId }],
      crm_contacts: [{ id: contactId, tenant_id: DEMO }],
    } })
}
test('placed call with history failure reports SID and explicit warning, not retryable failure', async () => {
  const { h, POST } = staffSetup({ lead_events: { message: 'private synthetic history error' } })
  const response = await POST(new Request(`https://synthetic.invalid/api/calls?tenant=${DEMO}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to_phone: '+12025550111', lead_id: leadId, contact_id: contactId }),
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.historyRecorded, false)
  assert.equal(body.sid, `CA${'2'.repeat(32)}`)
  const calls = h.getWrites().filter(q => q.database === 'provider')
  assert.equal(calls.length, 1)
  assert.deepEqual(Array.from(calls[0].payload.statusCallbackEvent), ['completed'])
  assert.ok(!JSON.stringify(body).includes('private synthetic history error'))
})
test('ordinary people contact call does not create a CRM event or unresolvable callback', async () => {
  const { h, POST } = staffSetup()
  const response = await POST(new Request(`https://synthetic.invalid/api/calls?tenant=${DEMO}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to_phone: '+12025550111' }),
  }))
  assert.equal(response.status, 200)
  const call = h.getWrites().find(q => q.database === 'provider')
  assert.equal(call.payload.statusCallback, undefined)
  assert.equal(h.getWrites().filter(q => q.table === 'lead_events').length, 0)
})