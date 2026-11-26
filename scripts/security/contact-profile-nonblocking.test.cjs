/* eslint-disable @typescript-eslint/no-require-imports -- Local render contract. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

test('shared contact profile and notes do not wait for optional funding or communication requests', () => {
  const source = readFileSync(resolve(__dirname, '../../components/contacts/LiveContactPanel.tsx'), 'utf8')
  assert.doesNotMatch(source, /ProfilePanelSkeleton|contact-insights/)
  assert.match(source, /funding.loading \? <LoadingSkeleton label="Loading funding details"/)
  assert.match(source, /visitedChannels\[channel\] &&/)
  assert.match(source, /section === 'notes' \? <DenseSectionPanel/)
})