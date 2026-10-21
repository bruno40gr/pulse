/* eslint-disable @typescript-eslint/no-require-imports -- Isolated OAuth callback; no Google or database access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')

const read = 'https://www.googleapis.com/auth/gmail.readonly'
const send = 'https://www.googleapis.com/auth/gmail.send'
function setup(scope, { failAt, refresh = 'refresh', busy = false } = {}) {
  const writes = []
  let profileCalls = 0
  const loaded = { exports: {} }
  const dependencies = {
    'next/server': { NextResponse: { redirect: url => ({ url: String(url), cookies: { set() {} } }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => ({ ok: true, context: { membershipId: 'member', roleKey: 'owner' } }) },
    '@/lib/permissions': { PERMISSIONS: {} },
    '@/lib/gmail/security': { decryptToken: () => JSON.stringify({ state: 'state', tenantId: 'tenant', membershipId: 'member', verifier: 'verifier', expiresAt: Date.now() + 60000 }), encryptToken: () => 'encrypted', gmailRedirectUri: () => 'http://synthetic.invalid/callback', secretMatches: (a, b) => a === b },
    '@/lib/gmail/google': { googleToken: async () => { if (failAt === 'token') throw new Error('private provider details'); return { access_token: 'access', refresh_token: refresh, scope } }, gmailGet: async () => { profileCalls++; if (failAt === 'profile') throw new Error('private profile error'); return { emailAddress: 'office@example.com' } } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from() {
      const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: busy ? { lease_until: new Date(Date.now() + 60000).toISOString() } : null, error: null }), upsert: async body => { if (failAt === 'storage') return { error: new Error('private database error') }; writes.push(body); return { error: null } } }
      return query
    } } },
  }
  const source = fs.readFileSync(path.resolve(__dirname, '../../app/api/gmail/callback/route.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Date, Request, URL, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  const url = 'http://synthetic.invalid/api/gmail/callback?state=state&code=code'
  const request = { url, nextUrl: new URL(url), headers: {}, cookies: { get: () => ({ value: 'cookie' }) } }
  return { run: () => loaded.exports.GET(request), writes, profileCalls: () => profileCalls }
}

test('Google callback rejects partial or absent read/send grants before accessing mail or storing a connection', async () => {
  for (const scope of [undefined, '', read, send]) {
    const harness = setup(scope)
    const destination = new URL((await harness.run()).url)
    assert.equal(destination.searchParams.get('gmail'), 'error')
    assert.equal(destination.searchParams.get('tab'), 'account')
    assert.equal(destination.searchParams.get('gmail_error'), 'permissions')
    assert.equal(harness.writes.length, 0)
    assert.equal(harness.profileCalls(), 0)
  }
})

test('callback reports safe failure stages instead of blaming every failure on consent', async () => {
  for (const stage of ['token', 'profile', 'storage', 'offline_access', 'busy']) {
    const harness = setup(`${read} ${send}`, { failAt: stage, ...(stage === 'offline_access' ? { refresh: null } : {}), busy: stage === 'busy' })
    const destination = new URL((await harness.run()).url)
    assert.equal(destination.searchParams.get('gmail'), 'error')
    assert.equal(destination.searchParams.get('gmail_error'), stage)
    assert.ok(!destination.toString().includes('private'))
    assert.equal(harness.writes.length, 0)
  }
})

test('one Google consent granting read and send records a successful connection', async () => {
  const harness = setup(`${read} ${send}`)
  const destination = new URL((await harness.run()).url)
  assert.equal(destination.searchParams.get('gmail'), 'connected')
  assert.equal(destination.searchParams.get('tab'), 'account')
  assert.equal(harness.writes.length, 1)
  assert.deepEqual(Array.from(harness.writes[0].scopes), [read, send])
})