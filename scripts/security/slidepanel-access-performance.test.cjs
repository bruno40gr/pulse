/* eslint-disable @typescript-eslint/no-require-imports -- Offline authorization/query regressions. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function scenario({ legacy = false, status = 'active', roleTenant = HEAD, linked = false } = {}) {
  return {
    actor: legacy ? { personId: 'viewer', instructorId: 'teacher', displayName: 'Staff', access: { kind: 'headliner' } } : null,
    authUser: legacy ? null : { id: 'auth' },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'viewer', auth_user_id: linked ? 'primary-auth' : 'auth', role_id: 'role', status, legacy_access_enabled: true }],
      membership_login_links: linked ? [{ auth_user_id: 'auth', membership_id: 'membership', revoked_at: null }] : [],
      roles: [{ id: 'role', tenant_id: roleTenant, key: 'admin' }],
      role_permissions: [{ role_id: 'role', permission_id: 'permission' }],
      permissions: [{ id: 'permission', key: 'leads.manage' }],
      lead_intakes: [{ id: 'lead', tenant_id: HEAD, intake_type: 'lesson_inquiry', payload: {}, created_at: '2026-11-12T00:00:00Z', crm_contacts: null }],
      lead_events: [{ id: 'note', tenant_id: HEAD, lead_intake_id: 'lead', event_type: 'note_added', payload: { text: 'Fictional note', actor: { personId: 'viewer' } }, created_at: '2026-11-12T00:00:00Z' }],
      people: [{ id: 'viewer', tenant_id: HEAD, first_name: 'Current', last_name: 'Staff' }],
    },
  }
}

for (const legacy of [false, true]) test(`lead GET avoids viewer enrichment and duplicate membership reads (${legacy ? 'legacy' : 'personal'})`, async () => {
  const h = createHarness(); h.setScenario(scenario({ legacy }))
  const response = await h.load('app/api/leads/[id]/route.ts').GET(
    new Request('http://synthetic.invalid/api/leads/lead?intake_type=lesson_inquiry'),
    { params: Promise.resolve({ id: 'lead' }) },
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.notes_history[0].editable, true)
  assert.equal(body.notes_history[0].actor_name, 'Current Staff')
  assert.equal(h.getQueries().filter(q => q.table === 'tenant_memberships').length, 1)
  assert.equal(h.getQueries().filter(q => q.table === 'instructors').length, 0)
  assert.equal(h.getQueries().filter(q => q.table === 'people').length, 1, 'Only note-author lookup remains')
  assert.equal(h.getQueries().filter(q => ['role_permissions', 'permissions'].includes(q.table)).length, 0, 'Role query embeds permission keys')
  assert.equal(h.getWrites().length, 0)
  const timings = response.headers.get('server-timing')
  for (const stage of ['access_session', 'access_selection', 'access_role', ...(legacy ? [] : ['access_auth_user'])]) {
    assert.match(timings, new RegExp(`${stage};dur=\\d+`))
  }
})

test('explicit linked login still resolves with one linked membership read', async () => {
  const h = createHarness(); h.setScenario(scenario({ linked: true }))
  const result = await h.load('lib/request-context.ts').resolveMembershipRequestContext(new Request('http://synthetic.invalid/'))
  assert.equal(result.ok, true)
  assert.equal(result.context.membershipId, 'membership')
  assert.equal(h.getQueries().filter(q => q.table === 'membership_login_links').length, 1)
  assert.equal(h.getQueries().filter(q => q.table === 'tenant_memberships').length, 1, 'Primary selection is not repeated before linked lookup')
})

for (const options of [{ status: 'suspended' }, { roleTenant: DEMO }]) test(`optimized access denies invalid membership/role ${JSON.stringify(options)}`, async () => {
  const h = createHarness(); h.setScenario(scenario(options))
  const result = await h.load('lib/tenant-request.ts').authorizeTenantRequest(new Request(`http://synthetic.invalid/?tenant=${HEAD}`))
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
  assert.equal(h.getQueries().some(q => q.table === 'lead_intakes'), false)
})

test('concurrent role/mapping lookup fails closed on database failure', async () => {
  const h = createHarness(); h.setScenario({ ...scenario(), errors: { role_permissions: { message: 'Unavailable' } } })
  const result = await h.load('lib/tenant-request.ts').authorizeTenantRequest(new Request(`http://synthetic.invalid/?tenant=${HEAD}`))
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})

test('authorization reuse never crosses Request objects or tenant selections', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const resolve = h.load('lib/request-context.ts').resolveMembershipRequestContext
  const request = new Request('http://synthetic.invalid/')
  const first = resolve(request, HEAD)
  assert.equal(first, resolve(request, HEAD))
  assert.equal((await first).ok, true)
  assert.equal((await resolve(request, DEMO)).ok, false)
  h.setScenario(scenario({ status: 'suspended' }))
  assert.equal((await resolve(new Request(request), HEAD)).ok, false)
  const getTimings = h.load('lib/request-context.ts').getRequestAccessTimings
  assert.deepEqual(Object.keys(getTimings(new Request(request))), [], 'Timing data never leaks across requests')
})

test('missing embedded permission fails closed instead of granting partial access', async () => {
  const h = createHarness(); const data = scenario(); data.fixtures.permissions = []; h.setScenario(data)
  const result = await h.load('lib/tenant-request.ts').authorizeTenantRequest(new Request(`http://synthetic.invalid/?tenant=${HEAD}`))
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})