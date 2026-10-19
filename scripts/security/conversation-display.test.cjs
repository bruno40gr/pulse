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