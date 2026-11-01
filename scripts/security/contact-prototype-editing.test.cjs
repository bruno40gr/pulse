/* eslint-disable @typescript-eslint/no-require-imports -- Pure fictional state tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const moduleUnderTest = { exports: {} }
const source = fs.readFileSync(path.resolve(__dirname, '../../lib/contact-prototype-editing.ts'), 'utf8')
new vm.Script(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText).runInNewContext({ exports: moduleUnderTest.exports, module: moduleUnderTest })
const { applyPrototypeContactEdit: apply } = moduleUnderTest.exports
const person = (id, account, manager, extra = {}) => ({ id, tenant_id: 'fictional', first_name: id, last_name: 'Example', phone: null, email: null, account_id: account, account_holder_person_id: manager, account_holder_name: manager, account_holder_phone: null, account_holder_email: null, family_name: null, custom_fields: {}, ...extra })
const people = () => [person('sam', 'kim', 'sam'), person('sophie', 'kim', 'sam', { is_minor: true }), person('jane', 'smith', 'jane'), person('noah', 'smith', 'jane')]
const edit = (patch = {}) => ({ first_name: 'Sophie', last_name: 'Example', phone: '', email: '', account_id: 'smith', manager_id: 'jane', holders: [{ person_id: 'jane', relationship: 'sibling' }], ...patch })
test('moving one person updates nesting and explicit holders without moving siblings or changing minor flags', () => {
  const before = people(), after = apply(before, 'sophie', edit())
  assert.equal(after[1].account_id, 'smith')
  assert.equal(after[1].account_holder_name, 'jane Example')
  assert.equal(after[1].account_holders[0].relationship, 'sibling')
  assert.equal(after[1].is_minor, true)
  assert.equal(after[0].account_id, 'kim')
  assert.equal(before[1].account_id, 'kim')
})
test('standalone clears stale holder destinations and moving a manager leaves old family unresolved', () => {
  const after = apply(people(), 'sam', edit({ account_id: null, manager_id: null, holders: [] }))
  assert.equal(after[0].account_id, null)
  assert.equal(after[1].account_holder_person_id, null)
  assert.equal(after[1].account_holder_phone, null)
})
test('changing manager refreshes the whole destination family and keeps foreign tenants isolated', () => {
  const before = [...people(), person('foreign', 'smith', 'jane', { tenant_id: 'other' })]
  const after = apply(before, 'noah', edit({ manager_id: 'noah', first_name: 'Noah' }))
  assert.equal(after[2].account_holder_person_id, 'noah')
  assert.equal(after[4].account_holder_person_id, 'jane')
})
test('rejects minor managers, duplicate holders, missing people and foreign tenant holders', () => {
  assert.throws(() => apply(people(), 'sophie', edit({ manager_id: 'sophie' })), /adult account manager/)
  assert.throws(() => apply(people(), 'sophie', edit({ holders: [{ person_id: 'jane', relationship: '' }, { person_id: 'jane', relationship: '' }] })), /only once/)
  assert.throws(() => apply(people(), 'missing', edit()), /no longer/)
  assert.throws(() => apply([...people(), person('foreign', null, null, { tenant_id: 'other' })], 'sophie', edit({ holders: [{ person_id: 'foreign', relationship: '' }] })), /adult holder/)
})
test('a standalone adult can start a new family; contact edits refresh explicit holder destinations', () => {
  const before = people()
  const created = apply(before, 'sam', edit({ first_name: 'Samuel', phone: '(202) 555-0199', account_id: 'prototype:family:sam', manager_id: 'sam', holders: [] }))
  assert.equal(created[0].account_id, 'prototype:family:sam')
  assert.equal(created[0].account_holders[0].person_id, 'sam')
  assert.equal(created[1].account_holder_person_id, null)
  const renamed = apply(before, 'sam', edit({ first_name: 'Samuel', phone: '(202) 555-0199', account_id: 'kim', manager_id: 'sam', holders: [] }))
  assert.equal(renamed[1].account_holder_name, 'Samuel Example')
  assert.equal(renamed[1].account_holder_phone, '(202) 555-0199')
})