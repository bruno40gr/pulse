/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic database; no real writes or sends. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup({ signoff = null, error = null, role = 'staff', permissions = [], auth = true, connected = true } = {}) {
  const harness = createHarness()
  harness.setScenario({
    authUser: auth ? { id: 'auth' } : null,
    fixtures: {
      gmail_connections: connected ? [{ id: 'connection', tenant_id: HEAD }] : [],
      tenant_memberships: [
        { id: 'mine', tenant_id: HEAD, person_id: 'person', auth_user_id: 'auth', role_id: 'role', status: 'active', email_signoff: signoff },
        { id: 'other', tenant_id: HEAD, person_id: 'other-person', auth_user_id: 'other-auth', role_id: 'role', status: 'active', email_signoff: { name: 'Other person', role: 'Director' } },
      ],
      people: [{ id: 'person', first_name: 'Alex', last_name: 'Smith' }],
      roles: [{ id: 'role', tenant_id: HEAD, key: role }],
      role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })),
      permissions: permissions.map((key, i) => ({ id: String(i), key })),
      tenant_settings: [{ tenant_id: HEAD, email_signature: { name: 'Shared Office', title: 'Shared Title', phone: '123' } }],
    },
    errors: error ? { tenant_memberships: error } : {},
  })
  return { harness, route: harness.load('app/api/account/email-signoff/route.ts') }
}
const request = (body, tenant = HEAD) => new Request(`http://synthetic.invalid/api/account/email-signoff?tenant=${tenant}`, body === undefined ? {} : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('prefills the signed-in member profile name, not the shared workspace signature', async () => {
  const { route } = setup()
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { name: 'Alex Smith', role: '', logoUrl: '', phone: '', storageAvailable: true, connected: true })
})

test('signature settings stay hidden until a tenant mailbox is connected', async () => {
  const { route, harness } = setup({ connected: false })
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { connected: false })
  assert.equal(harness.getQueries().some(query => query.table === 'people'), false)
  const connectionQuery = harness.getQueries().find(query => query.table === 'gmail_connections')
  assert.ok(connectionQuery.filters.some(([op, key, value]) => op === 'eq' && key === 'tenant_id' && value === HEAD))
})

test('loads saved personal name and role and preserves intentionally empty sign-offs', async () => {
  for (const signoff of [{ name: 'Alex', role: 'Teacher' }, { name: '', role: '' }]) {
    const { route } = setup({ signoff })
    assert.deepEqual(await (await route.GET(request())).json(), { ...signoff, logoUrl: '', phone: '', storageAvailable: true, connected: true })
  }
})

test('staff can save only their own tenant membership without settings-management permission', async () => {
  const { route, harness } = setup()
  const response = await route.PUT(request({ name: ' Alex ', role: ' Teacher ', membershipId: 'other', tenantId: DEMO }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { name: 'Alex', role: 'Teacher' })
  const writes = harness.getWrites()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].table, 'tenant_memberships')
  assert.ok(writes[0].filters.some(([op, key, value]) => op === 'eq' && key === 'tenant_id' && value === HEAD))
  assert.ok(writes[0].filters.some(([op, key, value]) => op === 'eq' && key === 'id' && value === 'mine'))
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].payload)), { email_signoff: { name: 'Alex', role: 'Teacher' } })
})

test('rejects unauthenticated requests and cross-tenant reads and writes', async () => {
  const unauthenticated = setup({ auth: false })
  assert.notEqual((await unauthenticated.route.GET(request())).status, 200)
  assert.notEqual((await unauthenticated.route.PUT(request({ name: 'Alex', role: '' }))).status, 200)
  const { route, harness } = setup()
  assert.notEqual((await route.GET(request(undefined, DEMO))).status, 200)
  assert.notEqual((await route.PUT(request({ name: 'Alex', role: '' }, DEMO))).status, 200)
  assert.equal(harness.getWrites().length, 0)
})

test('validates personal fields before writing', async () => {
  const { route, harness } = setup()
  for (const body of [null, {}, { name: 'Alex', role: 4 }, { name: 'x'.repeat(201), role: '' }, { name: '', role: 'x'.repeat(201) }]) {
    assert.equal((await route.PUT(request(body))).status, 400)
  }
  assert.equal(harness.getWrites().length, 0)
})

test('composer signature uses personal name and role rather than shared settings', async () => {
  const { harness } = setup({ signoff: { name: 'Alex', role: 'Teacher' }, permissions: ['communications.read'] })
  const route = harness.load('app/api/conversations/signature/route.ts')
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.personal, true)
  assert.equal(data.name, 'Alex')
  assert.equal(data.title, 'Teacher')
  const { conversationSignatureHtml } = harness.load('lib/conversation-signature.ts')
  const html = conversationSignatureHtml(data, 'Shared Office')
  assert.equal(html, '<p><strong>Alex</strong><br>Teacher</p>')
})

test('personal signature escapes HTML and respects blank names without a fallback or duplicate company signature', () => {
  const { harness } = setup()
  const { conversationSignatureHtml } = harness.load('lib/conversation-signature.ts')
  assert.equal(conversationSignatureHtml({ personal: true, name: '', title: 'Teacher' }, 'Shared Office'), '<p>Teacher</p>')
  assert.equal(conversationSignatureHtml({ personal: true, name: '<Alex>', title: 'Music & arts' }, 'Shared Office'), '<p><strong>&lt;Alex&gt;</strong><br>Music &amp; arts</p>')
})

test('missing personal storage permits profile defaults but never claims signatures can be saved', async () => {
  const { harness } = setup({ error: { code: '42703' } })
  const { personalEmailSignoff } = harness.load('lib/personal-email-signoff.ts')
  const signoff = await personalEmailSignoff(HEAD, 'mine', 'person')
  assert.equal(signoff.name, 'Alex Smith')
  assert.equal(signoff.storageAvailable, false)
})

test('unified signature saves all four fields on the signed-in membership and renders them in order', async () => {
  const fields = { name: 'Alex', role: 'Teacher', logoUrl: 'https://assets.example.com/logo.png', phone: '0123456789' }
  const { route, harness } = setup()
  const response = await route.PUT(request(fields))
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.phone, '012-3456789')
  const write = harness.getWrites()[0]
  assert.equal(write.table, 'tenant_memberships')
  assert.ok(write.filters.some(([, key, value]) => key === 'id' && value === 'mine'))
  const read = setup({ signoff: saved, permissions: ['communications.read'] })
  const loaded = await (await read.route.GET(request())).json()
  for (const key of Object.keys(saved)) assert.equal(loaded[key], saved[key])
  const composer = await (await read.harness.load('app/api/conversations/signature/route.ts').GET(request())).json()
  const html = read.harness.load('lib/conversation-signature.ts').conversationSignatureHtml(composer, 'Shared Office')
  assert.match(html, /Alex.*Teacher.*<img.*012-3456789/)
  assert.ok(!html.includes('Shared Office'))
})

test('unified signature rejects unsafe logos and invalid phone numbers without writes', async () => {
  const { route, harness } = setup()
  for (const extra of [{ logoUrl: 'javascript:alert(1)' }, { logoUrl: 'http://example.com/a.png' }, { logoUrl: 'https://user:pass@example.com/a.png' }, { phone: '123' }, { phone: '012-34567890' }, { phone: 1234567890 }]) {
    assert.equal((await route.PUT(request({ name: 'Alex', role: '', ...extra }))).status, 400)
  }
  assert.equal(harness.getWrites().length, 0)
  const { formatSignaturePhone } = harness.load('lib/email-signature-fields.ts')
  assert.equal(formatSignaturePhone('0123456789'), '012-3456789')
  assert.equal(formatSignaturePhone('012-3456789'), '012-3456789')
  assert.equal(formatSignaturePhone(''), '')
})