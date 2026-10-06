/* eslint-disable @typescript-eslint/no-require-imports -- Runnable with node --test, without a new test framework. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

const OTHER = '00000000-0000-0000-0000-000000000004'
const actor = { instructorId: 'teacher', personId: 'staff', displayName: 'Synthetic Staff', fullName: 'Synthetic Staff', access: { kind: 'headliner' } }
const demo = { ...actor, access: { kind: 'demo', tenantId: DEMO } }
const request = (query = '', body) => new Request(`http://synthetic.invalid/api/contacts${query}`, body === undefined ? undefined : {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

function staffScenario({ tenant = HEAD, legacy = false, status = 'active', role = 'admin', permissions = ['contacts.read'], legacyEnabled = true } = {}) {
  return {
    actor: legacy ? actor : null, authUser: legacy ? null : { id: 'auth' },
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: tenant, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status, legacy_access_enabled: legacyEnabled }],
      roles: [{ id: 'role', tenant_id: tenant, key: role }],
      role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })),
      permissions: permissions.map((key, i) => ({ id: String(i), key })),
      people: [{ id: 'synthetic-person', tenant_id: tenant, first_name: 'Synthetic', last_name: 'Person', custom_fields: {}, students: [] }],
      tenants: [{ id: HEAD, name: 'Synthetic Headliner' }, { id: OTHER, name: 'Synthetic Other' }, { id: DEMO, name: 'Synthetic Demo' }],
    },
  }
}

function setup(scenario = {}) {
  const harness = createHarness()
  harness.setScenario(scenario)
  return { harness, authorize: harness.load('lib/tenant-request.ts').authorizeTenantRequest }
}

test('unauthenticated request is denied', async () => {
  const { authorize } = setup()
  assert.equal((await authorize(request())).status, 401)
})
test('omitted tenant resolves the personal Headliner membership', async () => {
  const { authorize } = setup(staffScenario())
  assert.equal((await authorize(request(), { permission: 'contacts.read' })).tenantId, HEAD)
})
test('supported legacy access works without account claiming', async () => {
  const { authorize } = setup(staffScenario({ legacy: true, status: 'invited' }))
  assert.equal((await authorize(request(), { permission: 'contacts.read' })).tenantId, HEAD)
})
test('other-school omission resolves its own school and explicit Headliner is denied', async () => {
  const { authorize } = setup(staffScenario({ tenant: OTHER }))
  assert.equal((await authorize(request())).tenantId, OTHER)
  assert.equal((await authorize(request(`?tenant=${HEAD}`))).status, 403)
})
for (const status of ['suspended', 'deactivated']) test(`${status} membership is denied`, async () => {
  const { authorize } = setup(staffScenario({ status }))
  assert.equal((await authorize(request())).status, 403)
})
test('disabled legacy access is denied without forcing a claim', async () => {
  const { authorize } = setup(staffScenario({ legacy: true, legacyEnabled: false }))
  assert.equal((await authorize(request())).status, 403)
})
test('insufficient permission is denied', async () => {
  const { authorize } = setup(staffScenario({ permissions: [] }))
  assert.equal((await authorize(request(), { permission: 'contacts.read' })).status, 403)
})
test('legacy identity cannot use its super-scope to bypass membership', async () => {
  const { authorize } = setup(staffScenario({ legacy: true, tenant: OTHER }))
  assert.equal((await authorize(request(`?tenant=${HEAD}`))).status, 403)
})
test('owner remains permitted without a role permission mapping', async () => {
  const { authorize } = setup(staffScenario({ role: 'owner', permissions: [] }))
  assert.equal((await authorize(request(), { permission: 'contacts.read' })).ok, true)
})
test('body and query disagreement is rejected before writes', async () => {
  const { harness, authorize } = setup(staffScenario())
  assert.equal((await authorize(request(`?tenant=${HEAD}`), { body: { tenant_id: OTHER } })).status, 400)
  assert.equal(harness.getWrites().length, 0)
})
test('body selection is authorized, never trusted', async () => {
  const { authorize } = setup(staffScenario())
  assert.equal((await authorize(request(), { body: { tenantId: OTHER } })).status, 403)
})
test('empty and malformed tenant values never default', async () => {
  const { authorize } = setup(staffScenario())
  for (const query of ['?tenant=', '?tenant=demo', '?tenant=invalid']) assert.equal((await authorize(request(query))).status, 400)
})
test('duplicate conflicting query selections are rejected', async () => {
  const { authorize } = setup(staffScenario())
  assert.equal((await authorize(request(`?tenant=${HEAD}&tenant=${OTHER}`))).status, 400)
})
test('membership lookup failure fails closed without domain queries', async () => {
  const scenario = staffScenario()
  scenario.errors = { tenant_memberships: { message: 'Synthetic private database detail' } }
  const { harness } = setup(scenario)
  const response = await harness.load('app/api/contacts/route.ts').GET(request())
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes('Synthetic private'), false)
  assert.equal(harness.getQueries().some(q => q.table === 'people'), false)
})
test('multiple memberships require explicit selection', async () => {
  const scenario = staffScenario()
  scenario.fixtures.tenant_memberships.push({ ...scenario.fixtures.tenant_memberships[0], tenant_id: OTHER })
  const { authorize } = setup(scenario)
  assert.equal((await authorize(request())).status, 400)
  assert.equal((await authorize(request(`?tenant=${HEAD}`))).tenantId, HEAD)
})
test('demo reads are pinned to the signed tenant and staff writes are denied', async () => {
  const { authorize } = setup({ actor: demo })
  assert.equal((await authorize(request(), { allowDemo: true })).tenantId, DEMO)
  assert.equal((await authorize(request())).status, 403)
  assert.equal((await authorize(request(`?tenant=${HEAD}`), { allowDemo: true })).status, 403)
})

const routes = ['brand-settings', 'campaigns', 'contacts', 'history', 'inbox', 'insights', 'pulse-settings', 'recipient-search', 'staff', 'tenant-fields', 'twilio/campaign-copy', 'tenant/sync-status', 'media-suggestions', 'tenant']
for (const route of routes) {
  test(`demo omitted tenant never queries Headliner: ${route}`, async () => {
    const { harness } = setup({ actor: demo, allowSyntheticAI: true })
    const response = await harness.load(`app/api/${route}/route.ts`).GET(new Request(`http://synthetic.invalid/api/${route}`))
    assert.equal(response.status, 200)
    assert.equal(harness.getQueries().some(q => q.filters.some(([method, key, value]) => method === 'eq' && value === HEAD && (key === 'tenant_id' || (q.table === 'tenants' && key === 'id')))), false)
  })
  test(`unauthenticated denied before domain reads: ${route}`, async () => {
    const { harness } = setup()
    const response = await harness.load(`app/api/${route}/route.ts`).GET(new Request(`http://synthetic.invalid/api/${route}`))
    assert.equal(response.status, 401)
    assert.equal(harness.getQueries().length, 0)
  })
  test(`other-school omission never queries Headliner: ${route}`, async () => {
    const { harness } = setup({ ...staffScenario({ tenant: OTHER, role: 'owner' }), allowSyntheticAI: true })
    const response = await harness.load(`app/api/${route}/route.ts`).GET(new Request(`http://synthetic.invalid/api/${route}`))
    assert.equal(response.status, 200)
    assert.equal(harness.getQueries().some(q => q.filters.some(([method, key, value]) => method === 'eq' && value === HEAD && (key === 'tenant_id' || (q.table === 'tenants' && key === 'id')))), false)
  })
}

test('contacts happy path retains array response and synthetic data', async () => {
  const { harness } = setup(staffScenario())
  const response = await harness.load('app/api/contacts/route.ts').GET(request())
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(Array.isArray(data), true)
  assert.equal(data[0].first_name, 'Synthetic')
})
test('recipient search preserves search filter and result shape', async () => {
  const { harness } = setup(staffScenario())
  const response = await harness.load('app/api/recipient-search/route.ts').GET(request('?q=Synthetic'))
  assert.equal(response.status, 200)
  assert.equal(Array.isArray(await response.json()), true)
  const query = harness.getQueries().find(q => q.table === 'people')
  assert.equal(query.filters.some(([method, value]) => method === 'or' && value.includes('first_name.ilike.*Synthetic*')), true)
})
test('tenant list contains only the authenticated membership school', async () => {
  const { harness } = setup(staffScenario({ tenant: OTHER }))
  const response = await harness.load('app/api/tenant/route.ts').GET(request())
  assert.deepEqual((await response.json()).map(row => row.id), [OTHER])
})
test('contact creation without tenant keeps Headliner compatibility', async () => {
  const { harness } = setup(staffScenario({ permissions: ['contacts.manage'] }))
  const response = await harness.load('app/api/contacts/create/route.ts').POST(request('', { first_name: 'Synthetic', last_name: 'Person' }))
  assert.equal(response.status, 200)
  assert.equal(harness.getWrites()[0].payload.tenant_id, HEAD)
})
test('contact creation rejects foreign body tenant without writes', async () => {
  const { harness } = setup(staffScenario({ permissions: ['contacts.manage'] }))
  const response = await harness.load('app/api/contacts/create/route.ts').POST(request(`?tenant=${HEAD}`, { tenant_id: OTHER, first_name: 'Synthetic', last_name: 'Person' }))
  assert.equal(response.status, 400)
  assert.equal(harness.getWrites().length, 0)
})
test('demo campaign creation stays inside the demo tenant', async () => {
  const { harness } = setup({ actor: demo })
  const response = await harness.load('app/api/campaigns/route.ts').POST(request('', { message: 'Synthetic demo' }))
  assert.equal(response.status, 200)
  assert.equal(harness.getWrites()[0].payload.tenant_id, DEMO)
})
test('demo cannot import contacts', async () => {
  const { harness } = setup({ actor: demo })
  const response = await harness.load('app/api/contacts/route.ts').POST(request('', { csv: 'Synthetic' }))
  assert.equal(response.status, 403)
  assert.equal(harness.getWrites().length, 0)
})
test('shared resolver ignores the caller-provided default tenant', async () => {
  const { harness } = setup(staffScenario({ tenant: OTHER, legacy: true }))
  const result = await harness.load('lib/tenant-access.ts').resolveRequestTenant(request(), HEAD)
  assert.equal(result.tenantId, OTHER)
})

test('CSV import with omitted tenant reaches the existing empty-import success path', async () => {
  const { harness } = setup(staffScenario({ permissions: ['contacts.manage'] }))
  const response = await harness.load('app/api/contacts/route.ts').POST(request('', { csv: 'Client Name,Staff Name\n' }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.created, 0)
  assert.equal(harness.getQueries().filter(q => q.table === 'people').every(q => q.filters.some(([method, key, value]) => method === 'eq' && key === 'tenant_id' && value === HEAD)), true)
})
test('CSV import tenant mismatch makes no writes', async () => {
  const { harness } = setup(staffScenario({ permissions: ['contacts.manage'] }))
  const response = await harness.load('app/api/contacts/route.ts').POST(request(`?tenant=${HEAD}`, { tenant_id: OTHER, csv: 'Name\nSynthetic' }))
  assert.equal(response.status, 400)
  assert.equal(harness.getWrites().length, 0)
})

for (const legacy of [false, true]) test(`populated mapped CSV imports without tenant selection (${legacy ? 'legacy' : 'personal'})`, async () => {
  const scenario = staffScenario({ legacy, permissions: ['contacts.manage'] })
  const { harness } = setup(scenario)
  const csv = 'Student,Email,Family,Family Email,Date,Attendance,Service\n"Synthetic, Student",student@example.invalid,Synthetic Family,family@example.invalid,2026-10-01,Present,Piano\n"Synthetic, Student",student@example.invalid,Synthetic Family,family@example.invalid,2026-10-02,Absent,Piano\n'
  const mappings = [
    ['Student', 'full_name'], ['Email', 'email'], ['Family', 'account_holder_name'],
    ['Family Email', 'account_holder_email'], ['Date', 'session_date'],
    ['Attendance', 'attendance_status'], ['Service', 'program'],
  ].map(([csv_column, field_key]) => ({ csv_column, field_key }))
  const response = await harness.load('app/api/contacts/route.ts').POST(request('', { csv, mappings }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.created, 1)
  assert.equal(result.updated, 0)
  const writes = harness.getWrites()
  for (const table of ['accounts', 'people', 'students', 'enrollments']) {
    const rows = writes.filter(q => q.table === table && q.operation === 'insert')
    assert.equal(rows.length, 1, `${table} insert count`)
    assert.equal(rows[0].payload.tenant_id, HEAD)
  }
  const person = writes.find(q => q.table === 'people' && q.operation === 'insert').payload
  assert.equal(person.email, 'student@example.invalid')
  const account = writes.find(q => q.table === 'accounts' && q.operation === 'insert').payload
  assert.equal(account.email, 'family@example.invalid')
  const student = writes.find(q => q.table === 'students' && q.operation === 'insert').payload
  assert.equal(student.last_attended, '2026-10-01')
  const enrollment = writes.find(q => q.table === 'enrollments' && q.operation === 'insert').payload
  assert.equal(enrollment.custom_fields.attendance.length, 2)
  assert.deepEqual(Array.from(enrollment.custom_fields.attendance, row => [row.session_date, row.status]), [
    ['2026-10-02', 'absent'], ['2026-10-01', 'attended'],
  ])
})
test('Headliner campaign creation keeps its existing response and school', async () => {
  const { harness } = setup(staffScenario({ permissions: ['communications.send'] }))
  const response = await harness.load('app/api/campaigns/route.ts').POST(request('', { message: 'Synthetic message' }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).message, 'Synthetic message')
  assert.equal(harness.getWrites()[0].payload.tenant_id, HEAD)
})
test('inbox count-only branch denies wrong tenant before message queries', async () => {
  const { harness } = setup(staffScenario({ tenant: OTHER, permissions: ['communications.read'] }))
  const response = await harness.load('app/api/inbox/route.ts').GET(request(`?tenant=${HEAD}&count_only=1`))
  assert.equal(response.status, 403)
  assert.equal(harness.getQueries().some(q => q.table === 'messages'), false)
})
test('valid Headliner inbox count and mark-read remain available', async () => {
  const { harness } = setup(staffScenario({ permissions: ['communications.read'] }))
  const handler = harness.load('app/api/inbox/route.ts')
  const count = await handler.GET(request('?count_only=1'))
  assert.equal(count.status, 200)
  assert.equal((await count.json()).count, 0)
  const marked = await handler.PATCH(new Request('http://synthetic.invalid/api/inbox', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ other_phone: '+15555550123' }),
  }))
  assert.equal(marked.status, 200)
  assert.equal((await marked.json()).marked_read, 0)
})