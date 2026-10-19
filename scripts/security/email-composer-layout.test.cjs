/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI layout contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function load(file) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: id => {
    if (['react', 'react/jsx-runtime'].includes(id)) return require(id)
    if (id === '@/lib/tokens') return load('lib/tokens.ts')
    if (id === '@/components/ui/Input') return load('components/ui/Input.tsx')
    throw new Error(`Unexpected dependency ${id}`)
  } })
  return loaded.exports
}

test('envelope fields share label styling and an inline, accessible subject input', () => {
  const { EmailComposerFields } = load('components/inbox/EmailComposerFields.tsx')
  const html = renderToStaticMarkup(React.createElement(EmailComposerFields, {
    from: 'Bruno <preview@example.com>', recipients: [{ label: 'To', content: 'Adrian' }, { label: 'Cc', content: 'Alex' }],
    subject: 'Lesson availability', onSubjectChange() {},
  }))
  const labels = [...html.matchAll(/<(?:span|label)[^>]*style="([^"]+)"[^>]*>(From|To|Cc|Subject)<\/(?:span|label)>/g)]
  assert.equal(labels.length, 4)
  assert.equal(new Set(labels.map(match => match[1])).size, 1)
  assert.ok(html.includes('grid-template-columns:4rem minmax(0, 1fr)'))
  assert.ok(html.includes('for="prototype-email-subject"'))
  assert.ok(html.includes('id="prototype-email-subject"'))
  assert.ok(!html.includes('min-width:120px'))
})

test('writing area is visible when empty and signature is bottom aligned, not fixed-height', () => {
  const source = read('components/inbox/PrototypeEmailComposer.tsx')
  const css = read('components/inbox/EmailComposer.module.css')
  assert.ok(source.includes('aria-placeholder="Write your message…"'))
  assert.ok(source.includes('className={styles.writingArea}'))
  assert.ok(source.includes('__html: sanitizePrototypeHtml(signatureHtml'))
  assert.ok(!source.includes('<iframe title="Your email signature"'))
  assert.match(css, /\.signature\s*\{[^}]*margin-top:\s*auto/)
  assert.match(css, /\.editor:empty::before/)
  assert.match(css, /\.editor:focus-visible/)
  assert.match(css, /\.writingArea\s*\{[^}]*flex-direction:\s*column/)
})