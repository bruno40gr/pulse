/* eslint-disable @typescript-eslint/no-require-imports -- Isolated pure display tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const loaded = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/conversation-display.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: loaded, exports: loaded.exports, Date })
const { compareConversations, newestEmail, lastContactTimestamp } = loaded.exports
const thread = (id, timestamp) => ({ id, messages: timestamp ? [{ timestamp }] : [] })
test('email-first history retains directory phone and SMS-first history retains email', () => {
  const liveModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/conversations-live.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: liveModule, exports: liveModule.exports })
  const person = { id: 'alex', name: 'Alex', phone: '+12025550123', email: 'alex@example.com' }
  const email = { contactId: 'alex', channel: 'email', phone: '', email: person.email }
  const sms = { contactId: 'alex', channel: 'sms', phone: person.phone, email: '' }
  const merged = liveModule.exports.mergeConversationThreads([person], [email, sms])
  assert.equal(merged[0].phone, person.phone)
  assert.equal(merged[1].email, person.email)
  assert.equal(email.phone, '', 'Do not mutate provider history')
  assert.equal(liveModule.exports.mergeConversationThreads([], [email, sms])[0].phone, person.phone)
})
test('newest received/sent history wins independent of provider order; empty drafts never win', () => {
  const threads = [thread('older', '2026-10-10T12:00:00Z'), thread('draft'), thread('newer', '2026-10-15T12:00:00Z')]
  assert.equal(newestEmail(threads).id, 'newer')
  assert.equal(newestEmail([thread('draft')]), undefined)
  assert.equal(threads[0].id, 'older')
})
test('last contact uses timestamps across both channels, normalizes offsets, ignores invalid dates', () => {
  assert.equal(lastContactTimestamp([thread('sms', '2026-10-15T11:00:00-04:00'), thread('email', '2026-10-15T14:00:00Z'), thread('bad', 'invalid')]), '2026-10-15T15:00:00.000Z')
  assert.equal(lastContactTimestamp([thread('empty')]), '')
})
test('name, latest contact and date sort both directions; unknown dates stay last', () => {
  const people = [{ name: 'Zoe', threads: [thread('z', '2026-10-15T12:00:00Z')] }, { name: 'Alex', threads: [thread('a', '2026-10-14T12:00:00Z')] }, { name: 'Missing', threads: [] }]
  for (const key of ['time', 'date']) {
    assert.equal(people.slice().sort((a, b) => compareConversations(a, b, key, 'desc'))[0].name, 'Zoe')
    const ascending = people.slice().sort((a, b) => compareConversations(a, b, key, 'asc'))
    assert.equal(ascending[0].name, 'Alex')
    assert.equal(ascending[2].name, 'Missing')
  }
  assert.equal(people.slice().sort((a, b) => compareConversations(a, b, 'name', 'asc'))[0].name, 'Alex')
  assert.equal(people.slice().sort((a, b) => compareConversations(a, b, 'name', 'desc'))[0].name, 'Zoe')
})
test('lead/contact drawers share width and skeleton; sidebar returns to conversations', () => {
  for (const file of ['components/inbox/ConversationProfilePanel.tsx', 'components/contacts/ContactSlidePanel.tsx', 'components/leads/LeadsView.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /width=\{PROFILE_PANEL_WIDTH\}/)
    assert.match(source, /<ProfilePanelSkeleton/)
  }
  assert.match(fs.readFileSync(path.join(root, 'app/dashboard/layout.tsx'), 'utf8'), /dispatchEvent\(new CustomEvent\(CONVERSATIONS_HOME_EVENT\)\)/)
})
test('desktop messaging workspaces preserve the approved 30/70 split', () => {
  const sms = fs.readFileSync(path.join(root, 'components/inbox/PrototypeSmsConversation.tsx'), 'utf8')
  const composer = fs.readFileSync(path.join(root, 'components/campaigns/ComposePanel.tsx'), 'utf8')
  const email = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  for (const source of [sms, composer, email]) assert.match(source, /minmax\(0, 3fr\) minmax\(0, 7fr\)/)
})

test('contact timing groups elapsed time by local calendar day', () => {
  const timing = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/contact-timing.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: timing, exports: timing.exports, Date })
  const format = timing.exports.formatContactTiming
  const now = new Date(2026, 9, 19, 18)
  assert.equal(format(undefined, now), 'Not contacted yet')
  assert.equal(format('invalid', now), '—')
  assert.equal(format(new Date(2026, 9, 19, 17, 50).getTime(), now), 'A moment ago')
  assert.equal(format(new Date(2026, 9, 19, 16).getTime(), now), '2 hours ago')
  assert.equal(format(new Date(2026, 9, 19, 2).getTime(), now), 'Today')
  assert.equal(format(new Date(2026, 9, 18, 23).getTime(), now), 'Yesterday')
  assert.equal(format(new Date(2026, 9, 17, 23).getTime(), now), 'Oct 17, 2026')
})
