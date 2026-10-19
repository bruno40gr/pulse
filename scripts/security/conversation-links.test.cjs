/* eslint-disable @typescript-eslint/no-require-imports -- Test TypeScript without a separate build. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const loaded = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/conversation-links.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: loaded, exports: loaded.exports, URLSearchParams })
const { conversationComposeHref, resolveConversationRecipient } = loaded.exports

test('compose URL carries encoded tenant and recipient IDs, not routing addresses', () => {
  const url = new URL(conversationComposeHref('tenant&x', 'person:a/b', 'email'), 'https://example.com')
  assert.equal(url.pathname, '/dashboard/inbox')
  assert.equal(url.searchParams.get('tenant'), 'tenant&x')
  assert.equal(url.searchParams.get('recipient'), 'person:a/b')
  assert.equal(url.searchParams.get('channel'), 'email')
  assert.equal(url.searchParams.get('compose'), '1')
  assert.equal(new URL(conversationComposeHref('t', 'lead:c', 'sms'), url).searchParams.get('channel'), 'sms')
})
test('recipient resolver accepts permitted stable IDs and explicit deduplication aliases only', () => {
  const person = { id: 'person:a', aliases: ['lead:b'], email: 'a@example.com' }
  assert.equal(resolveConversationRecipient([person], 'person:a'), person)
  assert.equal(resolveConversationRecipient([person], 'lead:b'), person)
  for (const id of ['foreign', 'a@example.com', 'a', 'person:b']) assert.equal(resolveConversationRecipient([person], id), undefined)
})
test('card shortcuts open same-width drawers or return to the contextual composer without submitting', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/ConversationComposeLink.tsx'), 'utf8')
  assert.match(source, /width=\{PROFILE_PANEL_WIDTH\}/)
  assert.match(source, /contextualCompose\(channel\)/)
  assert.match(source, /embedded=\{\{ recipient, channel/)
  assert.doesNotMatch(source, /target=|<a /)
  assert.doesNotMatch(source, /window\.open|fetch\(/)
  for (const file of ['components/contacts/ContactSlidePanel.tsx', 'components/leads/LeadDetailPanel.tsx']) {
    const card = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(card, /CardSmsComposer/)
    assert.match(card, /contextualCompose\('sms'\)/)
    assert.match(card, /ConversationComposeLink[^\n]+channel="email"/)
  }
})

test('card SMS restores the production composer as an inner view with explicit back navigation', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/CardSmsComposer.tsx'), 'utf8')
  assert.match(source, /<ComposePanel/)
  assert.match(source, /channel="sms" mode="single"/)
  assert.match(source, /onBack=\{onBack\}/)
  assert.match(source, /backDestination: 'lead' \| 'contact'/)
  assert.match(source, /Back to \$\{backDestination\}/)
  assert.doesNotMatch(source, /backLabel=\{leadId/)
  for (const [file, destination] of [['components/leads/LeadDetailPanel.tsx', 'lead'], ['components/contacts/ContactSlidePanel.tsx', 'contact']]) {
    assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes(`backDestination="${destination}"`))
  }
  assert.doesNotMatch(source, /<SlidePanel[\s>]|<Conversations/)
  const leads = fs.readFileSync(path.join(root, 'components/leads/LeadsView.tsx'), 'utf8')
  assert.doesNotMatch(leads, /Boolean\(composeLead\)/)
  assert.match(leads, /!smsViewOpen/)
})