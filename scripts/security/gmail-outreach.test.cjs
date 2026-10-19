/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in runner, no provider access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, env = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = vm.createContext({ module: loaded, exports: loaded.exports, Buffer, Intl, Date, process: { env }, require: id => {
    if (id === 'node:crypto') return require(id)
    throw new Error(`Blocked dependency ${id}`)
  } })
  new vm.Script(code).runInContext(context)
  return loaded.exports
}
const rules = load('lib/gmail/rules.ts')
const encode = text => Buffer.from(text).toString('base64url')
const lead = { id: 'lead', contact_id: 'contact', status: 'new', created_at: '2026-10-01T00:00:00Z', payload: {}, crm_contacts: { email: 'parent@example.com' } }

test('recipient matching normalizes exact email addresses, not names', () => {
  assert.equal(JSON.stringify(rules.emailAddresses('Parent <PARENT@example.com>, other@example.com')), JSON.stringify(['parent@example.com','other@example.com']))
  assert.equal(rules.matchEmailLeads([lead], ['parent@example.com'], '2026-10-10T12:00:00Z').length, 1)
  assert.equal(rules.matchEmailLeads([lead], ['parent+other@example.com'], '2026-10-10T12:00:00Z').length, 0)
})
test('family email payload and multiple inquiries return candidates without guessing', () => {
  const sibling = { ...lead, id: 'sibling', crm_contacts: null, payload: { parent_email: 'parent@example.com' } }
  assert.equal(rules.matchEmailLeads([lead,sibling], ['parent@example.com'], '2026-10-10T12:00:00Z').length, 2)
})
test('old messages, closed cases and winback do not match', () => {
  assert.equal(rules.matchEmailLeads([lead], ['parent@example.com'], '2026-09-10T12:00:00Z').length, 0)
  for (const status of ['won','lost','enrolled']) assert.equal(rules.matchEmailLeads([{ ...lead, status }], ['parent@example.com'], '2026-10-10T12:00:00Z').length, 0)
  assert.equal(rules.matchEmailLeads([{ ...lead, payload: { winback: true } }], ['parent@example.com'], '2026-10-10T12:00:00Z').length, 0)
})
test('plain text preferred and reply/signature text excluded', () => {
  const part = { parts: [{ mimeType: 'text/html', body: { data: encode('<p>Wrong</p>') } }, { mimeType: 'text/plain', body: { data: encode('Hello family!\n\nOn Monday someone wrote:\nYour lesson is confirmed Tuesday at 4 PM.') } }] }
  assert.equal(rules.emailBody(part), 'Hello family!')
  assert.equal(rules.emailBody({ mimeType: 'text/plain', body: { data: encode('Hello\n-- \nSignature') } }), 'Hello')
})
test('HTML converted to text; scripts, attachments and quoted block removed', () => {
  assert.equal(rules.emailBody({ mimeType: 'text/html', body: { data: encode('<script>evil()</script><p>Hello &amp; welcome</p><blockquote>old booking</blockquote>') } }), 'Hello & welcome')
  assert.equal(rules.emailBody({ mimeType: 'text/plain', filename: 'private.txt', body: { data: encode('attachment') } }), '')
  assert.equal(rules.emailBody({ mimeType: 'text/html', body: { data: encode('<p>Hello</p><div class="gmail_quote">Your lesson is confirmed Tuesday at 4 PM.</div>') } }), 'Hello')
  assert.equal(rules.emailBody({ mimeType: 'text/html', body: { data: encode('<p>Hello</p><div id="divRplyFwdMsg">Your lesson is confirmed Tuesday at 4 PM.</div>') } }), 'Hello')
})
test('only explicit date and time booking confirmation advances to booked', () => {
  assert.equal(rules.emailDecision('Your trial lesson is confirmed for Tuesday at 4 PM.'), 'booked')
  for (const body of ['Your trial lesson is confirmed.', 'Would Tuesday at 4 PM work?', 'Your lesson is confirmed for Tuesday at 4 PM if you pay.', 'Your lesson is not confirmed for Tuesday at 4 PM.', 'Your lesson is cancelled for Tuesday at 4 PM.', 'Tuesday at 4 PM is available.', 'Your lesson is confirmed for Tuesday at 16:00.']) assert.equal(rules.emailDecision(body), 'contacted')
})
test('booking requires the date and time directly attached to the confirmation', () => {
  for (const body of [
    'Your lesson is confirmed. Our office opens Tuesday at 4 PM.',
    'Your lesson is confirmed for Tuesday. Office hours start at 4 PM.',
    'Tuesday at 4 PM is our office meeting. Your lesson is confirmed.',
    'Your lesson is confirmed\n\nOffice hours: Tuesday at 4 PM.',
    'Your lesson is confirmed; our office opens Tuesday at 4 PM.',
    'Your lesson is confirmed for Tuesday at 24 PM.',
    'Your lesson is confirmed for Tuesday at 4:99 PM.',
    'Your lesson is confirmed for Tuesday at 0 AM.',
    'Your lesson is confirmed for Tuesday at 4 PM if payment arrives.',
  ]) assert.equal(rules.emailDecision(body), 'contacted', body)
  for (const body of [
    'Your trial lesson is confirmed for Tuesday at 4 PM.',
    'The appointment has been booked on October 20 at 4:30 PM.',
    'Your tour is scheduled for 2026-10-20 at 12 AM.',
    'Your lesson is confirmed for Tuesday at 4 p.m.',
    'Hello! Your lesson is confirmed for Tuesday\nat 4 PM. See you then.',
  ]) assert.equal(rules.emailDecision(body), 'booked', body)
})
test('note is simple dated quoted text, capped to 12000 body characters', () => {
  assert.equal(rules.emailNote('Hello family', '2026-10-14T18:00:00Z'), 'Email sent on Oct 14, 2026\n\n“Hello family”')
  assert.equal(rules.emailBody({ mimeType:'text/plain', body: { data: encode('a'.repeat(20000)) } }).length, 12000)
})
test('refresh tokens are authenticated encrypted and state comparison fails closed', () => {
  const security = load('lib/gmail/security.ts', { GMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') })
  const encrypted = security.encryptToken('private-refresh-token')
  assert.ok(!encrypted.includes('private-refresh-token'))
  assert.equal(security.decryptToken(encrypted), 'private-refresh-token')
  const parts = encrypted.split('.'); parts[2] = Buffer.from('tampered').toString('base64url')
  assert.throws(() => security.decryptToken(parts.join('.')))
  assert.equal(security.secretMatches('same','same'), true)
  assert.equal(security.secretMatches('different','same'), false)
  assert.equal(security.secretMatches('',''), false)
})
test('migration guards tenant isolation, idempotency, manual overrides and allowed status transitions', () => {
  const sql = fs.readFileSync(path.join(root,'scripts/crm-consolidation/12-gmail-outreach.sql'),'utf8')
  for (const text of ['ENABLE ROW LEVEL SECURITY','UNIQUE (tenant_id, fingerprint)',"IF m.status = 'recorded'",'FOR UPDATE',"p_decision IN ('contacted', 'booked')", "l.status = 'new'", "l.payload->'status_automation'->>'paused'",'tenant_id = p_tenant','REVOKE ALL ON FUNCTION']) assert.ok(sql.includes(text),text)
})