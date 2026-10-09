const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD } = require('../security/synthetic-harness.cjs')
const root = path.resolve(__dirname, '../..')

test('notification Open navigates even when its destination is already mounted', () => {
  const source = fs.readFileSync(path.join(root, 'components/notifications/NotificationBell.tsx'), 'utf8')
  assert.match(source, /window\.location\.assign\(item\.link\)/)
  assert.doesNotMatch(source, /router\.push/)
  assert.match(source, /action: 'seen'/)
})

test('note links can resolve outside the active date/completion filter using authorized API', () => {
  const source = fs.readFileSync(path.join(root, 'app/dashboard/notes/page.tsx'), 'utf8')
  assert.match(source, /encodeURIComponent\(tenantId\)\}&show_done=true/)
  assert.match(source, /items\.find\(note => note\.id === noteId\)/)
  assert.match(source, /no longer have access/)
})

test('tab borders use the shared gray border regardless of selection', () => {
  const source = fs.readFileSync(path.join(root, 'components/ui/ControlButton.tsx'), 'utf8')
  const line = source.split('\n').find(line => line.includes("kind === 'tab'"))
  assert.ok(line.includes('${colors.border}'))
  assert.ok(!line.includes('colors.espresso'))
})

test('fictional staging staff use distinct existing portraits only in staging', () => {
    const staging = createHarness()
    staging.setScenario({ env: { NEXT_PUBLIC_SUPABASE_URL: 'https://xpnygavujqmzkdmcktdm.supabase.co' } })
    const { getStaffAvatarUrl } = staging.load('lib/staff-avatars.ts')
    const names = ['Morgan Reyes', 'Avery Chen', 'Jordan Patel', 'Riley Brooks', 'Jamie Bennett']
    const urls = names.map(name => getStaffAvatarUrl(HEAD, name))
    assert.ok(urls.every(url => url?.startsWith('https://res.cloudinary.com/')))
    assert.equal(new Set(urls).size, 5)
    const production = createHarness()
    production.setScenario({ env: { NEXT_PUBLIC_SUPABASE_URL: 'https://production.invalid' } })
    const productionAvatars = production.load('lib/staff-avatars.ts')
    assert.ok(names.every(name => productionAvatars.getStaffAvatarUrl(HEAD, name) === undefined))
})