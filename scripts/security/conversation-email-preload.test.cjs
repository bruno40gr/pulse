/* eslint-disable @typescript-eslint/no-require-imports -- Offline scheduler queue tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function harness(options = {}) {
  const queued = [], directories = [], pages = []
  let now = Date.parse('2026-10-29T12:00:00Z')
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const load = (file, dependencies) => {
    const loaded = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, Date: Clock, require(id) { assert.ok(id in dependencies, id); return dependencies[id] } })
    return loaded.exports
  }
  const people = [{ profileType: 'lead', email: ' PARENT@example.com ' }, { profileType: 'lead', email: 'parent@example.com' }, { profileType: 'contact', email: 'private@example.com' }, { profileType: 'lead', email: 'invalid' }]
  const range = load('lib/conversation-email-range.ts', {})
  const dependencies = {
    '@/lib/supabase/crm-admin': { crmSupabaseAdmin: { from(table) {
      assert.equal(table, 'gmail_connections')
      const query = { select() { return query }, order() { return query }, async range(start, end) {
        pages.push([start, end])
        return { data: (options.mailboxes || [{ id: 'one', tenant_id: 'tenant' }, { id: 'two', tenant_id: 'tenant' }]).slice(start, end + 1), error: options.fail ? {} : null }
      } }
      return query
    } } },
    '@/lib/conversations-directory': { conversationDirectory: async (...args) => { directories.push(args); return options.empty ? [] : people } },
    '@/lib/conversation-email-range': range,
    './conversations': { validEmail: email => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) },
    './conversation-store': { queueStoredEmailImport: async (...args) => { queued.push(args); if (options.slow) now += 20000 } },
  }
  return { run: load('lib/gmail/conversation-preload.ts', dependencies).preloadConversationEmail, queued, directories, pages, now }
}
test('scheduled preload queues default-month lead history before any browser visit', async () => {
  const h = harness()
  assert.equal(await h.run(h.now + 15000), 2)
  assert.equal(h.directories.length, 1, 'Reuse each tenant directory across mailboxes')
  assert.deepEqual(h.directories[0], ['tenant', false, true])
  assert.deepEqual(Array.from(h.queued[0][2]), ['parent@example.com'])
  assert.equal(new Date(h.queued[0][3].start).toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(new Date(h.queued[0][3].end).toISOString(), '2026-11-01T00:00:00.000Z')
})
test('preload paginates connections and skips tenants without lead addresses', async () => {
  const h = harness({ mailboxes: Array.from({ length: 101 }, (_, i) => ({ id: String(i), tenant_id: 'tenant' })) })
  assert.equal(await h.run(h.now + 15000), 101)
  assert.deepEqual(h.pages, [[0, 99], [100, 199]])
  const empty = harness({ empty: true })
  assert.equal(await empty.run(empty.now + 15000), 0)
})
test('preload respects admission deadline and surfaces queue discovery failures', async () => {
  const h = harness({ slow: true })
  assert.equal(await h.run(h.now + 15000), 1)
  const expired = harness()
  assert.equal(await expired.run(expired.now), 0)
  assert.equal(expired.pages.length, 0)
  const failed = harness({ fail: true })
  await assert.rejects(failed.run(failed.now + 15000), /preload unavailable/)
})