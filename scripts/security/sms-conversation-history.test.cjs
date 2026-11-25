/* eslint-disable @typescript-eslint/no-require-imports -- Execute the actual hook with controlled effects and transport. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')

function harness() {
  const values = [], effects = [], polls = []
  let cursor = 0
  const react = {
    useRef(initial) { const index = cursor++; return values[index] ??= { current: initial } },
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] },
    useEffect(fn, deps) {
      const index = cursor++, previous = effects[index]
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
        previous?.cleanup?.()
        effects[index] = { deps, cleanup: fn() }
      }
    },
  }
  const loaded = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '../../lib/useSmsConversationHistory.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module: loaded, exports: loaded.exports, fetch() {}, require: name => {
      if (name === 'react') return react
      if (name === '@/lib/communication-recipients') return { smsDestination: value => value.replace(/[^\d+]/g, '') }
      if (name === '@/lib/visible-polling') return { startVisiblePolling(load) {
        const controller = new AbortController(), poll = { stopped: false, run: () => load(controller.signal), stop() { poll.stopped = true; controller.abort() } }
        polls.push(poll); return poll
      } }
      throw new Error(name)
    },
  })
  return { polls, render(...args) { cursor = 0; return loaded.exports.useSmsConversationHistory(...args) } }
}
const inbox = [
  { other_phone: '+15555550123', messages: [{ id: 'b', direction: 'inbound', body: 'Reply', created_at: '2026-11-23T12:01:00Z' }, { id: 'a', direction: 'outbound', body: 'Hello', created_at: '2026-11-23T12:00:00Z', status: 'delivered' }] },
  { other_phone: '+15555550123', messages: [{ id: 'a', direction: 'outbound', body: 'Hello', created_at: '2026-11-23T12:00:00Z', status: 'delivered' }] },
  { other_phone: '+15555550124', messages: [{ id: 'c', direction: 'inbound', body: 'Other holder', created_at: '2026-11-23T12:02:00Z' }] },
]

test('history is normalized, deduplicated, chronological, and limited to the selected phone', async () => {
  const h = harness(), requests = []
  const request = async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => inbox } }
  assert.equal(h.render('tenant', '+1 (555) 555-0123', true, 0, request).loading, true)
  await h.polls[0].run()
  const history = h.render('tenant', '+1 (555) 555-0123', true, 0, request)
  assert.deepEqual(Array.from(history.messages, item => item.id), ['a', 'b'])
  assert.equal(history.messages[0].status, 'delivered')
  assert.equal(history.loading, false)
  assert.equal(requests[0].url, '/api/inbox?tenant=tenant')
  assert.ok(requests[0].options.signal)
})

test('switching holder aborts old results and never flashes another holder’s messages', async () => {
  const h = harness()
  let resolve
  const request = () => new Promise(done => { resolve = done })
  h.render('tenant', '+15555550123', true, 0, request)
  const pending = h.polls[0].run()
  const next = h.render('tenant', '+15555550124', true, 0, request)
  assert.equal(h.polls[0].stopped, true)
  assert.equal(next.loading, true)
  assert.equal(next.messages.length, 0)
  resolve({ ok: true, json: async () => inbox })
  await pending
  assert.equal(h.render('tenant', '+15555550124', true, 0, request).messages.length, 0)
})

test('failed history is an explicit error, not a false empty success; retry refresh recovers', async () => {
  const h = harness()
  let fail = true
  const request = async () => ({ ok: !fail, json: async () => fail ? { error: 'History unavailable' } : inbox })
  h.render('tenant', '+15555550123', true, 0, request)
  await h.polls[0].run()
  assert.equal(h.render('tenant', '+15555550123', true, 0, request).error, 'History unavailable')
  fail = false
  h.render('tenant', '+15555550123', true, 1, request)
  await h.polls[1].run()
  assert.equal(h.render('tenant', '+15555550123', true, 1, request).messages.length, 2)
})

test('closed/channel-hidden composers stop polling, retain cached bubbles, and resume when reopened', async () => {
  const h = harness(), request = async () => ({ ok: true, json: async () => inbox })
  h.render('tenant', '+15555550123', true, 0, request)
  await h.polls[0].run()
  const hidden = h.render('tenant', '+15555550123', false, 0, request)
  assert.equal(h.polls[0].stopped, true)
  assert.equal(hidden.messages.length, 2)
  assert.equal(h.polls.length, 1)
  h.render('tenant', '+15555550123', true, 0, request)
  assert.equal(h.polls.length, 2)
})

test('tenant switching never reuses another tenant’s cached history', async () => {
  const h = harness(), request = async () => ({ ok: true, json: async () => inbox })
  h.render('tenant-a', '+15555550123', true, 0, request)
  await h.polls[0].run()
  const switched = h.render('tenant-b', '+15555550123', true, 0, request)
  assert.equal(switched.messages.length, 0)
  assert.equal(switched.loading, true)
  assert.equal(h.polls[0].stopped, true)
  h.render('tenant-b', '', true, 0, request)
  assert.equal(h.polls[1].stopped, true)
  assert.equal(h.polls.length, 2, 'Missing destinations do not start a request')
})