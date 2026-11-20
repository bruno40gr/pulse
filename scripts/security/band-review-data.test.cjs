/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic spreadsheet fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')

test('tentative bands can share a student without synthesizing opportunity status', () => {
  const { assembleBandReview } = createHarness().load('lib/band-review-data.ts')
  const interest = [
    'Name,Age,Instrument,Emailed (yes/no),Placed in a band,Potential band 1,Potential band 2',
    'Alex Test,10,guitar,yes,,Sam,Bella',
    'Sam Test,11,drums,no,,,',
    'Bella Test,12,piano,,,,',
  ].join('\n')
  const result = assembleBandReview('Client Id,Client Name\n', 'Client Id,Client Name\n', interest)
  const alex = result.pool.find(row => row.name === 'Alex Test')
  assert.equal(result.proposals.filter(band => band.candidateIds.includes(alex.id)).length, 2)
  assert.equal(Object.hasOwn(alex, 'status'), false)
  assert.equal(Object.hasOwn(alex, 'emailed'), false)
  assert.equal(result.proposals[0].candidateIds.length, 2)
  assert.equal(result.proposals[1].candidateIds.length, 2)
})
test('the same potential-band column on different students does not join unrelated groups', () => {
  const { assembleBandReview } = createHarness().load('lib/band-review-data.ts')
  const result = assembleBandReview('Client Id,Client Name\n', 'Client Id,Client Name\n', 'Name,Potential band 1\nAlex Test,Sam\nSam Test,\nBella Test,Chris\nChris Test,\n')
  assert.equal(result.proposals.length, 2)
  assert.deepEqual(Array.from(result.proposals[0].candidateIds), ['candidate-0', 'candidate-1'])
  assert.deepEqual(Array.from(result.proposals[1].candidateIds), ['candidate-2', 'candidate-3'])
})