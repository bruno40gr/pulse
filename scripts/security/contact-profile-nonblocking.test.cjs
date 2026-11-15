/* eslint-disable @typescript-eslint/no-require-imports -- Local render contract. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

test('optional AI highlights cannot block contact profile or notes', () => {
  const source = readFileSync(resolve(__dirname, '../../components/contacts/ContactSlidePanel.tsx'), 'utf8')
  assert.ok(!source.includes('ProfilePanelSkeleton'))
  const loading = source.indexOf('{insightsLoading ? (')
  assert.ok(loading > source.indexOf('AI highlights</SectionTitle>'))
  assert.ok(source.includes('Loading AI highlights…'))
  assert.match(source, /const request = useLeadWorkspaceRequest\(\)/)
  assert.equal((source.match(/request\('\/api\/contact-insights'/g) || []).length, 1)
  assert.doesNotMatch(source, /fetch\('\/api\/contact-insights'/)
})