/* eslint-disable @typescript-eslint/no-require-imports -- Offline operational Staff route regressions. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const person = '10000000-0000-0000-0000-000000000001'
const other = '10000000-0000-0000-0000-000000000002'
const state = () => ({ snapshot: { data: { students: [], accounts: [], lessons: [] }, makeups: { items: [], absences: [] } }, setup: { teachers: [], locations: [], services: [], policies: [] } })
function scenario(permissions = ['staff.read', 'staff.manage']) {
  return { env: { NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE: 'true' }, authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: person, auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }],
    role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })), permissions: permissions.map((key, i) => ({ id: String(i), key })), tenants: [{ id: HEAD }],
    people: [{ id: person, tenant_id: HEAD, first_name: 'Existing', last_name: 'Staff' }],
    instructors: [{ id: 'instructor', tenant_id: HEAD, person_id: person }],
    academy_workspaces: [{ tenant_id: HEAD, revision: 3, state: state() }],
  }, rpcResults: { save_academy_workspace: { revision: 4 } } }
}
const request = (body, id = person, tenant = HEAD) => new Request(`https://synthetic.invalid/api/staff/work-profile?tenant=${tenant}&person=${id}`, body === undefined ? undefined : { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('operational Staff stays in place and legacy staff links redirect without autosaving the sandbox', () => {
  const source = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
  const staff = source('app/dashboard/staff/page.tsx')
  assert.match(staff, /onManageWorkProfile=.*setWorkProfilePersonId/)
  assert.doesNotMatch(staff, /window.location.assign\(`\/odeon-demo/)
  const workspace = source('beta-source/app/odeon-demo/DemoWorkspace.tsx')
  assert.match(workspace, /router.replace\(`\/dashboard\/staff/)
  assert.match(workspace, /if \(!ready \|\| liveStaff \|\| blockedSave.current\) return/)
})

test('sample Staff refreshes its supplied roster and nested Beta dialogs share operational layer ownership', () => {
  const source = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
  assert.match(source('beta-source/app/dashboard/staff/StaffView.tsx'), /if \(sampleStaff\) \{\s*setStaff\(sampleStaff\)/)
  const layer = source('beta-source/lib/useDialogLayer.ts')
  assert.match(layer, /from '@\/lib\/dialog-stack'/)
  assert.doesNotMatch(layer, /from '@\/beta-source\/lib\/dialog-stack'/)
})

test('existing Staff opens an unsaved explicit work profile without a second directory or invented eligibility', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/staff/work-profile/route.ts').GET(request())
  assert.equal(response.status, 200)
  const profile = await response.json()
  assert.equal(profile.record.values.personId, person)
  assert.equal(profile.record.values.name, 'Existing Staff')
  assert.equal(profile.record.values.assignments, '[]')
  assert.equal(profile.record.values.canPerformAdmin, 'no')
  assert.equal(profile.setup.teachers.length, 0)
  assert.equal(h.getWrites().length, 0)
})
test('availability saves atomically without replacing Staff, contact identities or unrelated workspace data', async () => {
  const h = createHarness(); h.setScenario(scenario()); const route = h.load('app/api/staff/work-profile/route.ts')
  const profile = await (await route.GET(request())).json()
  const values = { ...profile.record.values, name: 'Wrong', personId: other, maxTeachingGap: '90', publicBooking: 'no', availability: '[{"id":"hours","day":0,"from":600,"to":720}]' }
  const response = await route.PUT(request({ revision: 3, values }))
  assert.equal(response.status, 200)
  const write = h.getQueries().find(q => q.table === 'save_academy_workspace')
  assert.equal(write.payload.p_revision, 3)
  assert.equal(write.payload.p_state.setup.teachers.length, 1)
  assert.equal(write.payload.p_state.setup.teachers[0].values.personId, person)
  assert.equal(write.payload.p_state.setup.teachers[0].values.name, 'Existing Staff')
  assert.equal(write.payload.p_state.setup.teachers[0].values.availability, values.availability)
  assert.equal(write.payload.p_state.setup.teachers[0].values.maxTeachingGap, '90')
  assert.equal(write.payload.p_state.setup.teachers[0].values.publicBooking, 'no')
  assert.deepEqual(JSON.parse(JSON.stringify(write.payload.p_state.snapshot)), state().snapshot)
  assert.ok(!h.getWrites().some(q => ['people', 'instructors'].includes(q.table)))
})
test('missing staff, ambiguous and legacy links, stale revisions and unauthorized writes fail closed', async () => {
  const h = createHarness(); h.setScenario(scenario()); const route = h.load('app/api/staff/work-profile/route.ts')
  h.setScenario({ env: { NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE: 'true' } }); assert.equal((await route.GET(request())).status, 401)
  h.setScenario(scenario()); assert.equal((await route.GET(request(undefined, other))).status, 404)
  let base = scenario(); base.fixtures.academy_workspaces[0].state.setup.teachers = [{ id: 'legacy', values: { name: 'Existing Staff' } }]
  h.setScenario(base); assert.equal((await route.GET(request())).status, 409)
  base = scenario(); base.fixtures.academy_workspaces[0].state.setup.teachers = ['a', 'b'].map(id => ({ id, values: { personId: person } }))
  h.setScenario(base); assert.equal((await route.GET(request())).status, 409)
  h.setScenario(scenario()); assert.equal((await route.PUT(request({ revision: 2, values: {} }))).status, 409)
  h.setScenario(scenario(['staff.read'])); assert.equal((await route.PUT(request({ revision: 3, values: {} }))).status, 403)
  assert.equal(h.getWrites().length, 0)
})
test('malformed schedules and conflicting CAS are rejected without success claims', async () => {
  const h = createHarness(); h.setScenario(scenario()); const route = h.load('app/api/staff/work-profile/route.ts')
  const profile = await (await route.GET(request())).json()
  assert.equal((await route.PUT(request({ revision: 3, values: { ...profile.record.values, availabilityWeeks: '{}' } }))).status, 400)
  const base = scenario(); base.rpcResults.save_academy_workspace = { conflict: true, revision: 4 }; h.setScenario(base)
  assert.equal((await route.PUT(request({ revision: 3, values: profile.record.values }))).status, 409)
})

test('reopening an explicitly linked profile keeps its identity and saving preserves other staff', async () => {
  const h = createHarness(), base = scenario()
  const values = { personId: person, name: 'Existing Staff', assignments: '[]', availability: '[]', canPerformAdmin: 'no', engineeringLevel: '0' }
  const colleague = { id: 'colleague', values: { personId: other, name: 'Other Staff', availability: '[]', assignments: '[]' } }
  base.fixtures.academy_workspaces[0].state.setup.teachers = [{ id: 'stable-profile', values }, colleague]
  h.setScenario(base)
  const route = h.load('app/api/staff/work-profile/route.ts')
  const profile = await (await route.GET(request())).json()
  assert.equal(profile.record.id, 'stable-profile')
  assert.equal((await route.PUT(request({ revision: 3, values: { ...profile.record.values, canPerformAdmin: 'yes' } }))).status, 200)
  const saved = h.getQueries().find(q => q.table === 'save_academy_workspace').payload.p_state.setup.teachers
  assert.equal(saved.length, 2)
  assert.equal(saved[0].id, 'stable-profile')
  assert.equal(saved[0].values.canPerformAdmin, 'yes')
  assert.deepEqual(JSON.parse(JSON.stringify(saved[1])), colleague)
})