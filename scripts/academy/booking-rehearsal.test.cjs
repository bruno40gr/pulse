/* eslint-disable @typescript-eslint/no-require-imports -- Matches the local TypeScript VM harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const output = {}
  cache.set(file, output)
  const localRequire = name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) })
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = ['.ts', '.tsx', ''].map(ext => base + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return load(resolved)
    }
    return require(name)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports: output, require: localRequire }, { filename: file, timeout: 1000 })
  return output
}
const { createRehearsalRequests: fixtures, advanceRehearsal: step, rehearsalPrice, rehearsalSlots } = load(path.join(root, 'lib/academy-booking-rehearsal.ts'))
const ready = () => ({ ...fixtures()[0], slot: rehearsalSlots[0], termsReviewed: true })

test('fixtures separate submitted requests from a missing-card draft', () => {
  const items = fixtures()
  assert.equal(items.length, 3)
  assert.equal(items[0].state.status, 'awaiting_confirmation')
  assert.equal(items[2].state.status, 'draft')
  assert.throws(() => step(items[2], { type: 'submit', cardReady: true }), /ready card/)
})
test('approval requires resolved identity, an agreed fixture slot, and reviewed terms', () => {
  for (const patch of [{ identityResolved: false }, { slot: '' }, { slot: 'unverified-slot' }, { termsReviewed: false }]) {
    assert.throws(() => step({ ...ready(), ...patch }, { type: 'approve' }), /Resolve identity/)
  }
})
test('unresolved matching identities do not receive teacher pricing', () => {
  assert.equal(rehearsalPrice(ready()), 25)
  assert.equal(rehearsalPrice({ ...ready(), identityResolved: false }), 50)
  assert.equal(rehearsalPrice(fixtures()[1]), 50)
})
test('approved rehearsal can fail payment, retry, and confirm only on success', () => {
  let request = step(ready(), { type: 'approve' })
  assert.equal(request.state.status, 'pending_payment')
  request = step(request, { type: 'start_payment', attemptId: 'demo-1' })
  request = step(request, { type: 'payment_failed', attemptId: 'demo-1' })
  assert.equal(request.state.status, 'pending_payment')
  request = step(request, { type: 'start_payment', attemptId: 'demo-2' })
  request = step(request, { type: 'payment_succeeded', attemptId: 'demo-2' })
  assert.equal(request.state.status, 'confirmed')
  assert.equal(request.history.length, 6)
})
test('missing-card scenario can simulate readiness before submission', () => {
  const request = step({ ...fixtures()[2], cardReady: true }, { type: 'submit', cardReady: true })
  assert.equal(request.state.status, 'awaiting_confirmation')
})
test('rejection and resetting fixtures do not mutate previous local state', () => {
  const original = fixtures()[0]
  const rejected = step(original, { type: 'reject' })
  assert.equal(rejected.state.status, 'rejected')
  assert.equal(original.history.length, 1)
  assert.equal(fixtures()[0].state.status, 'awaiting_confirmation')
})
test('prototype renders its fictional queue, safety notice, and approval blockers', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Component = load(path.join(root, 'app/content-studio-prototype/booking-requests/BookingRequestRehearsal.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Component))
  for (const text of ['Local rehearsal', 'Avery Lane', 'Sam Reed', 'Morgan Quinn', 'STUDENT STATUS PREVIEW', 'Nothing is saved or sent', '$25.00', 'Simulate staff approval']) assert.ok(html.includes(text), text)
  assert.match(html, /disabled=""[^>]*>Simulate staff approval/)
})