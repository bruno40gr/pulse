/* eslint-disable @typescript-eslint/no-require-imports -- Offline provider fixtures; no deliveries. */
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
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Buffer, Request, URL, AbortSignal, ...globals,
    require(id) { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id] } })
  return loaded.exports
}
const selection = load('lib/group-email-selection.ts')
const audience = { selectedCount: 3, recipients: [
  { destination: 'parent@example.com', name: 'Parent', contactIds: ['child-one', 'child-two'] },
  { destination: 'adult@example.com', name: 'Adult', contactIds: ['adult'] },
], excluded: [] }
const plain = value => JSON.parse(JSON.stringify(value))
test('CC/BCC selection accepts routed, deduplicated destinations without requiring a visible band member', () => {
  assert.deepEqual(plain(selection.groupEmailSelection({ to: [], cc: [], bcc: ['parent@example.com', 'adult@example.com'] }, audience)), {
    to: [], cc: [], bcc: ['parent@example.com', 'adult@example.com'],
  })
  assert.deepEqual(plain(selection.groupEmailSelection({ to: ['adult@example.com'], cc: ['parent@example.com'], bcc: [] }, audience)), {
    to: ['adult@example.com'], cc: ['parent@example.com'], bcc: [],
  })
})
test('foreign, opted-out, stale, duplicate, malformed and empty selections fail closed', () => {
  for (const value of [null, {}, { to: [], cc: [], bcc: [] }, { to: 'parent@example.com', cc: [], bcc: [] },
    { to: ['parent@example.com'], cc: [], bcc: ['parent@example.com'] },
    { to: [], cc: [], bcc: ['foreign@example.com'] }, { to: [], cc: [], bcc: ['parent@example.com\r\nBcc: thief@example.com'] }]) {
    assert.throws(() => selection.groupEmailSelection(value, audience))
  }
  assert.throws(() => selection.groupEmailSelection({ to: [], cc: [], bcc: ['parent@example.com'] }, { ...audience, recipients: [] }))
  const recipients = Array.from({ length: 51 }, (_, i) => ({ destination: `${i}@example.com` }))
  assert.throws(() => selection.groupEmailSelection({ to: [], cc: [], bcc: recipients.map(row => row.destination) }, { ...audience, recipients }), /50/)
})
function harness(options = {}) {
  const deliveries = [], audits = []
  const operations = new Map()
  const api = load('app/api/communications/email-group/route.ts', {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => options.denied ? { ok: false, status: 403, error: 'Denied' } : {
      ok: true, tenantId: 'tenant', context: options.noContext ? null : { membershipId: 'staff', roleKey: options.role || 'staff', permissions: new Set(options.noContacts ? [] : ['contacts.read']) },
    } },
    '@/lib/permissions': { PERMISSIONS: { communicationsSend: 'communications.send', contactsRead: 'contacts.read' } },
    '@/lib/communication-recipient-directory': {
      validContactSelection: ids => Array.isArray(ids) && ids.length > 0,
      communicationRecipients: async (tenant, ids, channel) => {
        assert.equal(tenant, 'tenant'); assert.equal(channel, 'email'); assert.deepEqual(plain(ids), ['child-one', 'adult']); return audience
      }, recipientVersion: () => options.stale ? 'changed' : 'version',
    },
    '@/lib/group-email-selection': selection,
    '@/lib/organisation-email': { organisationSender: async (tenant, membership, email) => {
      assert.equal(tenant, 'tenant'); assert.equal(membership, 'staff')
      if (options.senderDenied) throw new Error('Unauthorised sender')
      assert.equal(email, 'office@example.com'); return { id: 'box', token: 'token', sender: { email, name: 'Academy' } }
    } },
    '@/lib/gmail/conversations': { gmailMime: value => JSON.stringify(value) },
    '@/lib/headliner-email-templates': { unresolvedEmailPlaceholders: value => value.includes('{{missing}}') ? ['missing'] : [] },
    '@/lib/account-audit': { writeAccountAuditEvent: async value => { audits.push(value); return true } },
    '@/lib/group-email-operation': {
      groupEmailFingerprint: value => JSON.stringify(value),
      reserveGroupEmail: async operation => {
        if (options.ledgerMissing) throw new Error('Delivery protection unavailable')
        const previous = operations.get(operation.operationId)
        if (previous) {
          if (previous.fingerprint !== operation.fingerprint) throw new Error('Operation changed')
          return previous.status
        }
        operations.set(operation.operationId, { fingerprint: operation.fingerprint, status: 'uncertain' })
        return 'reserved'
      },
      confirmGroupEmail: async operation => {
        if (options.confirmationFailure) throw new Error('Confirmation unavailable')
        operations.get(operation.operationId).status = 'sent'
      },
    },
  }, { fetch: async (url, init) => {
    assert.match(url, /messages\/send$/); assert.equal(init.method, 'POST')
    deliveries.push(JSON.parse(Buffer.from(JSON.parse(init.body).raw, 'base64url').toString()))
    if (options.timeout) throw new Error('Timeout')
    return { ok: !options.providerFailure, json: async () => ({ id: 'message' }) }
  } })
  const input = { operationId: '11111111-1111-4111-8111-111111111111', contactIds: ['child-one', 'adult'], senderEmail: 'office@example.com', version: 'version', subject: 'Rehearsal', body: 'Hello families', html: '<p>Hello families</p>',
    recipients: { to: [], cc: [], bcc: ['parent@example.com', 'adult@example.com'] } }
  return { deliveries, audits, send: patch => api.POST(new Request('https://synthetic.invalid/api/communications/email-group?tenant=tenant', { method: 'POST', body: JSON.stringify({ ...input, ...patch }) })) }
}
test('all-BCC sends once with organisation To, preserves hidden recipients and audits count only', async () => {
  const h = harness()
  assert.equal((await h.send()).status, 200)
  assert.equal(h.deliveries.length, 1)
  assert.deepEqual(h.deliveries[0].to, ['office@example.com'])
  assert.deepEqual(h.deliveries[0].bcc, ['parent@example.com', 'adult@example.com'])
  assert.deepEqual(h.deliveries[0].cc, [])
  assert.equal(h.audits[0].metadata.recipient_count, 2)
  assert.equal('bcc' in h.audits[0].metadata, false)
})
test('explicit To and CC survive delivery without silently exposing BCC', async () => {
  const h = harness()
  assert.equal((await h.send({ recipients: { to: ['adult@example.com'], cc: ['parent@example.com'], bcc: [] } })).status, 200)
  assert.deepEqual(h.deliveries[0].to, ['adult@example.com'])
  assert.deepEqual(h.deliveries[0].cc, ['parent@example.com'])
})
test('denied staff, portal roles, unauthorised senders and stale audiences never send', async () => {
  for (const options of [{ denied: true }, { noContext: true }, { noContacts: true }, { senderDenied: true }, { stale: true },
    ...['family', 'student', 'parent', 'guardian', 'customer'].map(role => ({ role }))]) {
    const h = harness(options)
    assert.ok((await h.send()).status >= 400)
    assert.equal(h.deliveries.length, 0)
  }
})
test('bad content and foreign recipients never reach the provider', async () => {
  for (const patch of [{ subject: 'Header\r\ninjection' }, { body: '' }, { subject: '{{missing}}' }, { body: 'Hello {first_name}' },
    { recipients: { to: [], cc: [], bcc: ['foreign@example.com'] } }, { contactIds: [] }]) {
    const h = harness()
    assert.ok((await h.send(patch)).status >= 400)
    assert.equal(h.deliveries.length, 0)
  }
})
test('provider errors and timeouts are never automatically retried', async () => {
  for (const options of [{ timeout: true }, { providerFailure: true }]) {
    const h = harness(options)
    const result = await h.send()
    assert.equal(result.status, 502); assert.equal(result.body.uncertain, true)
    assert.equal(h.deliveries.length, 1); assert.equal(h.audits.length, 0)
    assert.equal((await h.send()).status, 409)
    assert.equal(h.deliveries.length, 1)
  }
})
test('same operation replays success, rejects altered content, and concurrent requests send once', async () => {
  const h = harness()
  const results = await Promise.all([h.send(), h.send()])
  assert.equal(h.deliveries.length, 1)
  assert.ok(results.every(result => result.status === 200 || result.status === 409))
  const replay = await h.send()
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true)
  assert.equal((await h.send({ subject: 'Different email' })).status, 409)
  assert.equal(h.deliveries.length, 1)
})
test('missing ledger sends nothing and lost confirmation remains reserved', async () => {
  const missing = harness({ ledgerMissing: true })
  assert.equal((await missing.send()).status, 409); assert.equal(missing.deliveries.length, 0)
  const lost = harness({ confirmationFailure: true })
  assert.equal((await lost.send()).status, 502)
  assert.equal((await lost.send()).status, 409); assert.equal(lost.deliveries.length, 1)
})
test('concurrent attempts of one operation produce only one provider delivery', async () => {
  const h = harness()
  const responses = await Promise.all([h.send(), h.send(), h.send()])
  assert.equal(h.deliveries.length, 1)
  assert.equal(responses.filter(response => response.status === 200).length, 1)
  assert.ok(responses.filter(response => response.status !== 200).every(response => response.status === 409 && response.body.uncertain))
})
test('operation IDs are mandatory and validated before sending', async () => {
  for (const operationId of [undefined, '', 'invalid']) {
    const h = harness()
    assert.equal((await h.send({ operationId })).status, 400)
    assert.equal(h.deliveries.length, 0)
  }
})