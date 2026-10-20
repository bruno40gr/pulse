/* eslint-disable @typescript-eslint/no-require-imports -- Offline prototype tests; all data is synthetic. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
process.env.NODE_ENV = 'production'
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')

function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require: id => {
    assert.ok(id in dependencies, `Prototype requested unexpected dependency: ${id}`)
    return dependencies[id]
  }, window: { setTimeout: callback => callback() } })
  return loaded.exports
}
const fixtures = load('lib/conversations-prototype.ts')
const outreach = load('lib/headliner-email-templates.ts')
const messaging = load('lib/prototype-messaging.ts', { '@/lib/conversations-prototype': fixtures, '@/lib/headliner-email-templates': outreach })

test('one explicit contact contains both channel histories and genuine unread counts', () => {
  const threads = fixtures.createPrototypeThreads()
  const contacts = fixtures.groupPrototypeContacts(threads)
  assert.equal(contacts.length, 4)
  assert.equal(contacts[0].threads.length, 3)
  assert.equal(contacts[0].newSms, 1)
  assert.equal(contacts[0].newEmails, 1)
  threads.find(thread => thread.contactId === 'rivera').email = threads[0].email
  assert.equal(fixtures.groupPrototypeContacts(threads).length, 4)
  assert.ok(threads.every(thread => thread.messages.every(message => message.channel === thread.channel)))
  assert.ok(threads.every(thread => thread.email.endsWith('@example.com') && thread.phone.includes('555-01')))
})

test('email fixtures contain long paragraphs, multiple subjects and a safe self-contained signature', () => {
  const threads = fixtures.createPrototypeThreads().filter(thread => thread.channel === 'email')
  assert.ok(threads.every(thread => thread.messages.every(message => message.body.length > 350 && message.body.split('\n\n').length >= 3)))
  assert.ok(fixtures.PROTOTYPE_SIGNATURE.includes(fixtures.PROTOTYPE_EMAIL))
  assert.ok(fixtures.PROTOTYPE_LOGO.startsWith('data:image/svg+xml,'))
})

test('mock reply preserves channel/subject/HTML without mutating original', () => {
  const thread = fixtures.createPrototypeThreads()[1]
  assert.equal(fixtures.appendPrototypeMessage(thread, '  '), thread)
  const updated = fixtures.appendPrototypeMessage(thread, ' Hello ', '<p>Hello</p>')
  assert.equal(updated.messages.length, thread.messages.length + 1)
  assert.equal(updated.messages.at(-1).subject, thread.subject)
  assert.equal(updated.messages.at(-1).html, '<p>Hello</p>')
  assert.equal(updated.messages.at(-1).simulated, true)
})

function harness(mobile = false, wide = true) {
  const state = []
  let index = 0
  const ui = Object.fromEntries(['Notice', 'Button', 'Input', 'ModalBody', 'ModalFooter', 'ModalHeader', 'PageHeader', 'SectionTitle', 'Select', 'Tabs', 'Textarea', 'WorkspaceBreadcrumbs', 'BackControl'].map(name => [name, name]))
  ui.PageContainer = function PageContainer({ children, ...props }) { return React.createElement('main', props, children) }
  ui.SurfacePanel = function SurfacePanel({ children }) { return React.createElement('div', null, children) }
  ui.Modal = function Modal({ isOpen, children, ariaLabel }) { return isOpen ? React.createElement('div', { role: 'dialog', 'aria-label': ariaLabel }, children) : null }
  const entries = []
  let position = 0
  let restore
  const { default: Shell } = load('components/inbox/ConversationsPrototype.tsx', {
    react: { useState(initial) {
      const key = index++
      if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial
      return [state[key], value => { state[key] = typeof value === 'function' ? value(state[key]) : value }]
    }, useEffect() {}, useRef(initial) { const key = index++; if (!(key in state)) state[key] = { current: initial }; return state[key] } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/components/ui': ui,
    '@/components/ui/BackControl': { BackControl: 'BackControl' },
    '@/components/layout/IdentityProvider': { useIdentity: () => ({ identity: { fullName: 'Test Admin' } }) },
    '@/lib/useWorkspaceHistory': { useWorkspaceHistory(initial, callback) {
      restore = callback
      if (!entries.length) entries.push(initial)
      return { navigate(next) { entries.splice(++position); entries.push(next); restore(next) }, close() { position = 0; restore(entries[0]) } }
    } },
    '@/lib/prototype-messaging': messaging,
    '@/lib/contact-timing': load('lib/contact-timing.ts'),
    '@/components/inbox/SmsRecipientPicker': { default: 'SmsRecipientPicker' },
    '@/components/inbox/PrototypeNewMessage': { default: 'NewMessage' },
    '@/components/inbox/PrototypeEmailComposer': { default: 'EmailComposer' },
    '@/components/inbox/PrototypeSmsConversation': { default: 'SmsConversation' },
    '@/lib/conversations-prototype-html': { prototypePreviewDocument: html => html, prototypeHtmlText: html => html.replace(/<[^>]+>/g, '').trim() },
    '@/components/ui/DataGridTable': { ResponsiveDataTable: ({ rows, columns, emptyContent, ariaLabel }) => React.createElement('div', { role: 'table', 'aria-label': ariaLabel }, rows.length ? rows.map(row => React.createElement('div', { key: row.id }, columns.map(column => React.createElement('div', { key: column.id }, column.render(row))))) : emptyContent) },
    '@/components/ui/ControlButton': { ControlButton: 'ControlButton' },
    '@/lib/tokens': load('lib/tokens.ts'),
    '@/lib/useMediaQuery': { useMediaQuery: query => query.includes('min-width') ? wide : mobile },
    '@/lib/conversations-prototype': fixtures,
  })
  let tree
  function render() { index = 0; tree = Shell(); return tree }
  function nodes(element = tree) {
    if (!element || typeof element !== 'object') return []
    if (typeof element.type === 'function') return nodes(element.type(element.props))
    return [element, ...React.Children.toArray([element.props?.children, element.props?.right, element.props?.titleAction]).flatMap(child => nodes(child))]
  }
  function find(predicate) { const element = nodes().find(predicate); assert.ok(element, 'Expected interactive element'); return element }
  function text(element) { return React.Children.toArray(element?.props?.children).map(child => typeof child === 'object' ? text(child) : String(child)).join('') }
  function click(label) { if (label === 'New message') label = 'Send new email'; if (label === 'Save as draft') { find(node => node.type === 'EmailComposer').props.onCollapse(); render(); return } if (label === 'Discard draft' && !nodes().some(node => node.props?.['aria-label'] === 'Discard email draft')) { find(node => node.type === 'EmailComposer').props.onDiscard(); render(); return } if (label === 'Back to contacts') { find(node => node.type === 'PageHeader').props.onBack(); render(); return } const matches = nodes().filter(node => ['Button', 'ControlButton', 'BackControl'].includes(node.type) && (text(node) === label || node.props.label === label)); assert.ok(matches.length, `Expected action: ${label}`); matches.at(-1).props.onClick(); render() }
  function open(name = 'Alex Chen') { find(node => node.props['aria-label'] === `Open conversation with ${name}`).props.onClick(); render() }
  function channel(value) { find(node => node.type === 'Tabs').props.onChange(value); render() }
  function startEmail(id) { const modal = find(node => node.type === 'NewMessage'); modal.props.onEmail({ to: [id], cc: [], bcc: [] }); render() }
  function email(subject = 'Piano lessons for Jamie') { find(node => node.props['aria-label'] === `Read email: ${subject}`).props.onClick(); render() }
  render()
  return { render, find, text, state, click, open, channel, email, startEmail, back() { restore(entries[--position]); render() }, forward() { restore(entries[++position]); render() }, html: () => renderToStaticMarkup(tree) }
}

test('contact list has search and date filters without duplicate headings or prototype clutter', () => {
  const h = harness()
  assert.equal((h.html().match(/Open conversation with Alex Chen/g) || []).length, 1)
  assert.ok(h.html().includes('1 new SMS'))
  for (const expected of ['Search conversations', 'From date', 'To date']) assert.ok(h.html().includes(expected))
  for (const unwanted of ['sample people and messages only', 'WorkspaceBreadcrumbs', 'View lead', 'Quick view', 'Expand workspace', '<Tabs', '<svg']) assert.ok(!h.html().includes(unwanted))
})

test('conversation search and date range filter actual latest activity across channels', () => {
  const h = harness()
  h.find(node => node.props['aria-label'] === 'Search conversations').props.onChange({ target: { value: 'Jamie' } }); h.render()
  assert.ok(h.html().includes('Open conversation with Alex Chen'))
  assert.ok(!h.html().includes('Open conversation with Morgan Rivera'))
  h.find(node => node.props['aria-label'] === 'Search conversations').props.onChange({ target: { value: '' } }); h.render()
  h.find(node => node.props['aria-label'] === 'From date').props.onChange({ target: { value: '2099-01-01' } }); h.render()
  assert.ok(h.html().includes('No conversations match your filters.'))
  h.click('Clear filters')
  assert.ok(h.html().includes('Open conversation with Morgan Rivera'))
})

test('switching to SMS saves email draft and resuming keeps subject, body and recipients', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('Reply')
  const composer = h.find(node => node.type === 'EmailComposer')
  const saved = { ...composer.props.draft, subject: 'Retained subject', html: '<p>Retained reply</p>' }
  composer.props.onChange(saved); h.render(); h.channel('sms')
  assert.ok(h.html().includes('Email saved as draft.'))
  h.channel('email'); h.email(); h.click('Continue draft')
  const resumed = h.find(node => node.type === 'EmailComposer').props.draft
  assert.equal(resumed.subject, saved.subject)
  assert.equal(resumed.html, saved.html)
  assert.deepEqual(resumed.recipients, saved.recipients)
})

test('global email is a clean standalone compose view and saved draft resumes there', () => {
  const h = harness(); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onEmail({ to: ['chen', 'rivera'], cc: [], bcc: [] }); h.render()
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'New message')
  for (const unwanted of ['Email conversations', 'Previous email context', 'Conversation with Alex Chen', '<Tabs']) assert.ok(!h.html().includes(unwanted))
  const composer = h.find(node => node.type === 'EmailComposer')
  composer.props.onChange({ ...composer.props.draft, subject: 'Everyone', html: '<p>Hello</p>' }); h.render()
  h.click('Save as draft'); assert.ok(h.html().includes('You have a message in draft')); assert.ok(h.html().includes('Hello'))
  h.click('Continue draft')
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'New message')
  assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>Hello</p>')
})

test('contact and channel history stay on the page, with no modal or quick-view control', () => {
  const h = harness(); h.open()
  assert.ok(h.html().includes('Conversation with Alex Chen'))
  assert.ok(!h.html().includes('role="dialog"'))
  assert.ok(!h.html().includes('aria-label="Contacts"'))
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'Alex Chen')
  h.channel('email')
  assert.ok(h.html().includes('Email conversations'))
  assert.ok(!h.html().includes('<EmailComposer'))
  h.email()
  assert.ok(h.html().includes('Email reader'))
  assert.ok(!h.html().includes('<EmailComposer'))
})

test('reply stays below the email chain with stable list, reader, tabs and draft preview', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('Reply')
  assert.ok(!h.html().includes('Email drafting view'))
  assert.ok(h.html().includes('aria-label="Email conversations"'))
  assert.ok(h.html().includes('aria-label="Email reader"'))
  assert.ok(h.html().includes('<Tabs'))
  assert.ok(!h.html().includes('Reply context'))
  assert.equal(h.find(node => node.type === 'PageHeader').props.backLabel, 'Back to Conversations')
  h.find(node => node.type === 'EmailComposer').props.onChange({ subject: 'Re: Piano lessons for Jamie', html: '<p>My draft</p>' }); h.render()
  h.click('Save as draft')
  assert.ok(!h.html().includes('<EmailComposer'))
  assert.ok(h.html().includes('Email reader'))
  h.click('Continue draft')
  assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>My draft</p>')
  h.find(node => node.type === 'EmailComposer').props.onSend('My draft', '<p>My draft</p>'); h.render()
  assert.ok(!h.html().includes('<EmailComposer'))
  assert.ok(h.html().includes('Nothing was sent.'))
  assert.equal(fixtures.groupPrototypeContacts(h.state[0]).length, 4)
})

test('unread email is cleared on reading and a reply draft collapses when changing threads', () => {
  const h = harness(); h.open(); h.channel('email')
  assert.ok(h.html().includes('aria-label="Unread email"'))
  h.email()
  assert.ok(!h.html().includes('aria-label="Unread email"'))
  assert.ok(h.state[0].find(thread => thread.id === 'chen-email').messages.every(message => !message.unread))
  h.click('Reply')
  const composer = h.find(node => node.type === 'EmailComposer')
  composer.props.onChange({...composer.props.draft, html:'<p>A retained reply</p>'}); h.render()
  h.email('Getting to know Headliner')
  assert.ok(!h.html().includes('<EmailComposer'))
  h.email()
  assert.ok(h.html().includes('Email draft preview'))
  assert.ok(h.html().includes('A retained reply'))
  h.click('Continue draft')
  assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>A retained reply</p>')
})

test('empty email CTA opens a signed new draft; reading its row never opens the composer', () => {
  const h = harness(); h.open('Morgan Rivera'); h.channel('email')
  assert.ok(h.html().includes('No email history'))
  h.click('Draft email')
  const composer = h.find(node => node.type === 'EmailComposer')
  assert.equal(composer.props.draft.subject, '')
  assert.equal(composer.props.draft.suggestTemplates, undefined)
  assert.ok(composer.props.signatureHtml.includes(fixtures.PROTOTYPE_LOGO))
  assert.ok(composer.props.signatureHtml.includes('Test Admin'))
  assert.equal(composer.props.draft.contactOnly, true)
  assert.equal(composer.props.email, 'morgan.rivera@example.com')
  assert.ok(!h.html().includes('Reply context'))
  composer.props.onChange({subject: 'Guitar lessons', html: '<p>Hi Morgan</p>'}); h.render()
  h.click('Save as draft'); h.email('Guitar lessons')
  assert.ok(!h.html().includes('<EmailComposer'))
  h.click('Continue draft')
  assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>Hi Morgan</p>')
})

test('SMS retains the existing inline presentation and draft across channels and contacts', () => {
  const h = harness(); h.open()
  h.find(node => node.type === 'SmsConversation').props.onChange('SMS draft'); h.render()
  h.channel('email'); h.channel('sms')
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, 'SMS draft')
  h.click('Back to contacts'); h.open('Morgan Rivera'); h.click('Back to contacts'); h.open()
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, 'SMS draft')
  h.find(node => node.type === 'SmsConversation').props.onSend(); h.render()
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, '')
  assert.equal(h.state[0][0].messages.at(-1).channel, 'sms')
})

test('Back/Forward navigates composer and inbox without duplicating or losing drafts', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('Reply')
  h.find(node => node.type === 'EmailComposer').props.onChange({subject: 'Re: Piano', html: '<p>Keep me</p>'}); h.render()
  h.back(); assert.ok(!h.html().includes('<EmailComposer')); assert.ok(h.html().includes('Email reader'))
  h.forward(); assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>Keep me</p>')
  h.find(node => node.type === 'EmailComposer').props.onSend('Keep me', '<p>Keep me</p>'); h.render()
  h.back(); assert.ok(!h.html().includes('<EmailComposer'))
})

test('lead is a page destination and returns to the contact channel', () => {
  const h = harness(); h.open(); h.channel('email'); h.email()
  h.find(node => node.props['aria-label'] === 'Open lead for Alex Chen').props.onClick(); h.render()
  assert.ok(h.html().includes('Lead preview')); assert.ok(!h.html().includes('role="dialog"'))
  h.click('Back to conversation'); assert.ok(h.html().includes('Email reader'))
})

test('mobile basic list/reader navigation remains available without redesign', () => {
  const h = harness(true, false); h.open(); h.channel('email')
  assert.ok(h.html().includes('Email conversations')); assert.ok(!h.html().includes('aria-label="Email reader"'))
  h.email(); assert.ok(!h.html().includes('aria-label="Email conversations"'))
  h.click('Back to emails'); assert.ok(h.html().includes('Email conversations'))
  h.click('Back to contacts'); assert.ok(h.html().includes('aria-label="Conversations"'))
})

test('discard confirms, clears only the active draft and cannot resurrect it through history', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('Reply')
  h.find(node => node.type === 'EmailComposer').props.onChange({subject: 'Re: Piano', html: '<p>Discard me</p>'}); h.render()
  h.click('Discard draft'); assert.ok(h.html().includes('Discard this draft?'))
  h.click('Keep draft'); assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>Discard me</p>')
  h.click('Discard draft'); h.click('Discard draft')
  assert.ok(!h.html().includes('<EmailComposer'))
  h.back(); assert.ok(!h.html().includes('<EmailComposer'))
  h.click('Reply'); assert.ok(!h.find(node => node.type === 'EmailComposer').props.draft.html.includes('Discard me'))
})

test('new draft ids stay unique after discard, and another contact draft is not affected', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('Reply')
  h.find(node => node.type === 'EmailComposer').props.onChange({subject: 'Re: Piano', html: '<p>Alex draft</p>'}); h.render()
  h.click('Save as draft'); h.click('Back to contacts'); h.open('Morgan Rivera'); h.channel('email'); h.click('Draft email')
  h.find(node => node.type === 'EmailComposer').props.onChange({subject: 'First', html: '<p>First draft</p>'}); h.render()
  const first = h.state[0].find(thread => thread.subject === 'First').id
  h.click('Discard draft'); h.click('Discard draft'); h.click('Draft email')
  const second = h.state[0].find(thread => !thread.messages.length).id
  assert.notEqual(first, second)
  h.click('Save as draft'); h.click('Back to contacts'); h.open(); h.click('Continue draft')
  assert.equal(h.find(node => node.type === 'EmailComposer').props.draft.html, '<p>Alex draft</p>')
})

test('prototype has no network, persistence or live messaging and no SlidePanel shell', () => {
  for (const file of ['components/inbox/ConversationsPrototype.tsx', 'components/inbox/PrototypeEmailComposer.tsx', 'components/inbox/PrototypeSmsConversation.tsx', 'components/inbox/PrototypeNewMessage.tsx', 'components/inbox/PrototypeRecipients.tsx', 'components/inbox/PrototypeTemplates.tsx', 'components/inbox/PrototypeEmailTemplates.tsx', 'lib/prototype-messaging.ts', 'lib/conversations-prototype.ts', 'lib/conversations-prototype-html.ts', 'app/dashboard/inbox/prototype/page.tsx']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase|twilio|\/api\//)
  }
  const shell = fs.readFileSync(path.join(root, 'components/inbox/ConversationsPrototype.tsx'), 'utf8')
  assert.doesNotMatch(shell, /SlidePanel|WorkspaceHeader|Quick view|Expand workspace/)
  assert.match(shell, /<PageContainer/); assert.match(shell, /<PageHeader/); assert.match(shell, /<SurfacePanel/)
})


test('new-message entry is upfront and receives people, templates and contact context', () => {
  const h = harness()
  h.click('New message')
  assert.equal(h.find(node => node.type === 'NewMessage').props.open, true)
  assert.equal(h.find(node => node.type === 'NewMessage').props.preselected, undefined)
  h.find(node => node.type === 'NewMessage').props.onClose(); h.render()
  h.open(); assert.equal(h.find(node => node.type === 'PageHeader').props.backLabel, 'Back to Conversations')
  h.find(node => node.props['aria-label'] === 'Open lead for Alex Chen').props.onClick(); h.render()
  assert.equal(h.find(node => node.type === 'PageHeader').props.backLabel, 'Back to Conversations')
})

test('SMS multi-recipient mock writes separate personalised histories, never a group', () => {
  const h = harness(); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onSms(['chen', 'rivera']); h.render()
  h.find(node => node.type === 'SmsConversation').props.onChange('Hi {{firstName}}, how is {{student}}?'); h.render()
  h.find(node => node.type === 'SmsConversation').props.onSend(); h.render()
  const chen = h.state[0].find(thread => thread.contactId === 'chen' && thread.channel === 'sms')
  const rivera = h.state[0].find(thread => thread.contactId === 'rivera' && thread.channel === 'sms')
  assert.equal(chen.messages.at(-1).body, 'Hi Alex, how is Jamie?')
  assert.equal(rivera.messages.at(-1).body, 'Hi Morgan, how is Sam?')
  assert.equal(chen.messages.at(-1).simulated, true)
})

test('email retains To/Cc/Bcc in draft and adds one outbound record to each selected contact', () => {
  const h = harness(); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onEmail({to:['chen'], cc:['rivera'], bcc:[]}); h.render()
  const composer = h.find(node => node.type === 'EmailComposer')
  assert.deepEqual(Array.from(composer.props.draft.recipients.cc), ['rivera'])
  composer.props.onChange({...composer.props.draft, subject:'Hello', html:'<p>Hello everyone</p>'}); h.render()
  h.find(node => node.type === 'EmailComposer').props.onSend('Hello everyone', '<p>Hello everyone</p>'); h.render()
  for (const id of ['chen', 'rivera']) assert.ok(h.state[0].some(thread => thread.contactId === id && thread.channel === 'email' && thread.subject === 'Hello' && thread.messages.at(-1).body === 'Hello everyone'))
})

test('recipient validation requires To, rejects duplicates across To/Cc/Bcc and missing email', () => {
  const people = [{id:'a', email:'a@example.com'}, {id:'b', email:''}]
  assert.equal(messaging.validMockEmailRecipients({to:[],cc:['a'],bcc:[]}, people), false)
  assert.equal(messaging.validMockEmailRecipients({to:['a'],cc:['a'],bcc:[]}, people), false)
  assert.equal(messaging.validMockEmailRecipients({to:['a'],cc:[],bcc:['b']}, people), false)
  assert.equal(messaging.validMockEmailRecipients({to:['a'],cc:[],bcc:[]}, people), true)
})

test('templates are channel-scoped, deterministic and escape text before email rendering', () => {
  const templates = messaging.initialMockTemplates()
  assert.equal(templates.filter(item => item.channel === 'sms').length, 2)
  assert.equal(templates.filter(item => item.channel === 'email').length, 8)
  assert.equal(messaging.fillMockTemplate('Hi {{firstName}} / {{student}}'), 'Hi there / your student')
  assert.equal(messaging.mockTextHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>')
})


test('contact email skips channel modal and uses a single back link', () => {
  const h = harness(); h.open(); h.channel('email'); h.email()
  assert.ok(!h.html().includes('WorkspaceBreadcrumbs'))
  assert.equal(h.text(h.find(node => node.type === 'PageHeader').props.titleAction), 'View lead')
  h.click('New email')
  assert.equal(h.find(node => node.type === 'NewMessage').props.open, false)
  const composer = h.find(node => node.type === 'EmailComposer')
  assert.deepEqual(Array.from(composer.props.draft.recipients.to), ['chen'])
  assert.equal(composer.props.draft.suggestTemplates, undefined)
})

test('direct contact compose locks recipients, keeps previous context and uses signed-in name', () => {
  const h = harness(); h.open(); h.channel('email'); h.email(); h.click('New email')
  const composer = h.find(node => node.type === 'EmailComposer')
  assert.equal(composer.props.draft.contactOnly, true)
  assert.equal(composer.props.draft.contextThreadId, 'chen-email')
  assert.equal(composer.props.senderName, 'Test Admin')
  assert.ok(composer.props.signatureHtml.includes('Test Admin'))
  assert.ok(!composer.props.signatureHtml.includes('Headliner Office'))
  assert.ok(h.html().includes('Previous email context'))
  assert.ok(h.html().includes('Jamie has not had formal lessons'))
  assert.equal(composer.props.onViewPrevious, undefined)
  assert.ok(!h.html().includes('Email history · scroll up to review'))
  assert.ok(!h.html().includes('Back to draft'))
  const list = h.find(node => node.type === 'aside' && node.props['aria-label'] === 'Email conversations')
  assert.ok(!renderToStaticMarkup(list).includes('New email'))
  assert.ok(!renderToStaticMarkup(list).includes('Emails</'))
})

test('outreach counts all outbound email history, not SMS, inbound or empty drafts', () => {
  const threads = fixtures.createPrototypeThreads()
  assert.equal(messaging.countMockEmailOutreach(threads, 'chen'), 2)
  assert.equal(messaging.countMockEmailOutreach(threads, 'rivera'), 0)
  const templates = messaging.initialMockTemplates()
  assert.equal(messaging.nextMockEmailTemplate(templates, 0).name, 'First introduction')
  assert.equal(messaging.nextMockEmailTemplate(templates, 1).name, 'Lesson availability')
  assert.equal(messaging.nextMockEmailTemplate(templates, 2).name, 'Friendly follow-up')
  assert.equal(messaging.nextMockEmailTemplate(templates, 3), undefined)
  const source = threads.find(thread => thread.contactId === 'chen' && thread.channel === 'email')
  assert.equal(messaging.countMockEmailOutreach([...threads, {...source, id:'draft', messages:[]}], 'chen'), 2)
  const sent = fixtures.appendPrototypeMessage(source, 'Another outreach')
  assert.equal(messaging.countMockEmailOutreach(threads.map(thread => thread.id === sent.id ? sent : thread), 'chen'), 3)
})


test('new SMS uses a full-page workspace, editable recipients and no redundant channel tabs', () => {
  const h = harness(); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onSms(['chen', 'rivera']); h.render()
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'Write a text message')
  assert.ok(!h.html().includes('<Tabs'))
  assert.equal(h.find(node => node.type === 'NewMessage').props.open, false)
  h.find(node => node.type === 'SmsConversation').props.onChange('Unsent text'); h.render()
  h.click('Edit recipients')
  const picker = h.find(node => node.type === 'SmsRecipientPicker')
  picker.props.toggleRecipient(picker.props.selected.find(person => person.id === 'rivera')); h.render()
  h.click('Done')
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, 'Unsent text')
  assert.deepEqual(Array.from(h.find(node => node.type === 'SmsConversation').props.recipients, person => person.id), ['chen'])
  h.click('Back to contacts'); h.click('Cancel')
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, 'Unsent text')
  h.click('Discard text message'); h.click('Keep message')
  assert.equal(h.find(node => node.type === 'SmsConversation').props.draft, 'Unsent text')
  h.click('Discard text message'); h.click('Discard message'); h.back()
  assert.ok(h.html().includes('This text message is no longer available'))
})


test('leaving new SMS warns only for nonblank text and cancel preserves the message', () => {
  for (const body of ['', '   \n  ', 'Hello']) {
    const h = harness(); h.click('New message')
    h.find(node => node.type === 'NewMessage').props.onSms(['chen', 'rivera']); h.render()
    h.find(node => node.type === 'SmsConversation').props.onChange(body); h.render()
    h.click('Back to contacts')
    if (body.trim()) {
      assert.ok(h.html().includes('Going back to conversations will discard the current message'))
      h.click('Cancel')
      const composer = h.find(node => node.type === 'SmsConversation')
      assert.equal(composer.props.draft, body)
      assert.deepEqual(Array.from(composer.props.recipients, person => person.id), ['chen', 'rivera'])
      h.click('Back to contacts'); h.click('Continue')
    }
    assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'Conversations')
    h.forward()
    assert.ok(h.html().includes('This text message is no longer available'))
  }
})


test('one SMS recipient opens the personal conversation with existing history and retained drafts', () => {
  const h = harness(); h.open(); h.channel('email'); h.click('Back to contacts'); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onSms(['chen']); h.render()
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'Alex Chen')
  assert.equal(h.find(node => node.type === 'Tabs').props.activeKey, 'sms')
  assert.equal(h.find(node => node.type === 'NewMessage').props.open, false)
  assert.ok(!h.html().includes('Edit recipients'))
  assert.ok(!h.html().includes('Discard text message'))
  let composer = h.find(node => node.type === 'SmsConversation')
  assert.equal(composer.props.recipients, undefined)
  assert.equal(composer.props.thread.id, 'chen-sms')
  const messages = composer.props.thread.messages
  assert.equal(messages.length, 7)
  assert.ok(messages.every((message, index) => !index || message.timestamp >= messages[index - 1].timestamp))
  assert.ok(new Date(messages.at(-1).timestamp) - new Date(messages[0].timestamp) >= 20 * 86400000)
  assert.ok(messages.every(message => !message.unread))
  composer.props.onChange('Following up on our conversation'); h.render()
  h.click('Back to contacts'); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onSms(['chen']); h.render()
  composer = h.find(node => node.type === 'SmsConversation')
  assert.equal(composer.props.draft, 'Following up on our conversation')
  composer.props.onSend(); h.render()
  assert.equal(h.find(node => node.type === 'SmsConversation').props.thread.messages.at(-1).body, 'Following up on our conversation')
})

test('one SMS recipient without history opens their empty personal conversation', () => {
  const h = harness(); h.click('New message')
  h.find(node => node.type === 'NewMessage').props.onSms(['patel']); h.render()
  assert.equal(h.find(node => node.type === 'PageHeader').props.title, 'Taylor Patel')
  assert.equal(h.find(node => node.type === 'Tabs').props.activeKey, 'sms')
  const composer = h.find(node => node.type === 'SmsConversation')
  assert.equal(composer.props.thread.contactId, 'patel')
  assert.equal(composer.props.thread.messages.length, 0)
  assert.equal(composer.props.recipients, undefined)
  composer.props.onChange('Hello Taylor'); h.render()
  h.find(node => node.type === 'SmsConversation').props.onSend(); h.render()
  assert.equal(h.find(node => node.type === 'SmsConversation').props.thread.messages.at(-1).body, 'Hello Taylor')
})


test('draft notices precede the table panel and previews are bounded', () => {
  const h = harness(); h.click('New message'); h.startEmail('chen')
  const composer = h.find(node => node.type === 'EmailComposer')
  composer.props.onChange({ ...composer.props.draft, subject: 'Long draft', html: `<p>${'x'.repeat(300)}</p>` }); h.render()
  h.click('Save as draft')
  const preview = h.find(node => node.type === 'p' && h.text(node).startsWith('xxxxxxxx'))
  assert.equal(h.text(preview), 'x'.repeat(200) + '…')
  assert.equal(preview.props.style.WebkitLineClamp, 2)
})
