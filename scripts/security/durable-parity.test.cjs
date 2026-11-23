/* eslint-disable @typescript-eslint/no-require-imports -- Offline route regression. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const id = '00000000-0000-0000-0000-000000000071'
const person = '00000000-0000-0000-0000-000000000072'
const actor = '00000000-0000-0000-0000-000000000073'
const base = (permissions = ['contacts.read', 'contacts.manage']) => ({ actor: { personId: 'staff', displayName: 'Staff' }, env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }, fixtures: {
  people: [{ id: 'staff', tenant_id: HEAD }],
  tenant_memberships: [{ id: actor, tenant_id: HEAD, person_id: 'staff', role_id: 'role', legacy_access_enabled: true, status: 'unclaimed' }],
  roles: [{ id: 'role', tenant_id: HEAD, key: 'staff' }],
  permissions: permissions.map(key => ({ id: key, key })), role_permissions: permissions.map(key => ({ role_id: 'role', permission_id: key })),
} })
const draft = () => ({ id, kind: 'group', institution: 'music', step: 1, reviewedSteps: [0], started: true,
  data: { id, formation: true, name: 'Saved band', description: 'Retain this text', leader: '', memberIds: [person], typeId: 'group-type-0' } })
const req = (path, method = 'GET', body, tenant = HEAD) => new Request(`http://localhost/api/${path}?tenant=${tenant}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

test('band draft transport preserves fields and revisions, and surfaces stale writes', async () => {
  const h = createHarness()
  h.setScenario({ ...base(), fixtures: { ...base().fixtures, band_creation_drafts: [{ tenant_id: HEAD, id, revision: 2, state: draft(), completed_at: null }] }, rpcResults: { save_band_creation_draft: { revision: 3 } } })
  const route = h.load('app/api/bands/drafts/route.ts')
  const listing = await route.GET(req('bands/drafts'))
  assert.equal(listing.status, 200)
  assert.equal((await listing.json()).drafts[0].state.data.description, 'Retain this text')
  assert.equal((await route.PUT(req('bands/drafts', 'PUT', { revision: 2, draft: draft(), complete: false }))).status, 200)
  const call = h.getWrites().find(row => row.table === 'save_band_creation_draft')
  assert.equal(call.payload.p_tenant, HEAD)
  assert.equal(call.payload.p_actor, actor)
  assert.equal(call.payload.p_revision, 2)
  assert.equal(call.payload.p_state.data.description, 'Retain this text')
  h.setScenario({ ...base(), rpcResults: { save_band_creation_draft: { conflict: true } } })
  assert.equal((await route.PUT(req('bands/drafts', 'PUT', { revision: 2, draft: draft(), complete: false }))).status, 409)
})

test('draft and family mutations reject view-only, foreign tenant, demo and invalid payloads without domain writes', async () => {
  for (const path of ['bands/drafts', 'contacts/family']) {
    const h = createHarness()
    for (const [scenario, tenant, status] of [[base(['contacts.read']), HEAD, 403], [base(), DEMO, 403], [{ ...base(), actor: { access: { kind: 'demo', tenantId: HEAD } } }, HEAD, 403]]) {
      h.setScenario(scenario)
      const route = h.load(`app/api/${path}/route.ts`)
      assert.equal((await route[path === 'bands/drafts' ? 'PUT' : 'POST'](req(path, path === 'bands/drafts' ? 'PUT' : 'POST', {}, tenant))).status, status)
      assert.equal(h.getWrites().length, 0)
    }
    h.setScenario(base())
    const route = h.load(`app/api/${path}/route.ts`)
    assert.equal((await route[path === 'bands/drafts' ? 'PUT' : 'POST'](req(path, path === 'bands/drafts' ? 'PUT' : 'POST', {}))).status, 400)
    assert.equal(h.getWrites().length, 0)
  }
})

test('family operations use an authorized transactional writer with explicit IDs and stale revision', async () => {
  const h = createHarness(); h.setScenario({ ...base(), rpcResults: { change_contact_family: { saved: true } } })
  const route = h.load('app/api/contacts/family/route.ts')
  const body = { kind: 'link-account', operationId: id, accountId: id, managerAccountId: actor, personId: person, relationship: 'Parent / guardian', expectedRevision: 4 }
  assert.equal((await route.POST(req('contacts/family', 'POST', body))).status, 200)
  const write = h.getWrites()[0]
  assert.equal(write.table, 'change_contact_family')
  assert.equal(write.payload.p_tenant, HEAD)
  assert.equal(write.payload.p_change.expected_revision, 4)
  assert.equal(write.payload.p_change.manager_account_id, actor)
  h.setScenario({ ...base(), rpcErrors: { change_contact_family: { message: 'stale' } } })
  assert.equal((await route.POST(req('contacts/family', 'POST', body))).status, 409)
  for (const patch of [{ expectedRevision: -1 }, { firstName: 45, kind: 'child' }, { personId: 'preview:sample' }, { relationship: 'sender' }]) {
    h.setScenario(base())
    assert.equal((await route.POST(req('contacts/family', 'POST', { ...body, ...patch }))).status, 400)
    assert.equal(h.getWrites().length, 0)
  }
})

test('new family links are not messaging grants, but legacy and primary routing remain supported', () => {
  const h = createHarness(), { resolveCommunicationRecipients } = h.load('lib/communication-recipients.ts')
  const result = resolveCommunicationRecipients([{ id, first_name: 'Child', students: [{ is_minor: true, accounts: { name: 'Primary', email: 'primary@example.test' }, student_accounts: [
    { communication_enabled: false, accounts: { email: 'new-parent@example.test' } },
    { accounts: { email: 'legacy-parent@example.test' } },
  ] }] }], 'email')
  assert.deepEqual(Array.from(result.recipients, row => row.destination).sort(), ['legacy-parent@example.test', 'primary@example.test'])
})

test('account manager operations target people on an account without a dependent or another account', async () => {
  const h = createHarness()
  h.setScenario({ ...base(), rpcResults: { change_account_manager: { saved: true } } })
  const route = h.load('app/api/contacts/family/route.ts')
  for (const body of [
    { kind: 'manager-link', personId: person },
    { kind: 'manager-create', firstName: 'New', lastName: 'Manager', birthday: '1980-01-01' },
    { kind: 'manager-unlink', personId: person },
  ]) {
    const response = await route.POST(req('contacts/family', 'POST', { ...body, accountId: id, operationId: id }))
    assert.equal(response.status, 200)
  }
  const writes = h.getWrites().filter(row => row.table === 'change_account_manager')
  assert.equal(writes.length, 3)
  assert.equal(writes[0].payload.p_change.person_id, person)
  assert.equal(writes[0].payload.p_change.account_id, id)
  assert.equal(writes[1].payload.p_change.person_id, null)
  assert.equal(writes[1].payload.p_change.fields.date_of_birth, '1980-01-01')
  h.setScenario(base(['contacts.read']))
  assert.equal((await route.POST(req('contacts/family', 'POST', { kind: 'manager-link', accountId: id, personId: person, operationId: id }))).status, 403)
  assert.equal(h.getWrites().length, 0)
  h.setScenario(base())
  assert.equal((await route.POST(req('contacts/family', 'POST', { kind: 'manager-link', accountId: id, personId: 'preview:sample', operationId: id }))).status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('draft validation rejects sample IDs, duplicate members and bad progress', () => {
  const h = createHarness(), { validBandCreationDraft } = h.load('lib/band-creation-draft.ts')
  assert.equal(validBandCreationDraft(draft()), true)
  for (const patch of [{ id: 'preview:sample' }, { step: 4 }, { reviewedSteps: [30] }, { data: { ...draft().data, memberIds: [person, person] } }]) assert.equal(validBandCreationDraft({ ...draft(), ...patch }), false)
})