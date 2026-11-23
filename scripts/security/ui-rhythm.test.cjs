/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS regression runner. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const source = path => readFileSync(resolve(__dirname, '../..', path), 'utf8')

test('new contact fields have a separated H2 section', () => {
  const picker = source('components/contacts/ParticipantPicker.tsx')
  assert.match(picker, /paddingTop: spacing\.lg/)
  assert.match(picker, /<SectionTitle as="h2">Contact details/)
})

test('shared subscription cards use H2 service titles', () => {
  const card = source('beta-source/app/content-studio-prototype/students/SubscriptionCard.tsx')
  assert.match(card, /<SectionTitle as="h2" style=/)
  assert.doesNotMatch(card, /variant="card"|as="h4"/)
  assert.match(card, /detail && <div>\{detail\}<\/div>/)
})

test('BandOS uses shared rich-table discovery and separated tabs', () => {
  const bands = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(bands, /<RichDataTable preferenceSchema=\{BAND_TABLE_SCHEMA\}/)
  assert.match(bands, /<TableSearchControl label="Search bands"/)
  assert.match(bands, /<Tabs style=\{\{ marginBottom: spacing\.lg \}\}/)
  assert.match(source('components/leads/LeadsView.tsx'), /justifyContent: matching \? 'flex-end'/)
})

test('app-wide product override removes outlines and shadow rings on focus', () => {
  assert.match(source('app/globals.css'), /\*:focus, \*:focus-visible \{\s*outline: none !important;\s*box-shadow: none !important;/)
})