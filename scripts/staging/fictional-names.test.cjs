/* eslint-disable @typescript-eslint/no-require-imports -- Node standalone fixture tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fictionalName, transformNames } = require('./fictional-names.cjs')

test('record IDs produce readable, deterministic names rather than long-name fixtures', () => {
  const id = '10000000-0000-0000-0000-000000000010'
  assert.equal(fictionalName(id), fictionalName(id))
  assert.ok(fictionalName(id).length < 30)
})

test('long-name fixtures retain layout pressure and missing values stay missing', () => {
  assert.ok(fictionalName('X'.repeat(80)).length >= 80)
  assert.equal(fictionalName(null), null)
  assert.equal(fictionalName(''), '')
})

test('nested student and parent names change without changing record links', () => {
  const value = { contact_id: 'same-id', payload: { student_name: 'XXXX', parent_name: 'XXXXX' } }
  const result = transformNames(value)
  assert.equal(result.contact_id, 'same-id')
  assert.notEqual(result.payload.student_name, 'XXXX')
  assert.notEqual(result.payload.parent_name, 'XXXXX')
})