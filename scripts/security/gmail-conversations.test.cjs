/* eslint-disable @typescript-eslint/no-require-imports -- Isolated providers; no credentials or real sends. */
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
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Buffer, Date, URL, URLSearchParams, AbortSignal, ...globals, require(id) {
    if (id === 'node:crypto') return require(id)
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  return loaded.exports
}
const google = load('lib/gmail/google.ts')
const rules = load('lib/gmail/rules.ts')
const helper = load('lib/gmail/conversations.ts', { '@/lib/supabase/crm-admin': {}, './security': {}, './google': {}, './rules': rules, '@/lib/organisation-email': { organisationEmailSettings: async () => null } })
test('MIME rejects header injection, invalid recipients and empty content', () => {
  const valid = { from: 'office@example.com', to: ['parent@example.com'], cc: [], bcc: [], subject: 'Piano lessons', body: 'Hello' }
  for (const patch of [{ subject: 'Hello\r\nBcc: attacker@example.com' }, { to: ['parent@example.com\n'] }, { to: [] }, { body: ' ' }, { subject: ' ' }]) assert.throws(() => helper.gmailMime({ ...valid, ...patch }))
  const mime = helper.gmailMime({ ...valid, html: '<p>Hello</p>', cc: ['cc@example.com'], bcc: ['private@example.com'] })
  assert.match(mime, /multipart\/alternative/)
  assert.match(mime, /Bcc: private@example.com/)
  assert.match(mime, /Content-Transfer-Encoding: base64/)
})
test('Unicode subject/body and reply identifiers survive safe MIME encoding', () => {
  const mime = helper.gmailMime({ from: 'office@example.com', to: ['parent@example.com'], cc: [], bcc: [], subject: 'Music 🎵', body: 'Olá!', reply: { payload: { headers: [{ name: 'Message-ID', value: '<original@example.com>' }] } } })
  assert.ok(mime.includes(Buffer.from('Music 🎵').toString('base64')))
  assert.ok(mime.includes(Buffer.from('Olá!').toString('base64')))
  assert.match(mime, /In-Reply-To: <original@example.com>/)
})
test('provider body is full plain text, never untrusted HTML, and contact match excludes Bcc', () => {
  assert.equal(helper.gmailConversationBody({ mimeType: 'text/plain', body: { data: Buffer.from('Hi\n\nOn Monday wrote:\nHistory').toString('base64url') } }), 'Hi\n\nOn Monday wrote:\nHistory')
  assert.match(helper.gmailConversationBody({ mimeType: 'text/html', body: { data: Buffer.from('<script>x</script>').toString('base64url') } }), /no plain-text body/)
  assert.equal(helper.gmailThreadMatches({ messages: [{ payload: { headers: [{ name: 'Bcc', value: 'secret@example.com' }] } }] }, 'secret@example.com'), false)
})

function routeHarness({ denied = false, sendScope = true, failSend = false, mailboxes = [], threads = [], failRead = null, additionalPeople = [] } = {}) {
  const calls = []; const queries = []
  const person = { id: 'person:one', name: 'Parent', email: 'parent@example.com', phone: '', student: '', stage: '', profileType: 'lead', profileId: 'one', smsContactId: 'one' }
  const live = load('lib/conversations-live.ts')
  const api = load('app/api/conversations/email/route.ts', {
    '@/lib/gmail/google': google,
    '@/lib/organisation-email': { organisationEmailSettings: async () => null, organisationSender: async () => ({ id: 'mailbox-one', email: 'office@example.com', sender: { email: 'office@example.com', name: 'Office' }, token: 'not-a-real-token', scopes: sendScope ? ['https://www.googleapis.com/auth/gmail.send'] : [] }) },
    '@/lib/headliner-email-templates': load('lib/headliner-email-templates.ts'),
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => denied ? { ok: false, status: 403, error: 'Denied' } : { ok: true, tenantId: 'tenant-one', context: { membershipId: 'member-one', roleKey: 'owner', permissions: new Set() } } },
    '@/lib/permissions': { PERMISSIONS: { communicationsRead: 'read', communicationsSend: 'send', contactsRead: 'contacts', leadsRead: 'leads' } },
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from(table) {
      const builder = { select() { return builder }, eq(key, value) { queries.push([table, key, value]); return builder }, order() { return Promise.resolve({ data: mailboxes, error: null }) } }
      return builder
    } } },
    '@/lib/conversation-email-range': load('lib/conversation-email-range.ts'),
    '@/lib/conversations-directory': { conversationDirectory: async () => [person, ...additionalPeople] },
    '@/lib/gmail/conversations': { ...helper, conversationMailbox: async (...args) => { calls.push(['mailbox', ...args]); return { id: 'mailbox-one', email: 'office@example.com', token: 'not-a-real-token', scopes: sendScope ? ['https://www.googleapis.com/auth/gmail.send'] : [] } }, gmailGet: async (_, url) => { calls.push(['get', url]); if (failRead) { const failure = failRead(url); if (failure) throw failure }; return url.startsWith('threads?') ? { threads: threads.map(thread => ({ id: thread.id })), nextPageToken: 'page-two' } : threads.find(thread => url.includes(thread.id)) } },
    '@/lib/gmail/rules': rules,
    '@/lib/conversations-live': live,
    '@/lib/account-audit': { writeAccountAuditEvent: async () => { calls.push(['audit']); return true } },
    '@/lib/conversations-preview': { isConversationEmailPreview: () => false },
  }, { process: { env: {} }, fetch: async (url, options) => { calls.push(['send', url, JSON.parse(options.body)]); return { ok: !failSend, json: async () => ({ id: 'sent-one', threadId: 'thread-one' }) } } })
  const body = { mailboxId: 'mailbox-one', to: [person.id], cc: [], bcc: [], subject: 'Lessons', body: 'Hello', html: '<p>Hello</p>' }
  const request = (patch = {}) => new Request('https://app.example.com/api/conversations/email?tenant=tenant-one', { method: 'POST', body: JSON.stringify({ ...body, ...patch }) })
  return { api, calls, queries, request }
}
test('denied reads and sends never reach a mailbox or provider', async () => {
  const h = routeHarness({ denied: true })
  assert.equal((await h.api.GET(new Request('https://example.com/api/conversations/email'))).status, 403)
  assert.equal((await h.api.POST(h.request())).status, 403)
  assert.equal(h.calls.length, 0)
})
test('unfilled outreach placeholders never reach the mailbox or provider', async () => {
  const h = routeHarness()
  for (const patch of [{ body: 'Hello [MEMBER’S NAME]' }, { subject: '[INSTRUMENT] lessons' }, { html: '<p>[SON/DAUGHTER]</p>' }]) {
    assert.equal((await h.api.POST(h.request(patch))).status, 400)
  }
  assert.equal(h.calls.length, 0)
})
test('mailbox list is tenant/member scoped and does not return tokens', async () => {
  const h = routeHarness({ mailboxes: [{ id: 'box', email: 'office@example.com', scopes: [] }] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email'))
  assert.equal(result.body.mailboxes[0].canSend, false)
  assert.ok(h.queries.some(([, key, value]) => key === 'tenant_id' && value === 'tenant-one'))
  assert.ok(h.queries.some(([, key, value]) => key === 'connected_by' && value === 'member-one'))
  assert.doesNotMatch(JSON.stringify(result.body), /token|scopes/)
})
test('send requires resolved same-account recipients and send consent', async () => {
  const h = routeHarness()
  assert.equal((await h.api.POST(h.request({ to: ['foreign-contact'] }))).status, 400)
  assert.equal((await h.api.POST(h.request({ subject: 'Hello\nBcc: a@example.com' }))).status, 400)
  assert.equal(h.calls.length, 0)
  const readonly = routeHarness({ sendScope: false })
  assert.equal((await readonly.api.POST(readonly.request())).status, 409)
  assert.equal(readonly.calls.filter(call => call[0] === 'send').length, 0)
})
test('accepted send is audited and attempted exactly once; provider failure is not success', async () => {
  const h = routeHarness()
  const result = await h.api.POST(h.request())
  assert.equal(result.status, 200); assert.equal(result.body.id, 'sent-one')
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 1)
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 1)
  assert.ok(h.calls.some(call => call[0] === 'audit'))
  const failure = routeHarness({ failSend: true })
  assert.equal((await failure.api.POST(failure.request())).status, 502)
  assert.equal(failure.calls.filter(call => call[0] === 'send').length, 1)
})
test('mailbox summary retains unread/direction metadata, pagination and member isolation without bodies', async () => {
  const h = routeHarness({ threads: [
    { id: 'known', messages: [{ id: 'inbound', internalDate: '1792252800000', labelIds: ['UNREAD'], payload: { mimeType: 'text/plain', body: { data: Buffer.from('Private body').toString('base64url') }, headers: [{ name: 'From', value: 'parent@example.com' }] } }] },
    { id: 'unrelated', messages: [{ id: 'other', internalDate: '1792252800000', payload: { headers: [{ name: 'From', value: 'stranger@example.com' }] } }] },
  ] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&summary=1&cursor=page-one'))
  assert.equal(result.status, 200)
  assert.equal(result.body.threads.length, 1)
  assert.equal(result.body.threads[0].messages[0].direction, 'inbound')
  assert.equal(result.body.threads[0].messages[0].unread, true)
  assert.equal(result.body.threads[0].messages[0].body, '')
  assert.equal(result.body.nextCursor, 'page-two')
  assert.ok(h.calls.some(call => call[0] === 'get' && call[1].includes('format=metadata')))
  assert.deepEqual(h.calls.find(call => call[0] === 'mailbox'), ['mailbox', 'tenant-one', 'mailbox-one', 'member-one'])
  assert.doesNotMatch(JSON.stringify(result.body), /Private body|stranger@example/)
})
test('history retains pagination, ignores unrelated threads and does not expose Bcc', async () => {
  const h = routeHarness({ threads: [{ id: 'thread-one', messages: [{ id: 'message-one', internalDate: '1792252800000', labelIds: ['UNREAD'], payload: { mimeType: 'text/plain', body: { data: Buffer.from('Hello').toString('base64url') }, headers: [{ name: 'From', value: 'parent@example.com' }, { name: 'Subject', value: 'Lessons' }, { name: 'Bcc', value: 'secret@example.com' }] } }] }] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&person=person:one&cursor=page-one'))
  assert.equal(result.status, 200); assert.equal(result.body.nextCursor, 'page-two')
  assert.equal(result.body.threads[0].messages[0].unread, true)
  assert.doesNotMatch(JSON.stringify(result.body), /secret@example|Bcc/)
  assert.ok(h.calls.some(call => call[0] === 'get' && call[1].includes('pageToken=page-one')))
})

test('invalid Gmail dates use the Date header and unknown dates stay outside a bounded range', async () => {
  const messages = ['bad-date', '', '999999999999999999999999'].map((internalDate, index) => ({
    id: `message-${index}`, internalDate, payload: { headers: [
      { name: 'From', value: 'parent@example.com' },
      ...(index === 0 ? [{ name: 'Date', value: 'Wed, 21 Oct 2026 05:00:00 +0000' }] : []),
    ] },
  }))
  const h = routeHarness({ threads: [{ id: 'thread-one', messages }] })
  const result = await h.api.GET(new Request('https://app.headlinerma.com/api/conversations/email?mailbox=mailbox-one&person=person:one'))
  assert.equal(result.status, 200)
  const actual = result.body.threads[0].messages
  assert.equal(actual.length, 1)
  assert.equal(actual.find(message => message.id === 'message-0').timestamp, '2026-10-21T05:00:00.000Z')
  assert.ok(actual.every(message => message.timestamp))
})

test('a deleted thread does not break the remaining history on either production hostname', async () => {
  for (const host of ['app.headlinerma.com', 'leads.headlinerma.com']) {
    const h = routeHarness({ threads: [
      { id: 'deleted' },
      { id: 'valid', messages: [{ id: 'one', internalDate: '1792252800000', payload: { headers: [{ name: 'From', value: 'parent@example.com' }] } }] },
    ], failRead: url => url.includes('threads/deleted?') ? new google.GmailReadError(404) : null })
    const result = await h.api.GET(new Request(`https://${host}/api/conversations/email?mailbox=mailbox-one&person=person:one`))
    assert.equal(result.status, 200)
    assert.equal(result.body.threads.length, 1)
    assert.ok(result.body.threads[0].id.includes(':valid:'))
  }
})

test('history failures stay visible with safe diagnostics, not reconnect instructions or false empty results', async () => {
  for (const failure of [new google.GmailReadError(429), new Error('private provider details and credentials')]) {
    const h = routeHarness({ failRead: () => failure })
    const result = await h.api.GET(new Request('https://app.headlinerma.com/api/conversations/email?mailbox=mailbox-one&person=person:one'))
    assert.equal(result.status, 503)
    assert.match(result.body.code, /^history_list(?:_429_unknown)?$/)
    assert.doesNotMatch(JSON.stringify(result.body), /private|credentials|reconnect|Settings/)
    assert.equal(result.body.threads, undefined)
    assert.equal(h.calls.filter(call => call[0] === 'send').length, 0)
  }
})

test('403 rate limits are retried, but permission/policy denials are not and diagnostics are sanitized', async () => {
  for (const reason of ['rateLimitExceeded', 'userRateLimitExceeded', 'insufficientPermissions', 'domainPolicy', 'private-token-and-address']) {
    let calls = 0
    const provider = load('lib/gmail/google.ts', {}, { setTimeout: callback => callback(), fetch: async () => {
      calls++
      return { ok: false, status: 403, json: async () => ({ error: { message: 'private provider details', errors: [{ reason }] } }) }
    } })
    await assert.rejects(provider.gmailGet('secret-token', 'threads'), error => {
      assert.equal(error.reason, reason.startsWith('private') ? 'unknown' : reason)
      assert.equal(error.retryable, ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason))
      assert.doesNotMatch(JSON.stringify(error), /private|secret|address/)
      return true
    })
    assert.equal(calls, ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason) ? 2 : 1)
  }
})

test('history API keeps diagnostics separate from plain-language errors and never sends on a read failure', async () => {
  const h = routeHarness({ failRead: () => new google.GmailReadError(403, 'userRateLimitExceeded') })
  const result = await h.api.GET(new Request('https://app.headlinerma.com/api/conversations/email?mailbox=mailbox-one&person=person:one'))
  assert.equal(result.body.code, 'history_list_403_userRateLimitExceeded')
  assert.match(result.body.error, /temporarily busy/)
  assert.doesNotMatch(result.body.error, /history_|403|reconnect|Sending is still available/)
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 0)
})

test('new drafts do not load history and background summaries are bounded, cancellable and hidden-tab aware', () => {
  const source = fs.readFileSync(path.join(root, 'components/inbox/Conversations.tsx'), 'utf8')
  const summary = source.slice(source.indexOf('    setEmailSummaries([])'), source.indexOf('    if (!previewHistory)'))
  assert.ok(!summary.includes('do {'))
  assert.ok(!summary.includes('while (cursor)'))
  assert.match(summary, /location.view === 'compose'/)
  assert.match(summary, /document.visibilityState === 'hidden'/)
  assert.match(summary, /controller.abort\(\)/)
  assert.match(summary, /else if \(!scannedFirstPage\) \{/)
  assert.match(summary, /page < 3 && olderCursor && !cancelled/)
  assert.match(summary, /if \(scannedFirstPage && olderCursor\) olderCursor = await loadPage\(olderCursor\)/)
  assert.match(source, /location.view !== 'contact' \|\| location.channel !== 'email'/)
  assert.ok(!source.includes('{sendError || emailError}'))
  assert.match(source, />Retry history<\/Button>/)
})

test('Gmail reads retry only transient HTTP and network failures, without retaining provider details', async () => {
  for (const status of [429, 500, 503, 0]) {
    let calls = 0
    const provider = load('lib/gmail/google.ts', {}, { setTimeout: callback => callback(), fetch: async () => {
      calls++
      if (calls === 1) {
        if (status === 0) throw new Error('secret network details')
        return { ok: false, status }
      }
      return { ok: true, json: async () => ({ threads: [] }) }
    } })
    assert.equal((await provider.gmailGet('secret-token', 'threads')).threads.length, 0)
    assert.equal(calls, 2)
  }
  for (const status of [400, 401, 403, 404, 429]) {
    let calls = 0
    const provider = load('lib/gmail/google.ts', {}, { setTimeout: callback => callback(), fetch: async () => {
      calls++
      return { ok: false, status, text: () => { throw new Error('Provider bodies must never be read') } }
    } })
    await assert.rejects(provider.gmailGet('secret-token', 'threads'), error => {
      assert.equal(error.status, status)
      assert.doesNotMatch(error.message, /secret|reconnect/i)
      return true
    })
    assert.equal(calls, status === 429 ? 2 : 1)
  }
})
const emailMessage = (id, headers, labelIds = ['UNREAD']) => ({ id, internalDate: '1792252800000', labelIds, payload: { mimeType: 'text/plain', body: { data: Buffer.from('Message content').toString('base64url') }, headers: Object.entries(headers).map(([name, value]) => ({ name, value })) } })

test('Opus notification transport senders are excluded without name, subject or quoted-body heuristics', () => {
  for (const header of ['From', 'Sender', 'Return-Path']) {
    const notification = emailMessage('opus', { From: 'parent@example.com', [header]: 'Headliner <no-reply@notifications.opus1.io>' })
    assert.equal(helper.isOpusNotification(notification), true)
    assert.equal(helper.gmailThreadMatches({ messages: [notification] }, 'parent@example.com', 'office@example.com'), false)
  }
  for (const from of ['mel@example.com', 'david@example.com', 'parent@example.com', 'person@opus1.io', 'person@notifications.opus1.io.evil.example']) {
    assert.equal(helper.isOpusNotification(emailMessage('real', { From: from, 'Reply-To': 'no-reply@notifications.opus1.io', Subject: 'Your receipt' })), false)
  }
})

test('notification-only histories disappear from summaries and contact history without mutating Gmail', async () => {
  const threads = [{ id: 'opus-thread', messages: [emailMessage('opus', { From: 'no-reply@notifications.opus1.io', To: 'parent@example.com', Cc: 'staff@example.com' })] }]
  for (const query of ['summary=1', 'person=person:one']) {
    const h = routeHarness({ threads })
    const result = await h.api.GET(new Request(`https://example.com/api/conversations/email?mailbox=mailbox-one&${query}`))
    assert.equal(result.status, 200)
    assert.equal(result.body.threads.length, 0)
    assert.equal(result.body.nextCursor, 'page-two')
    const display = load('lib/conversation-display.ts')
    assert.equal(display.conversationAttention(result.body.threads).unattended, false)
    assert.equal(display.lastContactTimestamp(result.body.threads), '')
    assert.equal(h.calls.some(call => call[0] === 'send'), false)
  }
})

test('mixed Opus threads retain genuine replies and never attribute inbound mail to CC recipients', async () => {
  const staff = { id: 'staff', name: 'Staff', email: 'staff@example.com' }
  const threads = [{ id: 'mixed', messages: [
    emailMessage('opus', { From: 'parent@example.com', Sender: 'no-reply@notifications.opus1.io', To: 'office@example.com', Cc: staff.email }),
    emailMessage('reply', { From: 'Parent <parent@example.com>', To: 'office@example.com', Cc: staff.email, 'Reply-To': 'no-reply@notifications.opus1.io' }),
  ] }]
  const h = routeHarness({ threads, additionalPeople: [staff] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&summary=1'))
  assert.equal(result.body.threads.length, 1)
  const actual = result.body.threads[0]
  assert.equal(actual.contactId, 'person:one')
  assert.equal(actual.messages.length, 1)
  assert.equal(actual.messages[0].id, 'reply')
  assert.equal(actual.messages[0].direction, 'inbound')
  assert.equal(actual.messages[0].emailFrom, 'parent@example.com')
  assert.equal(actual.messages[0].unread, true)
})

test('each person sees their own messages rather than unrelated authors copied on a shared thread', async () => {
  const staff = { id: 'staff', name: 'David', email: 'staff@example.com', profileType: 'lead' }
  const h = routeHarness({ additionalPeople: [staff], threads: [{ id: 'shared', messages: [
    emailMessage('parent', { From: 'parent@example.com', To: 'office@example.com', Cc: staff.email }),
    emailMessage('staff-direct', { From: staff.email, To: 'office@example.com', Cc: 'parent@example.com' }),
  ] }] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&summary=1'))
  assert.equal(result.body.threads.length, 2)
  assert.equal(result.body.threads.find(thread => thread.contactId === 'person:one').messages[0].id, 'parent')
  assert.equal(result.body.threads.find(thread => thread.contactId === 'staff').messages[0].id, 'staff-direct')
  assert.ok(result.body.threads.every(thread => thread.messages.length === 1))
})

test('email reads exclude non-leads and old messages even inside matching threads', async () => {
  const h = routeHarness({ additionalPeople: [{ id: 'contact', profileType: 'contact', email: 'current@example.com' }], threads: [
    { id: 'mixed', messages: [emailMessage('old', { From: 'parent@example.com', To: 'office@example.com' }), emailMessage('current', { From: 'parent@example.com', To: 'office@example.com' })].map((message, index) => ({ ...message, internalDate: String(Date.parse(index ? '2026-10-20T12:00:00Z' : '2026-09-20T12:00:00Z')) })) },
    { id: 'unrelated', messages: [emailMessage('non-lead', { From: 'current@example.com', To: 'office@example.com' })] },
  ] })
  for (const scope of ['summary=1', 'person=person:one']) {
    const response = await h.api.GET(new Request(`https://example.com/api/conversations/email?mailbox=mailbox-one&${scope}&from=2026-10-01&to=2026-10-31`))
    assert.equal(response.status, 200)
    assert.equal(response.body.threads.length, 1)
    assert.deepEqual(Array.from(response.body.threads[0].messages, message => message.id), ['current'])
  }
  assert.equal((await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&person=contact'))).status, 404)
  const older = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&person=person:one&from=2026-09-01&to=2026-09-30'))
  assert.deepEqual(Array.from(older.body.threads[0].messages, message => message.id), ['old'])
  assert.equal((await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&summary=1&from=invalid'))).status, 400)
  const query = new URLSearchParams(h.calls.find(call => call[0] === 'get' && call[1].startsWith('threads?'))[1].split('?')[1]).get('q')
  assert.match(query, /after:\d+ before:\d+/)
  assert.equal(h.calls.filter(call => call[0] === 'send').length, 0)
})

test('genuine outbound messages remain outbound and do not acquire unread flags', async () => {
  const h = routeHarness({ threads: [{ id: 'sent', messages: [emailMessage('out', { From: 'Office <office@example.com>', To: 'parent@example.com' }, ['SENT', 'UNREAD'])] }] })
  const result = await h.api.GET(new Request('https://example.com/api/conversations/email?mailbox=mailbox-one&summary=1'))
  assert.equal(result.body.threads[0].messages[0].direction, 'outbound')
  assert.equal(result.body.threads[0].messages[0].unread, false)
})
