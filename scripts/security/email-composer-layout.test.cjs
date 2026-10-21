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

test('email actions are top-right, preview is beside templates, and obsolete controls are absent', () => {
  const email = read('components/inbox/PrototypeEmailComposer.tsx')
  const sms = read('components/campaigns/ComposePanel.tsx')
  assert.ok(sms.includes('<ComposerFooter'))
  assert.ok(!email.includes('ComposerFooter'))
  const actions = email.slice(email.indexOf('<div aria-label="Email actions"'), email.indexOf('<EmailComposerFields'))
  assert.ok(actions.includes("justifyContent: 'flex-end'"))
  assert.ok(actions.includes('<Send size={14} />{sendLabel}'))
  assert.ok(!email.includes('Save as draft'))
  assert.ok(!email.includes('Discard draft'))
  assert.ok(!email.includes('Draft {replying'))
  assert.ok(email.indexOf('triggerLabel="Use template"') < email.indexOf('>{mode ==='))
  assert.match(email, /aria-pressed=\{mode === 'preview'\}/)
  assert.match(email, /setMode\(mode === 'preview' \? 'write' : 'preview'\)/)
  const conversations = read('components/inbox/Conversations.tsx')
  assert.ok(!conversations.includes('>Refresh email<'))
  assert.ok(!conversations.includes('>Load more emails<'))
  assert.ok(!email.includes('<SurfacePanel'))
  assert.ok(!sms.includes('<SurfacePanel style={{ borderRadius: radius.lg'))
  assert.match(read('components/inbox/EmailComposer.module.css'), /background:\s*#ffffff/)
  const footer = read('components/ui/ComposerFooter.tsx')
  assert.ok(footer.includes("marginTop: 'auto'"))
  assert.ok(footer.includes("justifyContent: 'flex-end'"))
  assert.ok(footer.includes("marginLeft: 'auto'"))
})

test('contact, staff and inbox compose drawers use the same width contract', () => {
  for (const file of ['app/dashboard/contacts/page.tsx', 'app/dashboard/staff/page.tsx', 'components/inbox/ComposeModal.tsx', 'components/inbox/ConversationComposeLink.tsx']) {
    assert.ok(read(file).includes('width={PROFILE_PANEL_WIDTH}'), file)
  }
  const workspace = read('components/inbox/Conversations.tsx')
  assert.ok(workspace.includes("flex: 1, border: 0, borderRadius: 0, boxShadow: 'none'"))
  assert.ok(workspace.includes('padding: embedded ? 0 :'))
})