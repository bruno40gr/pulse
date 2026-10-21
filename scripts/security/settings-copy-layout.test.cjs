/* eslint-disable @typescript-eslint/no-require-imports -- Offline settings copy and layout contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')

test('settings descriptions use available width and access tabs follow all other settings', () => {
  const settings = read('app/dashboard/settings/page.tsx')
  const description = settings.slice(settings.indexOf('const sectionSubS:'), settings.indexOf('const tabs:'))
  assert.doesNotMatch(description, /maxWidth/)
  const tabs = settings.slice(settings.indexOf('const tabs:'), settings.indexOf('return ('))
  assert.ok(tabs.indexOf("key: 'roles'") > tabs.indexOf("key: 'brand'"))
  assert.ok(tabs.indexOf("key: 'permissions'") > tabs.indexOf("key: 'roles'"))
  assert.doesNotMatch(settings, /\bPulse\b/)
})

test('visible errors, prototype title and design copy do not expose internal product branding', () => {
  for (const file of ['components/demo/GatePage.tsx', 'app/api/pulse-settings/route.ts', 'app/content-studio-prototype/page.tsx', 'app/dashboard/design/page.tsx', 'lib/access.ts']) {
    assert.doesNotMatch(read(file), /['"`][^'"`\n]*\bPulse\b[^'"`\n]*['"`]/, file)
  }
})