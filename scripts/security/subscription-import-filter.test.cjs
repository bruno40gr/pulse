/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic CSV data. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { parseCSV } = createHarness().load('lib/csv-parser.ts')
test('subscription imports exclude ended rows and retain pending in both mapping paths', async () => {
  const csv = 'Client Name,Client Id,Primary Staff Name,Plan Name,Status\nActive Student,a,Teacher,Private Piano,Active\nPending Student,b,Teacher,Private Piano,Pending\nEnded Student,c,Teacher,Private Piano,Ended\n'
  const mappings = [['Client Name', 'full_name'], ['Client Id', 'external_id']].map(([csv_column, field_key]) => ({ csv_column, field_key }))
  for (const rows of [await parseCSV(csv), await parseCSV(csv, mappings)]) assert.deepEqual(Array.from(rows, row => row.first_name), ['Active', 'Pending'])
})
test('attendance status is not mistaken for subscription status', async () => {
  const csv = 'Client Name,Staff Name,Status\nSynthetic Student,Teacher,Ended\n'
  assert.equal((await parseCSV(csv)).length, 1)
})