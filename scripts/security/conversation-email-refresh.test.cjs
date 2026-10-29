/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic polling with fake timers, no browser/network. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const moduleRef = { exports: {} }
const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/conversation-email-refresh.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new vm.Script(code).runInNewContext({ module: moduleRef, exports: moduleRef.exports })
const { startStoredEmailRefresh } = moduleRef.exports
const settle = () => new Promise(resolve => setImmediate(resolve))
function polling(load, visible = () => true) {
  let tick, cancelled = false
  const stop = startStoredEmailRefresh({ load, visible, schedule(callback, interval) { assert.equal(interval, 15000); tick = callback; return () => { cancelled = true } } })
  return { tick: () => tick(), stop, cancelled: () => cancelled }
}

test('stored detail polling refreshes quietly without overlapping requests and stops on cleanup', async () => {
  const calls = []
  let finish
  const p = polling(quiet => { calls.push(quiet); return new Promise(resolve => { finish = resolve }) })
  p.tick(); p.tick()
  assert.equal(calls.length, 1)
  finish(true); await settle()
  p.tick()
  assert.deepEqual(calls, [false, true])
  p.stop(); finish(true); await settle(); p.tick()
  assert.equal(calls.length, 2)
  assert.equal(p.cancelled(), true)
})

test('legacy detail never polls Gmail after the initial load', async () => {
  let calls = 0
  const p = polling(async () => { calls++; return false })
  await settle(); p.tick(); await settle()
  assert.equal(calls, 1)
  p.stop()
})

test('hidden documents pause reads and resume when visible', async () => {
  let visible = false, calls = 0
  const p = polling(async () => { calls++; return true }, () => visible)
  await settle(); p.tick(); assert.equal(calls, 0)
  visible = true; p.tick(); await settle(); assert.equal(calls, 1)
  visible = false; p.tick(); assert.equal(calls, 1)
  p.stop()
})

test('a temporary stored read error preserves polling and retries on the next tick', async () => {
  let calls = 0
  const p = polling(async () => { calls++; if (calls === 2) throw Error('temporary'); return true })
  await settle(); p.tick(); await settle(); p.tick(); await settle()
  assert.equal(calls, 3)
  p.stop()
})

test('history freshness feedback distinguishes stale updates from import progress and reconnect', () => {
  const loaded = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/conversation-email-status.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new vm.Script(output).runInNewContext({ module: loaded, exports: loaded.exports })
  const status = loaded.exports.conversationEmailStatus
  assert.equal(status('complete'), '')
  assert.equal(status(''), '')
  assert.match(status('stale'), /updates are behind/)
  assert.match(status('pending'), /Importing/)
  assert.match(status('reconnect'), /Reconnect/)
  assert.match(status('delayed'), /delayed/)
})