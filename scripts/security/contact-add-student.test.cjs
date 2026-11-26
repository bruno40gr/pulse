/* eslint-disable @typescript-eslint/no-require-imports -- Offline contact UI and API regressions. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const source = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')

test('family members exposes add student outside the contact editor without a dependent count', () => {
  const panel = source('components/contacts/LiveContactPanel.tsx')
  assert.match(panel, /title="Family members" actions=\{showsAccount && capabilities\.edit && !addingStudent[\s\S]*?setAddingStudent\(true\)\}>Add student/)
  assert.doesNotMatch(panel, /label="Dependents"|title="Account holders"/)
  assert.match(panel, /showsAccount && capabilities\.edit && addingStudent && <LiveFamilyManagement[\s\S]*?addStudentOnly[\s\S]*?setAddingStudent\(false\); onFamilyChanged\?\.\(\)/)
  assert.match(source('components/contacts/LiveFamilyManagement.tsx'), /if \(addStudentOnly\) return dialog/)
})

test('family students use shared row names and removal menus, not section headings', () => {
  assert.match(source('components/contacts/LiveContactPanel.tsx'), /title=\{showsAccount \? <SectionTitle as="h2"><ControlButton kind="name" style=\{\{ fontSize: 'inherit', fontWeight: 'inherit' \}\}/)
  const family = source('beta-source/app/content-studio-prototype/students/ParentFamilyGroup.tsx')
  assert.match(family, /<PersonName>\{previewStudentName\(student\)\}/)
  assert.doesNotMatch(family, /<SectionTitle as="h2">\{previewStudentName\(student\)\}/)
  assert.match(family, /<OverflowMenu label=\{`Actions for/)
  assert.match(family, /label: 'Remove from family group'/)
  assert.match(family, /disabled=\{canRemove \? !canRemove\(student.id\) : false\}/)
})

test('family additions use the same modal frame as existing-band additions', () => {
  const live = source('components/contacts/LiveFamilyManagement.tsx')
  assert.match(live, /<Modal isOpen=\{!!task\} layout="fixed" size="lg"/)
  assert.match(live, /<ModalHeader title=\{title\}/)
  assert.match(live, /<ModalBody>/)
  assert.match(live, /<ModalFooter>/)
  assert.match(live, /addStudentAction=\{<Button/)
  assert.doesNotMatch(live, /family-inline-task/)
  assert.match(live, /<DenseSectionPanel>[\s\S]*?<ParentFamilyGroup[\s\S]*?<\/DenseSectionPanel>/)
  assert.doesNotMatch(live, /· Account contact/)
})

test('editing replaces the profile chrome with header-owned save and cancel', () => {
  const panel = source('components/contacts/LiveContactPanel.tsx')
  assert.match(panel, /closeOnBackdrop=\{!editing\} closeOnEscape=\{!editing\}/)
  assert.match(panel, /title=\{editing \? 'Edit Contact'/)
  assert.match(panel, /actions=\{editing \? /)
  assert.match(panel, /!editing && <><ProfileEntryActions><AccountProfileToolbar/)
  assert.match(panel, /<AccountEditorCanvas embedded formId=\{editorFormId\}/)
})

test('adding the first student uses the chosen account without an existing dependent', async () => {
  const h = createHarness()
  const accountId = '00000000-0000-0000-0000-000000000081'
  const membershipId = '00000000-0000-0000-0000-000000000082'
  h.setScenario({ actor: { personId: 'staff', displayName: 'Staff' }, fixtures: {
    people: [{ id: 'staff', tenant_id: HEAD }],
    tenant_memberships: [{ id: membershipId, tenant_id: HEAD, person_id: 'staff', role_id: 'role', legacy_access_enabled: true, status: 'unclaimed' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'staff' }],
    permissions: [{ id: 'manage', key: 'contacts.manage' }],
    role_permissions: [{ role_id: 'role', permission_id: 'manage' }],
  }, rpcResults: { change_contact_family: { saved: true } } })
  const route = h.load('app/api/contacts/family/route.ts')
  const response = await route.POST(new Request(`http://localhost/api/contacts/family?tenant=${HEAD}`, {
    method: 'POST', body: JSON.stringify({ kind: 'child', accountId, operationId: accountId, relationship: 'Child', firstName: 'New', lastName: 'Student', email: '', phone: '', birthday: '' }),
  }))
  assert.equal(response.status, 200)
  const write = h.getWrites().find(row => row.table === 'change_contact_family')
  assert.equal(write.payload.p_tenant, HEAD)
  assert.equal(write.payload.p_change.account_id, accountId)
  assert.equal(write.payload.p_change.person_id, null)
  assert.equal(write.payload.p_change.fields.first_name, 'New')
})