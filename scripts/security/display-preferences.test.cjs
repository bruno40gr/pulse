/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser preference tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
function load(stored, blocked = false) {
  const loaded = { exports: {} }
  const document = { documentElement: { style: {} } }
  const storage = { getItem() { if (blocked) throw Error('blocked'); return stored }, setItem() { if (blocked) throw Error('blocked') } }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/display-preferences.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, window: { localStorage: storage }, document })
  return { ...loaded.exports, document }
}
test('missing, blank, invalid and unavailable preferences retain the 16px default', () => {
  for (const stored of [null, '', ' ', 'invalid']) assert.equal(load(stored).readDisplayFontSize(), 16)
  assert.equal(load(null, true).readDisplayFontSize(), 16)
})
test('saved sizing is respected, bounded and applied even without writable storage', () => {
  assert.equal(load('18').readDisplayFontSize(), 18)
  assert.equal(load('30').readDisplayFontSize(), 20)
  assert.equal(load('10').readDisplayFontSize(), 14)
  const preferences = load(null, true)
  preferences.applyDisplayFontSize(18)
  assert.equal(preferences.document.documentElement.style.fontSize, '18px')
})