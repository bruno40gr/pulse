/* eslint-disable @typescript-eslint/no-require-imports -- Node fixture tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateTarget, USERS } = require('./seed-users.cjs')

test('user fixture refuses production and unrelated projects', () => {
  for (const host of ['jbrntsxmibfldocsuslt', 'xxyncvaulboqytovgfrh', 'other']) {
    assert.throws(() => validateTarget({ NEXT_PUBLIC_SUPABASE_URL: `https://${host}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: 'synthetic' }))
  }
  assert.doesNotThrow(() => validateTarget({ NEXT_PUBLIC_SUPABASE_URL: 'https://xpnygavujqmzkdmcktdm.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' }))
})

test('fixtures include owner, admin, staff and read-only assistant', () => {
  assert.deepEqual(USERS.map(user => user.role), ['owner', 'admin', 'staging_staff', 'staging_assistant'])
})