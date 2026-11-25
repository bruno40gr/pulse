/* eslint-disable @typescript-eslint/no-require-imports -- Isolated presentation tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/contact-relationship.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports })
const badges = input => Array.from(mod.exports.contactRelationshipBadges(input))
const merge = input => Array.from(mod.exports.mergeRelationshipBadges(input))

test('only recorded students receive enrollment badges; missing and trial statuses are not guessed', () => {
  assert.deepEqual(badges({ is_student: true, client_status: 'active' }), ['Enrolled'])
  assert.deepEqual(badges({ is_student: true, client_status: 'inactive' }), ['Disenrolled'])
  for (const client_status of [undefined, 'trial', 'lost', 'new']) assert.deepEqual(badges({ is_student: true, client_status }), [])
  assert.deepEqual(badges({ is_student: false, client_status: 'active' }), [])
  assert.deepEqual(badges({ client_status: 'active' }), [])
})
test('tenant classification is honored without interpreting unknown statuses', () => {
  assert.deepEqual(badges({ is_student: true, client_status: 'custom', status_class: 'active' }), ['Enrolled'])
  assert.deepEqual(badges({ is_student: true, client_status: 'active', status_class: 'unknown' }), [])
})
test('explicit a la carte differs from trial and service-only clients', () => {
  assert.deepEqual(badges({ is_student: true, client_status: 'À la carte' }), ['À la carte'])
  assert.deepEqual(badges({ is_student: false, client_status: 'active', custom_fields: { contact_kind: 'booking' } }), ['Service client'])
  assert.deepEqual(badges({ is_student: true, client_status: 'active', custom_fields: { contact_kind: 'booking' } }), ['Enrolled', 'Service client'])
})
test('combined records produce at most one lesson badge plus a service badge', () => {
  assert.deepEqual(merge([['Disenrolled'], ['Enrolled', 'Service client'], ['À la carte']]), ['Enrolled', 'Service client'])
  assert.deepEqual(merge([['Disenrolled'], ['À la carte'], ['Service client']]), ['À la carte', 'Service client'])
  assert.deepEqual(badges({ relationship_badges: [], is_student: true, client_status: 'active' }), [])
})