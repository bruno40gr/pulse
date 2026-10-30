/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic browser timer harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function harness() {
  let now = 0, next = 0
  const timers = new Map(), listeners = { window: new Map(), document: new Map() }
  const target = name => ({
    addEventListener: (type, fn) => listeners[name].set(type, fn),
    removeEventListener: type => listeners[name].delete(type),
  })
  const window = { ...target('window'), setTimeout: (fn, ms) => { const id = ++next; timers.set(id, { at: now + ms, fn }); return id }, clearTimeout: id => timers.delete(id) }
  const document = { ...target('document'), visibilityState: 'visible' }
  const loaded = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../lib/visible-polling.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: loaded, exports: loaded.exports, window, document, Date: { now: () => now }, AbortController })
  const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
  return {
    start: loaded.exports.startVisiblePolling, timers, listeners, settle,
    async advance(ms) {
      const end = now + ms
      while (true) {
        const entry = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!entry) break
        now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); await settle()
      }
      now = end; await settle()
    },
    async visibility(value) { document.visibilityState = value; listeners.document.get('visibilitychange')?.(); await settle() },
    async focus() { listeners.window.get('focus')?.(); await settle() },
  }
}

test('badges refresh once per minute rather than every five seconds', async () => {
  const h = harness(); let calls = 0
  const p = h.start(async () => { calls++ }); await h.settle()
  assert.equal(calls, 1)
  await h.advance(59_999); assert.equal(calls, 1)
  await h.advance(1); assert.equal(calls, 2)
  await h.advance(60_000); assert.equal(calls, 3)
  p.stop(); assert.equal(h.timers.size, 0)
})
test('hidden tabs make no requests and resume once when stale; focus is throttled', async () => {
  const h = harness(); let calls = 0
  const p = h.start(async () => { calls++ }); await h.settle()
  await h.focus(); await h.focus(); assert.equal(calls, 1)
  await h.visibility('hidden'); await h.advance(600_000); assert.equal(calls, 1)
  p.refresh(); await h.settle(); assert.equal(calls, 1)
  await h.visibility('visible'); assert.equal(calls, 2)
  await h.focus(); assert.equal(calls, 2)
  p.stop(); assert.equal(h.listeners.window.size + h.listeners.document.size, 0)
})
test('actions during a request coalesce into one non-overlapping refresh', async () => {
  const h = harness(); let calls = 0, finish
  const p = h.start(() => { calls++; return new Promise(resolve => { finish = resolve }) })
  p.refresh(); p.refresh(); p.refresh(); await h.advance(5000); assert.equal(calls, 1)
  finish(); await h.settle(); assert.equal(calls, 2)
  finish(); await h.settle(); assert.equal(calls, 2)
  p.refresh(); assert.equal(calls, 3)
  p.stop(); finish(); await h.settle(); assert.equal(h.timers.size, 0)
})
test('timeouts abort requests; failures retry later without a tight loop', async () => {
  const h = harness(); let signal, calls = 0
  const p = h.start(s => { signal = s; calls++; return new Promise((resolve, reject) => s.addEventListener('abort', () => reject(new Error('aborted')))) })
  await h.advance(10_000); assert.equal(signal.aborted, true); assert.equal(calls, 1)
  await h.advance(60_000); assert.equal(calls, 2)
  p.stop(); await h.settle(); assert.equal(h.timers.size, 0)
})
test('sidebar retains event-driven badges and does not install five-second timers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../app/dashboard/layout.tsx'), 'utf8')
  assert.equal((source.match(/startVisiblePolling\(async signal/g) || []).length, 2)
  assert.doesNotMatch(source, /setInterval\(loadCount, 5000\)/)
  assert.match(source, /window.addEventListener\(LEAD_COUNT_EVENT, handleCountChange\)/)
  assert.match(source, /window.addEventListener\(CONVERSATION_COUNT_EVENT, handleCountChange\)/)
  assert.match(source, /setConversationCount\(\(current\) => Math.max\(0, current \+ delta\)\)/)
})