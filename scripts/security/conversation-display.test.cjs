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
const { compareConversations, conversationAttention, newestEmail, lastContactTimestamp } = loaded.exports
test('channel filtering scopes history, attention, counts, search and sorting without mutation', () => {
  const people = [
    { name: 'Mixed', newSms: 1, newEmails: 0, threads: [
      { channel: 'sms', messages: [{ direction: 'inbound', unread: true, body: 'SMS only', timestamp: '2026-10-28T12:00:00Z' }] },
      { channel: 'email', messages: [{ direction: 'outbound', body: 'Email only', timestamp: '2026-10-25T12:00:00Z' }] },
    ] },
    { name: 'Email', newSms: 0, newEmails: 1, threads: [{ channel: 'email', messages: [{ direction: 'inbound', unread: true, timestamp: '2026-10-27T12:00:00Z' }] }] },
    { name: 'Empty', newSms: 0, newEmails: 0, threads: [{ channel: 'sms', messages: [] }] },
  ]
  const before = JSON.stringify(people)
  const email = loaded.exports.filterConversationChannels(people, 'email')
  assert.equal(email.length, 2)
  assert.equal(email[0].newSms, 0)
  assert.equal(conversationAttention(email[0].threads).unattended, false)
  assert.equal(lastContactTimestamp(email[0].threads).slice(0, 10), '2026-10-25')
  assert.equal(email[0].threads.flatMap(thread => thread.messages).some(message => message.body === 'SMS only'), false)
  assert.equal(email.slice().sort((a, b) => compareConversations(a, b, 'time', 'desc'))[0].name, 'Email')
  const sms = loaded.exports.filterConversationChannels(people, 'sms')
  assert.equal(sms.length, 1)
  assert.equal(sms[0].newEmails, 0)
  assert.equal(conversationAttention(sms[0].threads).unread, true)
  assert.equal(loaded.exports.filterConversationChannels(people, 'all'), people)
  assert.equal(JSON.stringify(people), before)
})
test('list channel controls share contact header placement and opening respects the filter', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  const list = source.slice(source.indexOf('<SurfacePanel padding="0" style={{ overflow:'), source.indexOf('<ResponsiveDataTable rows={visibleContacts}'))
  assert.match(list, /<header/)
  assert.match(list, /justifyContent: 'space-between'/)
  assert.match(list, /aria-label="Filter conversation channel"/)
  assert.match(list, /<ControlButton key=\{channel\} kind="toggle"/)
  assert.match(list, /aria-pressed=\{channelFilter === channel\}/)
  assert.match(source, /filterConversationChannels\(contacts, channelFilter\)\.filter/)
  assert.match(source, /if \(channelFilter !== 'all'\) \{ next.channel = channelFilter/)
})
test('unattended icons distinguish email from SMS and retain both for mixed channels', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  assert.match(source, /attention.channels.includes\('sms'\) && <ArrowDownLeft/)
  assert.match(source, /attention.channels.includes\('email'\) && <Mail/)
  const pending = channel => ({ channel, messages: [{ direction: 'inbound', unread: false }] })
  assert.equal(conversationAttention([pending('email')]).channels.join(','), 'email')
  assert.equal(conversationAttention([pending('sms')]).channels.join(','), 'sms')
  assert.equal(conversationAttention([pending('sms'), pending('email')]).channels.join(','), 'sms,email')
})
test('unread and unattended are separate; reading keeps arrow, replying clears it', () => {
  const sms = { channel: 'sms', messages: [{ direction: 'inbound', unread: true }] }
  assert.equal(conversationAttention([sms]).unattended, true)
  assert.equal(conversationAttention([sms]).unread, true)
  sms.messages[0].unread = false
  assert.equal(conversationAttention([sms]).unattended, true)
  assert.equal(conversationAttention([sms]).unread, false)
  sms.messages.push({ direction: 'outbound' })
  assert.equal(conversationAttention([sms]).unattended, false)
  const email = { channel: 'email', messages: [{ direction: 'inbound', unread: true }] }
  assert.equal(conversationAttention([sms, email]).unattended, true, 'SMS reply must not attend another email thread')
  assert.equal(conversationAttention([sms, email]).channels.join(','), 'email')
  assert.equal(conversationAttention([{ channel: 'email', messages: [] }]).unattended, false)
})
test('an outbound latest message does not highlight a historical unread inbound', () => {
  assert.equal(conversationAttention([{ channel: 'email', messages: [{ direction: 'inbound', unread: true }, { direction: 'outbound' }] }]).unread, false)
})
test('signature uses real configured company fields and escapes all display values', () => {
  const signatureModule = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/conversation-signature.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module: signatureModule, exports: signatureModule.exports })
  const html = signatureModule.exports.conversationSignatureHtml({ company: 'Music & Arts', phone: '+12025550123', logoUrl: 'https://assets.example.com/logo.png' }, '<Owner>', 'office@example.com')
  assert.match(html, /Music &amp; Arts/)
  assert.match(html, /&lt;Owner&gt;/)
  assert.match(html, /\+12025550123/)
  assert.match(html, /<img src="https:\/\/assets.example.com\/logo.png"/)
  assert.doesNotMatch(html, /Warmly|office@example.com/)
  const named = signatureModule.exports.conversationSignatureHtml({ company: '', name: '<Public sender>', phone: '123', logoUrl: '' }, 'Internal sender')
  assert.match(named, /&lt;Public sender&gt;/)
  assert.doesNotMatch(named, /Internal sender/)
  assert.doesNotMatch(signatureModule.exports.conversationSignatureHtml({ company: '', phone: '', logoUrl: 'javascript:alert(1)' }, 'Owner', ''), /<img|555|sample/)
})
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
test('history workspaces retain 30/70 while SMS composing gives the writing area equal space', () => {
  const sms = fs.readFileSync(path.join(root, 'components/inbox/PrototypeSmsConversation.tsx'), 'utf8')
  const composer = fs.readFileSync(path.join(root, 'components/campaigns/ComposePanel.tsx'), 'utf8')
  const email = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  for (const source of [sms, email]) assert.match(source, /minmax\(0, 3fr\) minmax\(0, 7fr\)/)
  assert.match(composer, /minmax\(0, 1fr\) minmax\(280px, 1fr\)/)
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
