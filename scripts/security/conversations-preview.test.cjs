/* eslint-disable @typescript-eslint/no-require-imports -- Isolated configuration tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const loaded = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/conversations-preview.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: loaded, exports: loaded.exports })
const { isConversationEmailPreview } = loaded.exports
const staging = 'https://xpnygavujqmzkdmcktdm.supabase.co'
test('sample email history is stable, per-person, and explicitly simulated', () => {
  function load(file, dependencies = {}) {
    const loadedModule = { exports: {} }
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { module: loadedModule, exports: loadedModule.exports, require: id => dependencies[id], Date })
    return loadedModule.exports
  }
  const live = load('lib/conversations-live.ts')
  const { createConversationEmailPreview } = load('lib/conversations-email-preview.ts', { '@/lib/conversations-live': live })
  const person = { id: 'one', name: 'Alex Example', email: 'alex@example.com', phone: '', student: '', stage: '' }
  const people = [person, { ...person, id: 'two', email: 'second@example.com' }, { ...person, id: 'no-email', email: '' }]
  const threads = createConversationEmailPreview(people)
  assert.equal(threads.length, 2)
  assert.equal(threads[0].contactId, 'one')
  assert.equal(threads[1].contactId, 'two')
  assert.notEqual(threads[0].id, threads[1].id)
  assert.equal(JSON.stringify(threads), JSON.stringify(createConversationEmailPreview(people)))
  for (const thread of threads) {
    assert.equal(thread.channel, 'email')
    assert.equal(thread.messages.length, 3)
    assert.ok(thread.messages.every(message => message.simulated && message.body && message.timestamp))
    assert.equal(thread.messages[1].emailTo[0], thread.email)
    assert.equal(thread.messages[2].unread, true)
  }
})
test('email preview requires the verified staging database and never production deployment', () => {
  assert.equal(isConversationEmailPreview({ databaseUrl: staging }), true)
  assert.equal(isConversationEmailPreview({ databaseUrl: staging, deployment: 'preview' }), true)
  assert.equal(isConversationEmailPreview({ databaseUrl: staging, deployment: 'production' }), false)
  for (const databaseUrl of [undefined, '', 'https://jbrntsxmibfldocsuslt.supabase.co', 'https://example.com']) {
    assert.equal(isConversationEmailPreview({ databaseUrl, deployment: 'preview' }), false)
  }
})
test('preview send exits before provider submission and retains the draft', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  assert.match(source, /async function sendEmail[^]*?if \(emailPreview\) \{\s*setNotice\('Preview only — no email sent\.'\)\s*return\s*\}/)
  assert.doesNotMatch(source, /Drafts are kept in this tab only|Connect your Gmail mailbox in Settings/)
})
test('CRM lists share the name component and channel buttons use standard Button', () => {
  for (const file of ['app/dashboard/contacts/page.tsx', 'app/dashboard/staff/page.tsx', 'components/leads/LeadsView.tsx', 'components/inbox/Conversations.tsx']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /<PersonName(?:Button)?[ >\n]/)
  }
  const source = fs.readFileSync(path.join(root, 'components/inbox/PrototypeNewMessage.tsx'), 'utf8')
  assert.match(source, /<SmsRecipientPicker\b/)
  assert.match(source, /<PrototypeEmailRecipients\b/)
  assert.match(source, /<ModalFooter>\s*<Button disabled=/)
  assert.doesNotMatch(source, /<Button key=\{option\}/)
  assert.doesNotMatch(source, /ControlButton/)
})