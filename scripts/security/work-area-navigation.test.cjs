/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const load = () => createHarness().load('lib/work-area-navigation.ts')

test('live sidebar removes Jump to search and its shortcut without removing area navigation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../components/layout/WorkAreaNavigation.tsx'), 'utf8')
  const css = fs.readFileSync(path.join(__dirname, '../../components/layout/WorkAreaNavigation.module.css'), 'utf8')
  assert.doesNotMatch(source, /Jump to|searchOpen|setSearchOpen|searchResults|Search all work areas|event\.key\.toLowerCase\(\) === 'k'|<Modal/)
  assert.doesNotMatch(source, /styles\.label|>Work area</)
  assert.doesNotMatch(css, /\.label\s*\{/)
  assert.match(source, /aria-expanded=\{open\} aria-controls="work-area-options"/)
  assert.match(source, /aria-label="Choose a work area"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /rememberedAreaHref/)
})

test('Beta access is restricted to owner and admin roles', () => {
  const { canAccessBeta } = load()
  for (const roleKey of ['owner', 'admin']) assert.equal(canAccessBeta({ roleKey }), true)
  for (const roleKey of [undefined, '', 'staff', 'assistant', 'tester']) assert.equal(canAccessBeta({ roleKey, canAccessDesignSystem: true }), false)
})

test('area routing separates website, staff, funding, settings and operations', () => {
  const { workAreaForPath } = load()
  for (const [path, expected] of [['/dashboard', 'operations'], ['/dashboard/leads/123', 'operations'], ['/dashboard/website-content/articles', 'website'], ['/dashboard/community', 'website'], ['/dashboard/staff', 'operations'], ['/dashboard/funding/programs/123', 'funding'], ['/dashboard/settings/brand', 'settings']]) assert.equal(workAreaForPath(path), expected)
})
test('the yellow BETA button is always reachable and the sidebar never assumes an area', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../components/layout/WorkAreaNavigation.tsx'), 'utf8')
  // A Beta path for a viewer without the Beta area used to throw on `area!.links` and blank the page.
  assert.doesNotMatch(source, /area!\.links/, 'Navigation must not assume the current area is authorized')
  assert.match(source, /area\?\.links \?\? \[\]/)
  assert.match(source, /icons\[areaId as keyof typeof icons\] \?\? icons\.operations/)
  assert.match(source, /aria-label="BETA academy preview"/, 'The yellow preview button stays in the sidebar footer')
  assert.doesNotMatch(source, /canAccessBeta\(access\) && <Link href="\/odeon-demo/, 'The preview button is not hidden from staff accounts')
})



test('Beta screens live in their own area and never in Operations', () => {
  const { workAreasForAccess, workAreaForPath } = load()
  const areas = workAreasForAccess({ roleKey: 'owner' })
  assert.equal(areas.some(area => area.id === 'school' || area.label === 'School Setup'), false)
  const operations = areas.find(area => area.id === 'operations')
  assert.equal(operations.links.some(link => link.href.startsWith('/odeon-demo')), false, 'Operations means the real school and real data')
  assert.ok(operations.links.some(link => link.href === '/dashboard/staff'))
  const beta = areas.find(area => area.id === 'beta')
  assert.equal(beta.label, 'Beta')
  assert.equal(beta.links.map(link => link.label).join(' > '), 'Teacher day > Calendar')
  assert.equal(workAreaForPath('/odeon-demo'), 'beta')
  assert.equal(workAreaForPath('/beta'), 'beta')
  assert.equal(workAreasForAccess({ roleKey: 'staff' }).some(area => area.id === 'beta'), false)
  assert.equal(workAreasForAccess({ roleKey: 'staff' }).flatMap(area => area.links).some(link => link.href.startsWith('/odeon-demo?')), false)
})

test('school onboarding is a parallel workspace with a standalone destination', () => {
  const { workAreaForPath, workAreasForAccess, rememberedAreaHref } = load()
  assert.equal(workAreaForPath('/odeon-demo/school-setup'), 'onboarding')
  assert.equal(workAreaForPath('/school-setup'), 'onboarding')
  const onboarding = workAreasForAccess({}).find(area => area.id === 'onboarding')
  assert.equal(onboarding.label, 'School onboarding')
  assert.equal(rememberedAreaHref(onboarding, null), '/odeon-demo/school-setup')
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