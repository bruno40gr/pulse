/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const source = file => readFileSync(resolve(__dirname, '../../', file), 'utf8')

test('Create new band opens the two-step wizard instead of modals', () => {
  const workspace = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(workspace, /<Button onClick=\{\(\) => setCreating\(true\)\}/)
  assert.match(workspace, /if \(creating\) return <CreateBandWizard/)
  assert.doesNotMatch(workspace, /const createDraft = async/)

  const wizard = source('components/bands/CreateBandWizard.tsx')
  assert.match(wizard, /<WorkflowEditor initial=\{draft\}/)
  assert.match(source('beta-source/lib/academy-workflow-drafts.ts'), /\['Band details', 'Review'\]/)
  assert.match(source('beta-source/app/content-studio-prototype/event-explorer/WorkflowEditor.tsx'), /<RadioOptionGroup label="Group type"/)
  assert.match(wizard, /initialDraft\?\.state/)
  assert.match(wizard, /<BandStudentPicker/)
  assert.doesNotMatch(wizard, /<Modal|Add external student/)
  assert.match(wizard, /filter\(\(row: \{ is_student\?: boolean \}\) => row\.is_student === true\)/)
})

test('creating a band writes the profile and each candidate as a prospect', () => {
  const wizard = source('components/bands/CreateBandWizard.tsx')
  assert.match(wizard, /method: 'PUT'/)
  const sql = source('supabase/migrations/202611210003_band_creation_drafts.sql')
  assert.match(sql, /INSERT INTO band_profiles/)
  assert.match(sql, /INSERT INTO band_memberships[\s\S]{0,150}'prospect'/)
  assert.match(sql, /current_row.revision<>p_revision/)
  assert.match(wizard, /if \(!response.ok\) throw/)
  assert.match(wizard, /onCreated\(result.band\)/)
  // A creation path must never invent a second surface for member records.
  assert.doesNotMatch(wizard, /supabase|band_memberships/)
})

test('the wizard uses shared layout and spacing tokens', () => {
  const wizard = source('components/bands/CreateBandWizard.tsx')
  assert.match(wizard, /<WorkflowEditor/)
  assert.doesNotMatch(wizard, /padding:\s*\d+px|marginBottom:\s*\d+px/)
  assert.match(source('app/api/bands/route.ts'), /Drafts and newly created bands both stay visible/)
})
