/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic providers; no credentials or deliveries. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, dependencies = {}, globals = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Buffer, Date, Request, URL, AbortSignal, ...globals, require(id) {
    if (id === 'node:crypto') return require(id)
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  return loaded.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const policy = load('lib/communication-recipients.ts')
const accounts = [{ name: 'Parent One', email: 'ONE@example.com', phone: '(202) 555-0101' }, { name: 'Parent Two', email: 'two@example.com', phone: '+1 202 555 0102' }]
const child = (id, patch = {}) => ({ id, first_name: 'Child', email: 'child@example.com', phone: '+12025550999', students: [{ is_minor: true, accounts: accounts[0], student_accounts: accounts.map(account => ({ accounts: account })) }], ...patch })
test('missing account-holder schema blocks routing with an actionable setup error', async () => {
  const query = { select() { return this }, eq() { return this }, in: async () => ({ error: { code: 'PGRST200' } }) }
  const directory = load('lib/communication-recipient-directory.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: { from: () => query } },
    '@/lib/supabase/crm-admin': {},
    '@/lib/communication-recipients': policy,
  })
  await assert.rejects(directory.communicationRecipients('tenant', ['one'], 'email'), /Student Accounts Migration 001/)
})
test('missing organisation schema allows private history only, never sending', async () => {
  for (const code of ['PGRST205', '42P01', '42501']) {
    const query = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: null, error: { code } }) }
    const organisation = load('lib/organisation-email.ts', {
      '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from: () => query } },
      '@/lib/gmail/security': {}, '@/lib/gmail/google': {}, '@/lib/organisation-email-policy': {},
    })
    await assert.rejects(organisation.organisationEmailSettings('tenant'), /Migration 026/)
    await assert.rejects(organisation.organisationSenders('tenant', 'member'), /Migration 026/)
    if (code === '42501') await assert.rejects(organisation.organisationEmailSettings('tenant', { readOnly: true }), /Migration 026/)
    else assert.equal(await organisation.organisationEmailSettings('tenant', { readOnly: true }), null)
  }
})
test('private history retains connector isolation when organisation setup is absent', async () => {
  const filters = []
  const query = { select() { return this }, eq(key, value) { filters.push([key, value]); return this }, maybeSingle: async () => ({ data: { id: 'box', refresh_token_ciphertext: 'encrypted' } }) }
  const mailbox = load('lib/gmail/conversations.ts', {
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from: () => query } },
    '@/lib/organisation-email': { organisationEmailSettings: async (tenant, options) => { assert.equal(options.readOnly, true); return null } },
    './security': { decryptToken: () => 'refresh' }, './google': { googleToken: async () => ({ access_token: 'token' }) }, './rules': {},
  })
  await mailbox.conversationMailbox('tenant', 'box', 'member')
  assert.ok(filters.some(([key, value]) => key === 'connected_by' && value === 'member'))
})
test('Contacts and Conversations use the same messaging actions in their page headers', () => {
  for (const file of ['app/dashboard/contacts/page.tsx', 'components/inbox/Conversations.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.ok(source.includes('<MessageActions'), file)
    assert.ok(!source.includes('>Send new email</Button>'), file)
  }
  const actions = fs.readFileSync(path.join(root, 'components/inbox/MessageActions.tsx'), 'utf8')
  assert.equal((actions.match(/variant="primary" size="md"/g) || []).length, 2)
  assert.ok(!actions.includes('fontSize:'))
})
test('minors reach all account managers once per destination for email and SMS', () => {
  const result = policy.resolveCommunicationRecipients([child('one'), child('two')], 'email')
  assert.equal(result.recipients.length, 2)
  assert.deepEqual(plain(result.recipients.map(item => item.destination)), ['one@example.com', 'two@example.com'])
  assert.deepEqual(plain(result.recipients[0].contactIds), ['one', 'two'])
  assert.equal(result.excluded.length, 0)
  const sms = policy.resolveCommunicationRecipients([child('one'), child('two')], 'sms')
  assert.deepEqual(plain(sms.recipients.map(item => item.destination)), ['+12025550101', '+12025550102'])
})
test('missing parent details never fall back to the minor, even with student routing saved', () => {
  for (const channel of ['email', 'sms']) {
    const result = policy.resolveCommunicationRecipients([child('one', { students: [{ is_minor: true, message_routing: 'student', accounts: {} }] })], channel)
    assert.equal(result.recipients.length, 0); assert.equal(result.excluded.length, 1)
  }
})
test('adults use their own destination by default and honour saved account-holder preference', () => {
  const own = child('adult', { students: [{ is_minor: false, accounts: accounts[0] }] })
  assert.equal(policy.resolveCommunicationRecipients([own], 'email').recipients[0].destination, 'child@example.com')
  own.students[0].message_routing = 'account_holder'
  assert.equal(policy.resolveCommunicationRecipients([own], 'email').recipients[0].destination, 'one@example.com')
  own.students[0].message_routing = 'student'
  assert.equal(policy.resolveCommunicationRecipients([own], 'sms').recipients[0].destination, '+12025550999')
})
test('opt-outs suppress shared family destinations, including unselected opted-out contacts', () => {
  const result = policy.resolveCommunicationRecipients([child('one')], 'sms', [child('two', { opted_out: true })])
  assert.equal(result.recipients.length, 0)
  assert.equal(result.excluded.length, 1)
  assert.equal(policy.resolveCommunicationRecipients([child('two', { opted_out: true }), child('one')], 'email').recipients.length, 0)
})
test('invalid destinations are excluded and resolution is stable regardless of selection order', () => {
  const invalid = child('bad', { students: [{ is_minor: true, accounts: { email: 'bad\r\n@example.com', phone: '123' } }] })
  assert.equal(policy.resolveCommunicationRecipients([invalid], 'email').recipients.length, 0)
  assert.equal(policy.resolveCommunicationRecipients([invalid], 'sms').recipients.length, 0)
  assert.deepEqual(plain(policy.resolveCommunicationRecipients([child('two'), child('one')], 'email')), plain(policy.resolveCommunicationRecipients([child('one'), child('two')], 'email')))
})
const senderPolicy = load('lib/organisation-email-policy.ts')
test('Me requires both explicit member assignment and Google verification, not just a shared domain', () => {
  const settings = { connection_id: 'box', display_name: 'Music School', aliases: [
    { email: 'teacher@example.com', name: 'Teacher', membershipId: 'member' },
    { email: 'other@example.com', name: 'Other', membershipId: 'other' },
    { email: 'unverified@example.com', name: 'Pending', membershipId: 'member' },
    { email: 'external@elsewhere.com', name: 'External', membershipId: 'member' },
  ] }
  const verified = ['teacher@example.com', 'other@example.com', 'external@elsewhere.com'].map(sendAsEmail => ({ sendAsEmail, verificationStatus: 'accepted' }))
  assert.deepEqual(plain(senderPolicy.authorisedOrganisationSenders(settings, 'office@example.com', 'member', verified).map(item => [item.email, item.mine])), [['teacher@example.com', true], ['office@example.com', false]])
  assert.deepEqual(plain(senderPolicy.authorisedOrganisationSenders(settings, 'office@example.com', 'no-alias', verified).map(item => item.email)), ['office@example.com'])
  assert.throws(() => senderPolicy.authorisedOrganisationSenders(settings, 'personal@gmail.com', 'member', verified), /personal mailbox/)
})

function sendHarness({ denied = false, contactPermission = true, changed = false, providerStatus = 200, failTracking = false, senderDenied = false } = {}) {
  const records = new Map(); const deliveries = []
  const resolved = policy.resolveCommunicationRecipients([child('one'), child('two')], 'email')
  const api = load('app/api/communications/email/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => denied ? { ok: false, status: 403, error: 'Denied' } : { ok: true, tenantId: 'tenant', context: { membershipId: 'member', roleKey: 'staff', permissions: new Set(contactPermission ? ['contacts.read'] : []) } } },
    '@/lib/permissions': { PERMISSIONS: { communicationsSend: 'send', contactsRead: 'contacts.read' } },
    '@/lib/communication-recipient-directory': { validContactSelection: ids => Array.isArray(ids) && ids.length, communicationRecipients: async () => resolved, recipientVersion: () => changed ? 'changed' : 'version' },
    '@/lib/organisation-email': { organisationSender: async (_, member, email) => { if (senderDenied || email !== 'office@example.com') throw new Error('Sender not authorised'); return { token: 'synthetic', sender: { email, name: 'School' } } } },
    '@/lib/gmail/conversations': { gmailMime: input => { assert.equal(input.to.length, 1); assert.deepEqual(plain(input.cc), []); assert.deepEqual(plain(input.bcc), []); return JSON.stringify(input) } },
    '@/lib/headliner-email-templates': { unresolvedEmailPlaceholders: value => /\[STUDENT\]/.test(value) ? ['STUDENT'] : [] },
    '@/lib/account-audit': { writeAccountAuditEvent: async () => true },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from() {
      const filters = {}; let update
      const builder = {
        select() { return builder }, eq(key, value) { filters[key] = value; return builder }, order() { return builder },
        range: async (from, to) => ({ data: [...records.values()].slice(from, to + 1), error: failTracking ? { code: 'missing' } : null }),
        maybeSingle: async () => ({ data: records.get(filters.destination) || null, error: failTracking ? { code: 'missing' } : null }),
        insert: async row => { if (records.has(row.destination)) return { error: { code: '23505' } }; records.set(row.destination, { ...row }); return { error: null } },
        update(value) { update = value; return builder },
        then(resolve) { const row = records.get(filters.destination); if (row && update) Object.assign(row, update); return Promise.resolve({ error: null }).then(resolve) },
      }; return builder
    } } },
  }, { fetch: async (_, options) => { deliveries.push(JSON.parse(Buffer.from(JSON.parse(options.body).raw, 'base64url').toString())); if (providerStatus === 'timeout') throw new Error('timeout'); return { ok: providerStatus === 200, status: providerStatus, json: async () => ({ id: `provider-${deliveries.length}` }) } } })
  const input = { contactIds: ['one', 'two'], senderEmail: 'office@example.com', operationId: '12345678-1234-1234-1234-123456789012', subject: 'Schedule', body: 'Hello families', html: '<p>Hello families</p>', version: 'version' }
  return { api, records, deliveries, request: patch => new Request('https://synthetic.invalid/api/communications/email', { method: 'POST', body: JSON.stringify({ ...input, ...patch }) }) }
}
test('bulk email sends individually, matches preview count, and repeated operations do not resend', async () => {
  const h = sendHarness()
  const first = await h.api.POST(h.request())
  assert.equal(first.status, 200); assert.equal(first.body.sent, 2); assert.equal(first.body.pending, 0)
  assert.equal(h.deliveries.length, 2)
  const again = await h.api.POST(h.request())
  assert.equal(again.body.sent, 2); assert.equal(h.deliveries.length, 2)
  assert.equal((await h.api.POST(h.request({ subject: 'Changed message' }))).status, 409)
  assert.equal(h.deliveries.length, 2)
})
test('denied users, missing contact access, stale previews, unauthorised senders and placeholders do not send', async () => {
  for (const options of [{ denied: true }, { contactPermission: false }, { changed: true }, { senderDenied: true }, { failTracking: true }]) {
    const h = sendHarness(options)
    assert.ok((await h.api.POST(h.request())).status >= 400)
    assert.equal(h.deliveries.length, 0)
  }
  const h = sendHarness()
  assert.equal((await h.api.POST(h.request({ body: '[STUDENT]' }))).status, 400)
  assert.equal((await h.api.POST(h.request({ senderEmail: 'personal@gmail.com' }))).status, 409)
  assert.equal(h.deliveries.length, 0)
})
test('provider timeout and 5xx remain unknown and are never automatically resubmitted', async () => {
  for (const providerStatus of ['timeout', 503]) {
    const h = sendHarness({ providerStatus })
    const first = await h.api.POST(h.request())
    assert.equal(first.body.uncertain, 1); assert.equal(first.body.sent, 0)
    await h.api.POST(h.request())
    assert.equal(h.deliveries.filter(item => item.to[0] === 'one@example.com').length, 1)
    assert.equal(h.records.get('one@example.com').status, 'unknown')
  }
})
test('provider rejection is not reported as successful delivery', async () => {
  const h = sendHarness({ providerStatus: 429 })
  const result = await h.api.POST(h.request())
  assert.equal(result.body.sent, 0); assert.equal(result.body.failed, 1)
  assert.equal(h.records.get('one@example.com').status, 'failed')
})

test('owner-only settings gate rejects staff before touching mailbox configuration', async () => {
  const route = load('app/api/communications/email-settings/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => ({ ok: true, tenantId: 'tenant', context: { roleKey: 'admin', membershipId: 'member', permissions: new Set(['communications.configure']) } }) },
    '@/lib/permissions': { PERMISSIONS: { communicationsConfigure: 'communications.configure' } },
    '@/lib/supabase/admin': {}, '@/lib/supabase/crm-admin': {}, '@/lib/organisation-email': {}, '@/lib/organisation-email-policy': {}, '@/lib/gmail/google': {}, '@/lib/gmail/conversations': {}, '@/lib/account-audit': {},
  })
  assert.equal((await route.PUT(new Request('https://synthetic.invalid/settings', { method: 'PUT', body: '{}' }))).status, 403)
  assert.equal((await route.GET(new Request('https://synthetic.invalid/settings'))).body.owner, false)
})

test('owner-managed signatures are escaped and remain specific to the chosen alias', () => {
  const settings = { display_name: 'Academy', signature_text: 'Academy\nPublic phone', aliases: [{ email: 'teacher@example.com', name: 'Teacher', membershipId: 'member', signatureText: 'Teacher <script>\nMusic Academy' }] }
  const result = senderPolicy.authorisedOrganisationSenders(settings, 'office@example.com', 'member', [{ sendAsEmail: 'teacher@example.com', verificationStatus: 'accepted' }])
  assert.equal(result[0].signatureHtml, '<p>Teacher &lt;script&gt;<br>Music Academy</p>')
  assert.equal(result[1].signatureHtml, '<p>Academy<br>Public phone</p>')
})

function smsHarness({ changed = false, directoryError = false, providerStatus = 'queued' } = {}) {
  const deliveries = [], writes = []
  const resolved = { selectedCount: 2, recipients: [{ destination: '+12025550101', name: 'Account manager', contactIds: ['one', 'two'] }], excluded: [] }
  const database = { from(table) {
    const query = {
      select() { return query }, eq() { return query }, in() { return query },
      single: async () => ({ data: table === 'campaigns' ? { id: 'campaign', message: 'Schedule update' } : { account_sid: 'synthetic', auth_token: 'synthetic', phone_number: '+12025550102' }, error: null }),
      insert(row) { writes.push({ table, row }); return query },
      update(row) { writes.push({ table, row }); return query },
      then(resolve) { return Promise.resolve({ data: table === 'people' ? [{ id: 'one' }, { id: 'two' }] : [], error: null }).then(resolve) },
    }
    return query
  } }
  const api = load('app/api/campaigns/[id]/send/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/communication-recipient-directory': {
      validContactSelection: ids => Array.isArray(ids) && ids.length > 0,
      communicationRecipients: async () => { if (directoryError) throw new Error('Recipients could not be verified'); return resolved },
      recipientVersion: () => changed ? 'changed' : 'reviewed',
    },
    '@/lib/supabase/admin': { supabaseAdmin: database },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: database },
    '@/lib/account-audit': { writeAccountAuditEvent: async () => true },
    '@/lib/communication-authorization': { authorizeCommunicationSend: async () => ({ ok: true, tenantId: 'school', demo: false, context: { roleKey: 'owner', membershipId: 'owner' } }) },
    '@/lib/communication-recipients': policy,
    '@/lib/phone': { toE164PhoneNumber: value => value },
    twilio: { default: () => ({ messages: { create: async input => { deliveries.push(input); return { sid: 'SMsynthetic', status: providerStatus } } } }) },
  }, { process: { env: {} }, console: { error() {} }, setTimeout: callback => callback() })
  return { deliveries, writes, send: patch => api.POST(new Request('https://synthetic.invalid/api/campaigns/campaign/send', {
    method: 'POST', body: JSON.stringify({ recipientIds: ['one', 'two'], recipientVersion: 'reviewed', ...patch }),
  }), { params: Promise.resolve({ id: 'campaign' }) }) }
}

test('SMS changed preview rejects before transport or persistence', async () => {
  const h = smsHarness({ changed: true })
  assert.equal((await h.send()).status, 409)
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.writes.length, 0)
})

test('SMS unverifiable recipients reject before transport or persistence', async () => {
  const h = smsHarness({ directoryError: true })
  assert.equal((await h.send()).status, 500)
  assert.equal(h.deliveries.length, 0)
  assert.equal(h.writes.length, 0)
})

test('SMS delivery uses the reviewed destination once for siblings', async () => {
  const h = smsHarness()
  const response = await h.send()
  assert.equal(response.status, 200)
  assert.equal(response.body.sent, 1)
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.deliveries[0].to, '+12025550101')
  assert.equal(h.deliveries[0].body, 'Schedule update')
  assert.equal(h.writes.filter(write => write.table === 'messages').length, 1)
})

test('SMS provider failure is not reported as delivery', async () => {
  const h = smsHarness({ providerStatus: 'undelivered' })
  const response = await h.send()
  assert.equal(response.status, 502)
  assert.equal(response.body.sent, 0)
  assert.equal(response.body.failed, 1)
})

test('SMS cannot bypass the server preview by omitting its version', async () => {
  for (const recipientVersion of [undefined, null, '', 12]) {
    const h = smsHarness()
    assert.equal((await h.send({ recipientVersion })).status, 409)
    assert.equal(h.deliveries.length, 0)
    assert.equal(h.writes.length, 0)
  }
})

test('adult account-manager preference and overlapping business roles do not block SMS', () => {
  const adult = child('adult', { phone: null, students: [{ is_minor: false, message_routing: 'account_holder', accounts: accounts[0] }] })
  const manager = child('manager', { phone: accounts[0].phone, students: [{ is_minor: false, accounts: accounts[0] }] })
  const resolution = policy.resolveCommunicationRecipients([adult, manager], 'sms')
  assert.equal(resolution.recipients.length, 1)
  assert.equal(resolution.recipients[0].destination, '+12025550101')
  assert.deepEqual(plain(resolution.recipients[0].contactIds), ['adult', 'manager'])
  for (const students of [[], [{ is_minor: false }]]) {
    assert.equal(policy.resolveCommunicationRecipients([child('direct', { students })], 'sms').recipients[0].destination, '+12025550999')
  }
})

test('SMS rejects extensions, letters, invalid country codes and ambiguous international formatting', () => {
  for (const value of ['(202) 555-0101 ext 2', 'call 2025550101', '+02025550101', '442079460123', '+2025550101']) assert.equal(policy.smsDestination(value), '')
  assert.equal(policy.smsDestination('(202) 555-0101'), '+12025550101')
  assert.equal(policy.smsDestination('+44 20 7946 0123'), '+442079460123')
})

function replyHarness({ destination = '+12025550101', excluded = [], directoryError = false } = {}) {
  const deliveries = [], writes = []
  const query = { select() { return query }, eq() { return query }, single: async () => ({ data: { phone_number: '+12025550102' } }), insert: async row => { writes.push(row); return { error: null } } }
  const api = load('app/api/inbox/reply/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/account-audit': { writeAccountAuditEvent: async () => true },
    '@/lib/communication-authorization': { authorizeCommunicationSend: async () => ({ ok: true, tenantId: 'school', demo: false, context: { membershipId: 'owner' } }) },
    '@/lib/supabase/admin': { supabaseAdmin: { from: () => query } },
    '@/lib/communication-recipient-directory': {
      validContactSelection: ids => ids[0] === 'contact',
      communicationRecipients: async () => { if (directoryError) throw new Error('Directory unavailable'); return { recipients: destination ? [{ destination }] : [], excluded } },
    },
    '@/lib/communication-recipients': policy,
    '@/lib/phone': { toE164PhoneNumber: value => value },
    twilio: { default: () => ({ messages: { create: async input => { deliveries.push(input); return { sid: 'SMsynthetic', status: 'queued' } } } }) },
  }, { process: { env: {} } })
  return { deliveries, writes, send: patch => api.POST(new Request('https://synthetic.invalid/api/inbox/reply', { method: 'POST', body: JSON.stringify({ contact_id: 'contact', to_phone: '+12025550101', body: 'Hello', ...patch }) })) }
}

test('inbox SMS refuses client destination tampering, missing contacts, exclusions and directory failures', async () => {
  for (const [options, patch] of [[{}, { to_phone: '+12025550999' }], [{}, { contact_id: null }], [{ destination: '' }, {}], [{ excluded: [{ reason: 'Opted out' }] }, {}], [{ directoryError: true }, {}]]) {
    const h = replyHarness(options)
    assert.ok((await h.send(patch)).status >= 400)
    assert.equal(h.deliveries.length, 0)
    assert.equal(h.writes.length, 0)
  }
})

test('inbox SMS uses the server-verified destination, not client formatting', async () => {
  const h = replyHarness()
  assert.equal((await h.send({ to_phone: '(202) 555-0101' })).status, 200)
  assert.equal(h.deliveries[0].to, '+12025550101')
  assert.equal(h.writes[0].to_phone, '+12025550101')
})

test('SMS directory resolves lead-only contacts in preview and paginates opt-outs in tenant scope', async () => {
  for (const mode of ['person', 'lead', 'suppressed-second-page', 'missing', 'lead-error', 'suppression-error']) {
    const queries = []
    function client(legacy) { return { from(table) {
      const query = {
        select() { return query },
        eq(key, value) { queries.push({ legacy, table, key, value }); return query },
        order() { return query },
        in: async () => legacy ? { data: mode === 'missing' ? [] : [{ id: 'one', full_name: 'Fictional Lead', phone: '+12025550999' }], error: mode === 'lead-error' ? {} : null }
          : { data: mode === 'person' || mode === 'suppressed-second-page' || mode === 'suppression-error' ? [child('one', { students: [{ is_minor: false }] })] : [], error: null },
        range: async offset => {
          if (mode === 'suppression-error') return { data: null, error: {} }
          return { data: mode === 'suppressed-second-page' ? offset === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: `empty-${i}`, opted_out: true })) : [{ id: 'unselected', phone: '+12025550999', opted_out: true }] : [], error: null }
        },
      }
      return query
    } } }
    const directory = load('lib/communication-recipient-directory.ts', {
      '@/lib/supabase/admin': { supabaseAdmin: client(false) },
      '@/lib/supabase/crm-admin': { crmSupabaseAdmin: client(true) },
      '@/lib/communication-recipients': policy,
    })
    if (mode.endsWith('error') || mode === 'missing') await assert.rejects(directory.communicationRecipients('school', ['one'], 'sms'), /could not be verified|no longer available/)
    else assert.equal((await directory.communicationRecipients('school', ['one'], 'sms')).recipients.length, mode === 'suppressed-second-page' ? 0 : 1)
    assert.ok(queries.length > 0)
    for (const query of queries.filter(query => query.key === 'tenant_id')) assert.equal(query.value, 'school')
  }
})