/* eslint-disable @typescript-eslint/no-require-imports -- Offline identity and route contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const account = uuid(10), other = uuid(11)
function setup(options = {}) {
  const h = createHarness(), grants = options.readOnly ? ['contacts.read'] : ['contacts.read', 'contacts.manage']
  h.setScenario({ env: { NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS: options.disabled ? 'false' : 'true' },
    actor: options.anonymous ? null : { personId: 'staff', displayName: 'Staff' }, fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'role', legacy_access_enabled: true, status: 'active' }],
      roles: [{ id: 'role', tenant_id: HEAD, key: options.role || 'assistant' }],
      permissions: grants.map(key => ({ id: key, key })), role_permissions: grants.map(key => ({ role_id: 'role', permission_id: key })),
      accounts: [{ id: account, tenant_id: options.foreign ? DEMO : HEAD, name: 'Primary' }, { id: other, tenant_id: HEAD, name: 'Existing account' }],
      family_account_links: [{ tenant_id: HEAD, family_account_id: account, member_account_id: other }],
      account_follow_ups: [{ id: uuid(12), tenant_id: HEAD, account_id: account, status: 'open', version: 1, message: 'Shared family reminder' },
        { id: uuid(13), tenant_id: DEMO, account_id: account, message: 'Foreign' }],
    }, errors: options.storageError ? { account_follow_ups: { code: '42P01' } } : {},
    rpcResults: { save_account_follow_up: [{ id: uuid(12), account_id: account, version: 2 }], link_family_account: { saved: true } },
    rpcErrors: options.conflict ? { save_account_follow_up: { code: '40001' } } : {},
  })
  return h
}
const route = 'app/api/contacts/accounts/[id]/follow-ups/route.ts'
const command = { action: 'save', lead_intake_id: null, expected_version: 0, due_at: '2026-12-01T20:00:00Z', message: 'Family reminder' }

test('legacy family anchors use the actual holder once, including saved contact details', () => {
  const { displayAccountHolders, familyHeaderHolder } = createHarness().load('lib/family-account.ts')
  for (const name of ['Sam Berns', 'Cynthia Abutin', 'Janeen Llamas', 'Rita Thiara']) {
    const holders = displayAccountHolders([{ account_id: account, account_holder_name: 'Legacy billing shell',
      account_holders: [{ account_id: other, name, phone: '2025550100', email: 'holder@example.invalid', is_primary: true }] }])
    const header = familyHeaderHolder(`account:${account}`, holders)
    assert.equal(header.name, name)
    assert.equal(header.phone, '2025550100')
    assert.equal(holders.filter(holder => holder.id !== header.id).length, 0)
  }
})

test('source-verified Binh/Mae display roles coalesce without creating a messaging holder identity', () => {
  const h = createHarness(), { holderDisplayPersonId } = h.load('lib/holder-display-identity.ts')
  const evidence = require('../../lib/holder-display-identity-evidence.json')
  for (const item of evidence.accounts) {
    const person = { id: 'adult', tenant_id: HEAD, first_name: 'Verified', last_name: 'Person', custom_fields: { external_id: item.source_person_id },
      is_student: true, student_id: 'role', account_id: item.account_id, staff_id: item.source_person_id.startsWith('c1c4') ? 'instructor' : null }
    assert.equal(holderDisplayPersonId(HEAD, item.account_id, [person]), person.id)
    assert.equal(holderDisplayPersonId(DEMO, item.account_id, [person]), undefined)
    assert.equal(holderDisplayPersonId(HEAD, item.account_id, [person, { ...person, id: 'duplicate' }]), undefined)
    assert.equal(holderDisplayPersonId(HEAD, item.account_id, [{ ...person, custom_fields: {} }]), undefined)
    const student = { id: 'child', tenant_id: HEAD, is_student: true, student_id: 'child-role', account_id: item.account_id,
      account_holder_name: 'Verified Person', account_holders: [{ name: 'Verified Person', account_id: item.account_id, display_person_id: person.id }] }
    const groups = h.load('lib/contact-list-views.ts').contactViewGroups([person, student], [person, student], 'family')
    assert.equal(groups.length, 1)
    assert.equal(groups[0].parent.id, person.id)
    assert.equal(groups[0].parent.staff_id, person.staff_id)
    assert.equal(h.load('lib/family-account.ts').familyDependents([person, student]).length, 1)
    assert.equal(student.account_holders[0].person_id, undefined, 'No recipient grant is inferred')
    assert.equal(student.account_holder_person_id, undefined)
  }
})

test('reviewed source IDs suppress all 13 student billing shells without name or age matching', () => {
  const h = createHarness()
  const { isLegacyStudentBillingAccount } = h.load('lib/legacy-billing-account.ts')
  const evidence = require('../../lib/legacy-billing-account-evidence.json')
  assert.equal(evidence.billing_only_student_accounts.length, 13)
  for (const row of evidence.billing_only_student_accounts) {
    assert.equal(isLegacyStudentBillingAccount(HEAD, row.account_id, row.source_client_id), true)
    assert.equal(isLegacyStudentBillingAccount(DEMO, row.account_id, row.source_client_id), false)
    assert.equal(isLegacyStudentBillingAccount(HEAD, row.account_id, 'different-source'), false)
    assert.equal(isLegacyStudentBillingAccount(HEAD, 'different-account', row.source_client_id), false)
  }
})

test('actual Contacts reader keeps Nathan and Jonathan as students, not holders; preserves billing/reminder/routing IDs', async () => {
  for (const [accountId, sourceId, studentName, holderName] of [
    ['41f77e8e-6c8e-4d5f-b383-c2715edbec8a', '721d6181-efde-46f6-8b57-8c71d3a49d3d', 'Nathan Abutin', 'Cynthia Abutin'],
    ['6771e198-5c51-4c7c-829c-d177e60bc3b7', 'd26061f4-280e-4cd4-a407-39382160f6ef', 'Jonathan Berns', 'Sam Berns'],
  ]) {
    const h = createHarness()
    h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
      people: [{ id: 'child', tenant_id: HEAD, first_name: studentName.split(' ')[0], last_name: studentName.split(' ')[1], custom_fields: { external_id: sourceId },
        students: [{ id: 'role', account_id: accountId, is_minor: true, message_routing: 'account_holder', accounts: { name: studentName }, enrollments: [] }] }],
      student_accounts: [{ student_id: 'role', account_id: other, is_primary: true, 'accounts.tenant_id': HEAD, accounts: { id: other, tenant_id: HEAD, name: holderName, phone: '2025550100' } }],
    } })
    const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
    assert.equal(response.status, 200)
    const rows = await response.json(), child = rows[0]
    assert.equal(child.account_id, accountId)
    assert.equal(child.reminder_account_id, accountId)
    assert.equal(child.message_routing, 'account_holder')
    assert.equal(child.account_holder_name, studentName, 'Legacy routing summary is not rewritten')
    assert.equal(child.family_name, holderName)
    const holders = h.load('lib/family-account.ts').displayAccountHolders(rows)
    assert.deepEqual(Array.from(holders, row => row.name), [holderName])
    assert.equal(h.load('lib/family-account.ts').familyDependents(rows).length, 1)
    assert.equal(h.getWrites().length, 0)
  }
})

test('an explicit empty holder list is authoritative, not a request to infer a holder from billing', () => {
  const { displayAccountHolders } = createHarness().load('lib/family-account.ts')
  assert.equal(displayAccountHolders([{ account_id: account, account_holder_name: 'Student', account_holders: [] }]).length, 0)
  assert.equal(displayAccountHolders([{ account_id: account, account_holder_name: 'Legacy summary' }]).length, 1)
})
const req = (body, id = account) => new Request(`https://synthetic.invalid/api/contacts/accounts/${id}/follow-ups?tenant=${HEAD}`,
  body ? { method: 'PATCH', body: JSON.stringify(body) } : {})
const params = (id = account) => ({ params: Promise.resolve({ id }) })

test('adult holder/student appears once; own role is not a dependent; badges remain their own', () => {
  const h = createHarness(), { contactViewGroups } = h.load('lib/contact-list-views.ts')
  const { familyDependents } = h.load('lib/family-account.ts'), { contactRelationshipBadges } = h.load('lib/contact-relationship.ts')
  for (const [client_status, badge] of [['active', 'Enrolled'], ['disenrolled', 'Disenrolled']]) {
    const adult = { id: 'adult', tenant_id: HEAD, account_id: account, account_holder_person_id: 'adult', account_holder_name: 'Adult',
      is_student: true, student_id: 'adult-role', client_status, account_holders: [{ person_id: 'adult', name: 'Adult' }] }
    const group = contactViewGroups([adult], [adult], 'family')[0]
    assert.equal(group.parent.id, 'adult')
    assert.equal(group.members.filter(row => row.id !== group.parent.id).length, 0)
    assert.equal(familyDependents(group.members).length, 0)
    assert.deepEqual([...contactRelationshipBadges(group.parent)], [badge])
    const child = { id: 'child', tenant_id: HEAD, account_id: account, is_student: true, account_holder_person_id: 'adult', client_status: 'active' }
    assert.equal(familyDependents([adult, child]).length, 1)
    assert.equal(familyDependents([{ ...adult, account_holder_person_id: null, account_holders: [] }]).length, 1, 'Matching names never establish holder identity')
  }
})

test('linked accounts form one display family without changing primary payer account IDs', () => {
  const h = createHarness(), { contactViewGroups } = h.load('lib/contact-list-views.ts')
  const rows = [{ id: 'one', tenant_id: HEAD, account_id: account, family_account_id: account, account_holder_name: 'First', is_student: true },
    { id: 'two', tenant_id: HEAD, account_id: other, family_account_id: account, family_linked_account_ids: [account], account_holder_name: 'Second', is_student: true }]
  const original = JSON.stringify(rows), groups = contactViewGroups(rows, rows, 'family')
  assert.equal(groups.length, 1)
  assert.deepEqual(Array.from(groups[0].members, row => row.id), ['one', 'two'])
  assert.equal(JSON.stringify(rows), original)
})

test('multiple explicit holders retain their own badges and unrelated same-name adults remain distinct', () => {
  const h = createHarness(), { contactViewGroups } = h.load('lib/contact-list-views.ts')
  const { familyDependents } = h.load('lib/family-account.ts'), { contactRelationshipBadges } = h.load('lib/contact-relationship.ts')
  const holders = [{ person_id: 'rob', name: 'Rob Example' }, { person_id: 'alex', name: 'Alex Example' }]
  const rows = [
    { id: 'child', tenant_id: HEAD, account_id: account, account_holder_name: 'Family', is_student: true, account_holders: holders },
    { id: 'rob', tenant_id: HEAD, first_name: 'Rob', last_name: 'Example', is_student: true, client_status: 'a_la_carte' },
    { id: 'alex', tenant_id: HEAD, first_name: 'Alex', last_name: 'Example', is_student: false, custom_fields: { contact_kind: 'booking' } },
    { id: 'unrelated', tenant_id: HEAD, first_name: 'Rob', last_name: 'Example', is_student: false },
  ]
  const groups = contactViewGroups(rows, rows, 'family'), family = groups.find(group => group.holder)
  assert.equal(familyDependents(family.members).length, 1)
  assert.deepEqual([...contactRelationshipBadges(family.members.find(row => row.id === 'rob'))], ['À la carte'])
  assert.deepEqual([...contactRelationshipBadges(family.members.find(row => row.id === 'alex'))], ['Service client'])
  assert.equal(groups.some(group => group.parent?.id === 'unrelated'), true)
  assert.equal(family.members.some(row => row.id === 'unrelated'), false)
})

test('Contacts actual reader projects the display family while preserving billing and routing fields', async () => {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [{ id: 'child', tenant_id: HEAD, students: [{ id: 'role', account_id: other, is_minor: true,
      message_routing: 'account_holder', accounts: { name: 'Existing payer', phone: '555' }, enrollments: [] }] }],
    family_account_links: [{ tenant_id: HEAD, family_account_id: account, member_account_id: other }],
    accounts: [{ id: account, tenant_id: HEAD, name: 'Display family' }],
    student_accounts: [{ student_id: 'role', account_id: account, accounts: { id: account, name: 'Display family' } }],
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  const [child] = await response.json()
  assert.equal(child.family_account_id, account)
  assert.equal(child.family_name, 'Display family')
  assert.equal(child.account_id, other)
  assert.equal(child.account_holder_name, 'Existing payer')
  assert.equal(child.message_routing, 'account_holder')
  assert.equal(h.getWrites().length, 0)
  assert.ok(h.getQueries().filter(query => query.table === 'family_account_links').every(query =>
    query.filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === HEAD)))
})

test('family follow-up is tenant/account-owned and identical from either linked account', async () => {
  for (const id of [account, other]) {
    const h = setup(), response = await h.load(route).GET(req(undefined, id), params(id))
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.account_id, account)
    assert.equal(data.follow_ups.length, 1)
    assert.equal(data.follow_ups[0].message, 'Shared family reminder')
    assert.equal(h.getQueries().some(query => query.table === 'people' || query.table === 'follow_ups'), false)
    assert.equal(h.getWrites().length, 0)
  }
})

test('family follow-up writes target account RPC, reject inquiries and preserve stale drafts', async () => {
  const h = setup(), response = await h.load(route).PATCH(req(command, other), params(other))
  assert.equal(response.status, 200)
  const write = h.getWrites()[0]
  assert.equal(write.table, 'save_account_follow_up')
  assert.equal(write.payload.p_account, account)
  assert.equal('p_person' in write.payload, false)
  for (const [options, body, status] of [
    [{ anonymous: true }, command, 401], [{ readOnly: true }, command, 403], [{ foreign: true }, command, 404],
    [{ role: 'parent' }, command, 403], [{}, { ...command, lead_intake_id: uuid(20) }, 400],
    [{}, { ...command, expected_version: -1 }, 400], [{}, { ...command, due_at: 'bad' }, 400],
  ]) {
    const h = setup(options)
    assert.equal((await h.load(route).PATCH(req(body), params())).status, status)
    assert.equal(h.getWrites().length, 0)
  }
  const stale = setup({ conflict: true })
  assert.equal((await stale.load(route).PATCH(req(command), params())).status, 409)
})

test('disabled feature performs no IO and missing account storage is not an empty success', async () => {
  const h = setup({ disabled: true })
  assert.equal((await h.load(route).GET(req(), params())).status, 404)
  assert.equal(h.getQueries().length, 0)
  const missing = setup({ storageError: true })
  assert.equal((await missing.load(route).GET(req(), params())).status, 503)
})

test('list follow-up summaries include one canonical family reminder for every linked member and retain individual reminders', async () => {
  const h = createHarness()
  h.setScenario({ fixtures: {
    account_follow_ups: [{ id: uuid(80), tenant_id: HEAD, account_id: account, due_at: '2026-12-01T20:00:00Z', message: 'Family', status: 'open' },
      { id: uuid(81), tenant_id: DEMO, account_id: account, due_at: '2026-11-01T20:00:00Z', message: 'Foreign', status: 'open' }],
    follow_ups: [{ id: uuid(82), tenant_id: HEAD, person_id: 'one', lead_intake_id: null, due_at: '2026-12-02T20:00:00Z', message: 'Individual', status: 'open' }],
  } })
  const { attachContactFollowUps } = h.load('lib/contact-follow-ups-server.ts')
  const rows = await attachContactFollowUps(HEAD, [{ id: 'one', account_id: account, family_account_id: account }, { id: 'two', account_id: other, family_account_id: account }], false)
  for (const row of rows) {
    assert.equal(row.follow_up_note, 'Family')
    assert.equal(row.family_follow_up_at, '2026-12-01T20:00:00Z')
  }
  assert.equal(rows[0].follow_up_count, 2)
  assert.equal(rows[1].follow_up_count, 1)
  assert.equal(h.getWrites().length, 0)
})

test('legacy account linking uses explicit accounts and never creates a duplicate person or changes payer routing', async () => {
  const h = setup(), family = h.load('app/api/contacts/family/route.ts')
  const directory = await family.GET(new Request(`https://synthetic.invalid/api/contacts/family?tenant=${HEAD}`))
  assert.equal(directory.status, 200)
  assert.equal((await directory.json()).accounts.some(row => row.id === other), true)
  const body = { kind: 'family-account-link', accountId: account, memberAccountId: other, operationId: uuid(30) }
  const request = value => new Request(`https://synthetic.invalid/api/contacts/family?tenant=${HEAD}`, { method: 'POST', body: JSON.stringify(value) })
  assert.equal((await family.POST(request(body))).status, 200)
  assert.deepEqual(h.getWrites().map(write => write.table), ['link_family_account'])
  assert.equal(h.getWrites()[0].payload.p_change.member_account_id, other)
  assert.equal((await family.POST(request({ ...body, memberAccountId: account }))).status, 400)
})

test('Aguilar, Abutin and Berns saved relationships form display families without changing account or messaging data', async () => {
  const h = createHarness(), { displayFamilyAccountLinks, familyAccountId } = h.load('lib/family-account.ts')
  const students = [{ id: 'Trik', account_id: 'Rob' }, { id: 'Nathan', account_id: 'Nathan' },
    { id: 'Jonathan', account_id: 'Jonathan' }, { id: 'Arya', account_id: 'Sam' }]
  const memberships = [{ student_id: 'Trik', account_id: 'Alexandra' }, { student_id: 'Nathan', account_id: 'Cynthia' },
    { student_id: 'Jonathan', account_id: 'Sam' }]
  const original = JSON.stringify({ students, memberships }), links = displayFamilyAccountLinks([], students, memberships)
  for (const [one, two] of [['Rob', 'Alexandra'], ['Nathan', 'Cynthia'], ['Jonathan', 'Sam']]) assert.equal(familyAccountId(one, links), familyAccountId(two, links))
  const { groupContactFamilies } = h.load('lib/family-list.ts')
  const rows = students.map(student => ({ id: student.id, tenant_id: HEAD, account_id: student.account_id,
    family_account_id: familyAccountId(student.account_id, links), is_student: true }))
  const groups = groupContactFamilies(rows)
  assert.equal(groups.length, 3)
  assert.equal(groups.flatMap(group => group.members).length, 4)
  assert.equal(JSON.stringify({ students, memberships }), original)

  h.setScenario({ fixtures: { students: [{ id: 'Trik', tenant_id: HEAD, account_id: 'Rob' }, { id: 'foreign', tenant_id: DEMO, account_id: 'Foreign' }],
    student_accounts: [{ student_id: 'Trik', account_id: 'Alexandra', 'accounts.tenant_id': HEAD, accounts: { tenant_id: HEAD } },
      { student_id: 'Trik', account_id: 'Foreign', 'accounts.tenant_id': DEMO, accounts: { tenant_id: DEMO } }],
  }, errors: { family_account_links: { code: '42P01' } } })
  const directory = await h.load('lib/family-account-server.ts').readDisplayFamilyAccountLinks(HEAD)
  assert.equal(directory.supported, false)
  assert.equal(directory.links.length, 1)
  assert.equal(directory.links[0].member_account_id, 'Alexandra')
  assert.equal(h.getWrites().length, 0)
})

test('display grouping does not reassign account reminder ownership', async () => {
  const h = createHarness()
  h.setScenario({ fixtures: { account_follow_ups: [
    { id: 'rob-note', tenant_id: HEAD, account_id: 'Rob', status: 'open', message: 'Rob reminder', due_at: '2026-12-01' },
    { id: 'alex-note', tenant_id: HEAD, account_id: 'Alexandra', status: 'open', message: 'Alex reminder', due_at: '2026-12-02' },
  ] } })
  const rows = await h.load('lib/contact-follow-ups-server.ts').attachContactFollowUps(HEAD, [
    { id: 'alex', account_id: 'Alexandra', family_account_id: 'Rob', reminder_account_id: 'Alexandra' },
  ], false)
  assert.equal(rows[0].follow_up_note, 'Alex reminder')
})

test('second holders saved as accounts survive the actual Contacts reader and are display-only', async () => {
  const h = createHarness(), tenant = HEAD
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: tenant } }, fixtures: {
    people: [{ id: 'trik', tenant_id: tenant, first_name: 'Trik', last_name: 'Aguilar', students: [{ id: 'trik-role',
      account_id: 'rob', accounts: { name: 'Rob Aguilar', email: 'rob@example.invalid' }, enrollments: [] }] }],
    students: [{ id: 'trik-role', tenant_id: tenant, account_id: 'rob' }],
    accounts: [{ id: 'rob', tenant_id: tenant, name: 'Rob Aguilar' }],
    student_accounts: [{ student_id: 'trik-role', account_id: 'alex', relationship: 'Parent / guardian', is_primary: true,
      'accounts.tenant_id': tenant, accounts: { id: 'alex', tenant_id: tenant, name: 'Alexandra Laustsen', email: 'alex@example.invalid', phone: '2025550101' } }],
  }, errors: { family_account_links: { code: '42P01' } } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${tenant}`))
  assert.equal(response.status, 200)
  const rows = await response.json(), before = JSON.stringify(rows)
  const holders = h.load('lib/family-account.ts').displayAccountHolders(rows)
  assert.equal(holders.length, 2)
  const alex = holders.find(holder => holder.name === 'Alexandra Laustsen')
  assert.equal(alex.account_id, 'alex')
  assert.equal(alex.person_id, undefined)
  assert.equal(alex.email, 'alex@example.invalid')
  assert.equal(JSON.stringify(rows), before)
  assert.equal(h.load('lib/family-account.ts').displayAccountHolders([...rows, ...rows]).length, 2, 'Siblings/repeated members do not duplicate holder summaries')
  assert.equal(h.getWrites().length, 0)
})