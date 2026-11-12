/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const load = () => createHarness().load('lib/work-area-navigation.ts')

test('Beta access is restricted to owner and admin roles', () => {
  const { canAccessBeta } = load()
  for (const roleKey of ['owner', 'admin']) assert.equal(canAccessBeta({ roleKey }), true)
  for (const roleKey of [undefined, '', 'staff', 'assistant', 'tester']) assert.equal(canAccessBeta({ roleKey, canAccessDesignSystem: true }), false)
})

test('area routing separates website, staff, funding, settings and operations', () => {
  const { workAreaForPath } = load()
  for (const [path, expected] of [['/dashboard', 'operations'], ['/dashboard/leads/123', 'operations'], ['/dashboard/website-content/articles', 'website'], ['/dashboard/community', 'website'], ['/dashboard/staff', 'school'], ['/dashboard/funding/programs/123', 'funding'], ['/dashboard/settings/brand', 'settings']]) assert.equal(workAreaForPath(path), expected)
})

test('website and settings links retain existing access gates', () => {
  const { workAreasForAccess, settingsLinks } = load()
  const staff = workAreasForAccess({}).find(area => area.id === 'website')
  assert.equal(staff.links.length, 1)
  assert.equal(staff.links[0].href, '/dashboard/community')
  const admin = workAreasForAccess({ canAccessDesignSystem: true }).find(area => area.id === 'website')
  assert.equal(admin.links.length, 6)
  assert.equal(settingsLinks({}).length, 1)
  assert.equal(settingsLinks({ canManageRoles: true }).length, 3)
  assert.equal(settingsLinks({ canManageRoles: true, canManageIntegrations: true, canManageBrand: true }).length, 5)
})

test('remembered links never point to another area, a foreign URL, or a forbidden page', () => {
  const { rememberedAreaHref, workAreasForAccess } = load()
  const website = workAreasForAccess({}).find(area => area.id === 'website')
  for (const saved of [null, 'https://evil.example', '/dashboard/leads', '/dashboard/website-content/articles']) assert.equal(rememberedAreaHref(website, saved), '/dashboard/community')
})

test('overview roots do not highlight alongside their filtered child views', () => {
  const { activeNavigationLink } = load()
  assert.equal(activeNavigationLink('/dashboard', '/dashboard/notes'), false)
  assert.equal(activeNavigationLink('/dashboard/settings', '/dashboard/settings/brand'), false)
  assert.equal(activeNavigationLink('/dashboard/website-content', '/dashboard/website-content/articles'), false)
  assert.equal(activeNavigationLink('/dashboard/website-content/articles', '/dashboard/website-content/articles'), true)
})