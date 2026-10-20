/* eslint-disable @typescript-eslint/no-require-imports -- Isolated component contracts, no provider access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')

function load(file) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: id => {
    if (['react', 'react/jsx-runtime', 'lucide-react'].includes(id)) return require(id)
    if (id === '@/lib/tokens') return load('lib/tokens.ts')
    if (id === './ControlButton') return { ControlButton: ({ kind, ...props }) => React.createElement('button', { ...props, 'data-kind': kind }) }
    throw new Error(`Unexpected dependency ${id}`)
  } })
  return loaded.exports
}

test('shared typography keeps tables and buttons compact with distinct semantic roles', () => {
  const { typography: type } = load('lib/tokens.ts')
  assert.equal(type.sizeXs, '0.6875rem')
  assert.equal(type.sizeSm, '0.75rem')
  assert.equal(type.sizeBase, '0.875rem')
  assert.equal(type.sizeMd, '0.9375rem')
  assert.equal(type.h1.fontSize, type.size3xl)
  assert.equal(type.h2.fontSize, type.sizeLg)
  assert.equal(type.sectionTitle.fontSize, type.sizeXl)
  assert.equal(type.body.fontSize, type.sizeMd)
  assert.equal(type.bodySmall.fontSize, type.sizeBase)
  assert.equal(type.label.fontSize, '0.8125rem')
  assert.equal(type.helper.fontSize, type.sizeSm)
})

test('all notice variants share readable proportions and appropriate live roles', () => {
  const { Notice } = load('components/ui/Notice.tsx')
  for (const [variant, role] of [['warning', 'alert'], ['error', 'alert'], ['success', 'status'], ['info', null]]) {
    const html = renderToStaticMarkup(React.createElement(Notice, { variant, title: 'Update', onDismiss() {} }, 'A longer message that can wrap.'))
    if (role) assert.ok(html.includes(`role="${role}"`))
    assert.ok(html.includes('align-items:center'))
    assert.ok(html.includes('font-size:0.875rem'))
    assert.ok(html.includes('overflow-wrap:anywhere'))
    assert.ok(html.includes('width="20"'))
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Dismiss notification"/)
  }
})

test('notices support contextual dismiss labels and omit dismissal when not supplied', () => {
  const { Notice } = load('components/ui/Notice.tsx')
  const fixed = renderToStaticMarkup(React.createElement(Notice, null, 'Saved'))
  assert.ok(!fixed.includes('<button'))
  const dismissible = renderToStaticMarkup(React.createElement(Notice, { onDismiss() {}, dismissLabel: 'Dismiss placeholder warning' }, 'Complete placeholders'))
  assert.ok(dismissible.includes('aria-label="Dismiss placeholder warning"'))
})