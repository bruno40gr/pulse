/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const source = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')

test('contact fields stay neutral until Save and clear errors when corrected', () => {
  const { leadContactErrors, isLeadEmailValid } = createHarness().load('lib/lead-contact-validation.ts')
  const empty = { fullName: '', email: '', phone: '5551234567' }
  assert.equal(Object.values(leadContactErrors(empty, false)).some(Boolean), false)
  assert.ok(leadContactErrors(empty, true).fullName)
  assert.ok(leadContactErrors(empty, true).email)
  assert.ok(leadContactErrors({ ...empty, email: 'not-an-email' }, true).email)
  assert.equal(Object.values(leadContactErrors({ fullName: ' Alex ', email: ' alex@example.invalid ', phone: '' }, true)).some(Boolean), false)
  for (const email of ['a', 'a@b', 'a b@example.invalid', 'a@@example.invalid']) assert.equal(isLeadEmailValid(email), false)
})

const sample = { intake_type: 'lesson_inquiry', source_form: 'manual-phone-call', source_system: 'pulse-manual', full_name: 'Synthetic Contact', phone: '5551234567' }
const request = body => new Request('https://synthetic.invalid/api/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
function setup() {
  const h = createHarness()
  h.setScenario({ env: { ODEON_CRM_CALLBACK_MODE: 'capture' }, rpcResults: { odeon_crm_capture: 'synthetic-receipt' } })
  return { h, POST: h.load('app/api/intake/route.ts').POST }
}

test('manual intake rejects missing name, missing email and malformed email before any database access', async () => {
  for (const body of [sample, { ...sample, email: 'invalid' }, { ...sample, email: 'a@example.invalid', full_name: ' ' }]) {
    const { h, POST } = setup()
    assert.equal((await POST(request(body))).status, 400)
    assert.equal(h.getQueries().length, 0)
  }
})

test('manual intake accepts valid email without phone and preserves normalization and durable queue response', async () => {
  const { h, POST } = setup()
  const response = await POST(request({ ...sample, email: ' A@EXAMPLE.INVALID ', phone: null }))
  assert.equal(response.status, 202)
  assert.equal((await response.json()).queued, true)
  assert.equal(h.getWrites()[0].payload.p_payload.email, 'a@example.invalid')
})

test('public website phone-only intake remains supported', async () => {
  const { h, POST } = setup()
  assert.equal((await POST(request({ ...sample, source_system: 'headliner-website', source_form: 'website-form' }))).status, 202)
  assert.equal(h.getWrites()[0].payload.p_payload.phone, sample.phone)
})

test('release Add lead keeps submission available, guards network requests and focuses the error summary', () => {
  const view = source('components/leads/LeadsView.tsx')
  const handler = view.slice(view.indexOf('const handleCreateLead'), view.indexOf('const handleInlineStatusChange'))
  assert.ok(handler.indexOf('leadContactErrors(manualLeadForm, true)') < handler.indexOf('await fetchJsonWithTimeout'))
  assert.match(handler, /if \(manualLeadSaving \|\| manualLeadQueued\) return/)
  assert.match(view, /manualLeadErrorRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(view, /manualLeadErrorRef\.current\?\.scrollIntoView/)
  assert.match(view, /ref=\{manualLeadErrorRef\} tabIndex=\{-1\} role="alert"/)
  const add = view.slice(view.indexOf('title="Add lead"'), view.indexOf('isOpen={isDeleteOpen}'))
  assert.match(add, /disabled=\{manualLeadSaving \|\| manualLeadQueued\}/)
  assert.doesNotMatch(add, /error=\{!manualLeadForm|disabled=\{[^}]*!manualLeadForm/)
  assert.match(add, /validationSubmitted=\{manualLeadSubmitted\} variant="add"/)
  assert.match(view.slice(view.indexOf('const openAddLead'), view.indexOf('const updateManualLeadField')), /setManualLeadSubmitted\(false\)/)
})

test('shared layouts retain release student contract, confirmation and preference controls', () => {
  const editor = source('components/leads/LeadStudentsEditor.tsx')
  assert.match(editor, /students: LeadStudent\[\]/)
  for (const behavior of ['canUseContactAsStudent', 'setConfirmStudent(index)', 'same_availability', 'student.preferences', 'Use lead details']) assert.ok(editor.includes(behavior))
  assert.match(editor, /variant === 'add' \? 0 : `1px solid/)
  assert.match(editor, /<FieldGrid columns=\{1\}>/)
  assert.doesNotMatch(editor, /repeat\(auto-fit/)
  const panel = source('components/leads/LeadDetailPanel.tsx')
  assert.match(panel, /<SlidePanelActionBar isMobile=\{isMobile\}>/)
  assert.match(panel, /if \(renderEditor\) return renderEditor\(renderHeader\)/)
  assert.match(panel, /SectionTitle variant="card"/)
  assert.match(panel, /const notesRailStyle:.*gap: spacing.lg/)
  assert.doesNotMatch(panel, /paddingRight: spacing.xs/)
})