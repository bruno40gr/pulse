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
  assert.match(wizard, /<EnrollmentLayout title="Create band"/)
  assert.match(wizard, /const STEPS = \['Band details', 'Review'\] as const/)
  assert.match(wizard, /<RadioOptionGroup label="Group type"/)
  assert.match(wizard, /label="Band name" required/)
  assert.match(wizard, /<BandStudentPicker/)
  assert.doesNotMatch(wizard, /<Modal|Add external student/)
  assert.match(wizard, /filter\(\(person: \{ is_student\?: boolean \}\) => person\.is_student === true\)/)
})

test('creating a band writes the profile and each candidate as a prospect', () => {
  const wizard = source('components/bands/CreateBandWizard.tsx')
  assert.match(wizard, /method: 'PATCH'[\s\S]{0,200}status: 'active'/)
  assert.match(wizard, /method: 'POST'[\s\S]{0,200}membership: 'prospect'/)
  assert.match(wizard, /onCreated\(bandName\)/)
  // A creation path must never invent a second surface for member records.
  assert.doesNotMatch(wizard, /supabase|band_memberships/)
})

test('the wizard uses shared layout and spacing tokens', () => {
  const wizard = source('components/bands/CreateBandWizard.tsx')
  assert.match(wizard, /from '@\/lib\/tokens'/)
  assert.doesNotMatch(wizard, /padding:\s*\d+px|marginBottom:\s*\d+px/)
  assert.match(source('app/api/bands/route.ts'), /Drafts and newly created bands both stay visible/)
})
