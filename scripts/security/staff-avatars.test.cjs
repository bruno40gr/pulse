/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const { getStaffAvatarUrl } = createHarness().load('lib/staff-avatars.ts')

test('confirmed staff aliases and middle names use the same photo', () => {
  assert.equal(getStaffAvatarUrl(HEAD, 'Andrew Dylan Johnson'), getStaffAvatarUrl(HEAD, 'Drew Johnson'))
  assert.equal(getStaffAvatarUrl(HEAD, 'Isaias W Pallib'), getStaffAvatarUrl(HEAD, 'Zais Pallib'))
  assert.equal(getStaffAvatarUrl(HEAD, 'Noah David Campos'), getStaffAvatarUrl(HEAD, 'Noah Campos'))
  assert.equal(getStaffAvatarUrl(HEAD, 'Jacob Rogelstad'), getStaffAvatarUrl(HEAD, 'Jake'))
})

test('legacy abbreviated authors match staff photos', () => {
  assert.equal(getStaffAvatarUrl(HEAD, 'Alyssa A.'), getStaffAvatarUrl(HEAD, 'Alyssa Abbott'))
  assert.equal(getStaffAvatarUrl(HEAD, 'Drew J.'), getStaffAvatarUrl(HEAD, 'Drew Johnson'))
})

test('unknown names, different surnames and other tenants never receive staff photos', () => {
  for (const name of [null, '', 'Unknown Person', 'Alyssa Different', 'Andrew Different']) {
    assert.equal(getStaffAvatarUrl(HEAD, name), undefined)
  }
  assert.equal(getStaffAvatarUrl(DEMO, 'Alyssa Abbott'), undefined)
})

test('all eleven website teacher photos are available to matched staff', () => {
  const names = ['Alyssa Abbott', 'Jessica Suase', 'Drew Johnson', 'Scott Gaona', 'Marshall James-Solano', 'Collin Franks', 'Josh Brent', 'Noah Campos', 'Jacob Rogelstad', 'Vitto Trinchese', 'Isaias Pallib']
  const urls = names.map(name => getStaffAvatarUrl(HEAD, name))
  assert.ok(urls.every(url => url?.startsWith('https://res.cloudinary.com/')))
  assert.equal(new Set(urls).size, 11)
})

test('identity loads in the shared provider, without navigation, focus or polling triggers', () => {
  const root = path.resolve(__dirname, '../..')
  const provider = fs.readFileSync(path.join(root, 'components/layout/IdentityProvider.tsx'), 'utf8')
  const indicator = fs.readFileSync(path.join(root, 'components/layout/SignedInUser.tsx'), 'utf8')
  assert.equal((provider.match(/fetch\(/g) || []).length, 1)
  assert.ok(provider.includes('}, [])'))
  assert.doesNotMatch(provider, /usePathname|setInterval|addEventListener/)
  assert.doesNotMatch(indicator, /fetch\(|Checking sign-in|>\s*\{identity\.fullName\}/)
  assert.ok(indicator.includes('{identity.firstName}'))
})