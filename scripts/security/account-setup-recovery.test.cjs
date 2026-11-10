/* eslint-disable @typescript-eslint/no-require-imports -- Uses Node's built-in test runner with synthetic dependencies. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

function setup({ status = 'invited', missing = false, mismatch = false, sendError = false, secondary = false, linkedStatus = 'active' } = {}) {
  const sent = []
  const filters = []
  const admin = {
    from(table) {
      const query = {
        select() { return query }, eq() { return query }, is() { return query }, ilike() { return query }, in(key, values) { filters.push([key, values]); return query },
        not() { return query }, limit() { return query }, maybeSingle() { return Promise.resolve({ data: missing ? null : { id: 'membership', auth_user_id: 'auth', status } }) },
        then(resolve) { return Promise.resolve({ data: table === 'membership_login_links' ? (secondary ? [{ auth_user_id: 'secondary' }] : []) : missing ? [] : [{ id: 'staff' }] }).then(resolve) },
      }
      assert.ok(['people', 'tenant_memberships', 'membership_login_links'].includes(table))
      return query
    },
    auth: {
      admin: { getUserById: async () => ({ data: { user: { email: mismatch ? 'other@example.com' : 'staff@example.com' } } }) },
      resetPasswordForEmail: async (email, options) => { if (sendError) throw new Error('Provider unavailable'); sent.push({ email, ...options }); return { error: null } },
    },
  }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'app/api/account/recovery/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const loadedModule = { exports: {} }
  const context = vm.createContext({ module: loadedModule, exports: loadedModule.exports, URL, process: { env: {} }, require(id) {
    if (id === '@/lib/supabase/admin') return { supabaseAdmin: admin }
    if (id === '@/lib/membership-logins') return { findLoginMembership: async () => ({ id: 'membership', status: linkedStatus }) }
    if (id === 'next/server') return { NextResponse: { json: (data, options) => Response.json(data, options) } }
    throw new Error(`Blocked dependency ${id}`)
  } })
  new vm.Script(code).runInContext(context)
  return { sent, filters, post: email => loadedModule.exports.POST(new Request('https://pulse.example.com/api/account/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })) }
}

for (const status of ['invited', 'active']) test(`${status} account receives the correct fresh-link destination`, async () => {
  const { post, sent, filters } = setup({ status })
  const response = await post(' Staff@Example.com ')
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].email, 'staff@example.com')
  assert.equal(sent[0].redirectTo, `https://pulse.example.com/${status === 'invited' ? 'claim' : 'reset-password'}`)
  assert.equal(JSON.stringify(filters.find(([key]) => key === 'status')[1]), JSON.stringify(['invited', 'active']))
})

for (const scenario of [{ missing: true }, { mismatch: true }]) test(`recovery remains enumeration-safe: ${JSON.stringify(scenario)}`, async () => {
  const { post } = setup(scenario)
  assert.deepEqual(await (await post('staff@example.com')).json(), { ok: true })
})

test('provider failure is reported without exposing private details', async () => {
  const { post } = setup({ sendError: true })
  const response = await post('staff@example.com')
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /Provider unavailable/)
})
test('explicit secondary login gets its own recovery email', async () => {
  const { post, sent } = setup({ secondary: true })
  assert.equal((await post('staff@example.com')).status, 200)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].redirectTo, 'https://pulse.example.com/reset-password')
})
test('secondary login cannot recover suspended staff access', async () => {
  const { post, sent } = setup({ secondary: true, linkedStatus: 'suspended' })
  assert.equal((await post('staff@example.com')).status, 200)
  assert.equal(sent.length, 0)
})

test('invalid email makes no send attempt', async () => {
  const { post, sent } = setup()
  assert.deepEqual(await (await post('invalid')).json(), { ok: true })
  assert.equal(sent.length, 0)
})

test('setup uses server-verified cookies without a timed browser-session race', () => {
  const source = fs.readFileSync(path.join(root, 'app/claim/page.tsx'), 'utf8')
  assert.doesNotMatch(source, /getSession|setTimeout/)
  assert.ok(source.includes('Send me a fresh setup link'))
  assert.ok(source.includes("fetch('/api/account/claim'"))
})

test('scanner-safe confirmation is still explicit POST, and expired links offer recovery', () => {
  const page = fs.readFileSync(path.join(root, 'app/auth/confirm/page.tsx'), 'utf8')
  const route = fs.readFileSync(path.join(root, 'app/api/account/confirm/route.ts'), 'utf8')
  assert.ok(page.includes('method="post"'))
  assert.doesNotMatch(page, /verifyOtp/)
  assert.doesNotMatch(route, /export async function GET/)
  assert.ok(route.includes("const pathname = '/forgot-password'"))
})

test('lead automation boilerplate is removed but undo remains', () => {
  const source = fs.readFileSync(path.join(root, 'components/leads/LeadDetailPanel.tsx'), 'utf8')
  assert.doesNotMatch(source, /Clear outreach and booking notes|Pause automatic updates|Manual status changes pause automation/)
  assert.ok(source.includes('>Undo</Button>'))
})