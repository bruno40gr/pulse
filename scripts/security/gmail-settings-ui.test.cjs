/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in runner, no browser or provider access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')

function load(file, workspace) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const context = vm.createContext({ module: loaded, exports: loaded.exports, require: id => {
    if (id === 'react' && file === 'components/settings/GmailConnections.tsx' && workspace !== undefined) {
      let stateIndex = 0
      return { ...React, useState: initial => React.useState(stateIndex++ === 0 ? workspace : initial) }
    }
    if (['react', 'react/jsx-runtime', 'lucide-react'].includes(id)) return require(id)
    if (id === '@/lib/tokens') return load('lib/tokens.ts')
    if (id === './ControlButton') return { ControlButton: props => React.createElement('button', { 'aria-label': props['aria-label'], onClick: props.onClick }, props.children) }
    if (id === '@/components/ui') return Object.fromEntries(['Button', 'Notice', 'SectionTitle', 'Select', 'SurfacePanel'].map(name => [name, load(`components/ui/${name}.tsx`)[name]]))
    if (id.startsWith('@/components/ui/')) return load(`${id.replace('@/', '')}.tsx`)
    throw new Error(`Blocked dependency ${id}`)
  } })
  new vm.Script(code).runInContext(context)
  return loaded.exports
}

test('Gmail settings renders shared components with concise copy and settings spacing', () => {
  const GmailConnections = load('components/settings/GmailConnections.tsx', { configured: true, connections: [], review: [], leads: [] }).default
  const { spacing, typography } = load('lib/tokens.ts')
  const html = renderToStaticMarkup(React.createElement(GmailConnections, { tenantId: 'synthetic-tenant' }))
  assert.match(html, /<h2[^>]*>Gmail<\/h2>/)
  assert.ok(html.includes('Connect the mailbox you use to contact leads. Sent emails from the connected account are automatically logged as lead activity and added to the matching lead’s notes.</p>'))
  for (const removed of ['Only Contacted or Booked', 'Read-only access.', 'Historical import is not enabled.']) assert.ok(!html.includes(removed))
  assert.ok(html.includes(`padding:${spacing['3xl']}`))
  assert.ok(html.includes(`font-size:${typography.sizeBase}`))
  assert.ok(html.includes('box-shadow:none'))
  assert.match(html, /<button[^>]*>Connect Google mailbox<\/button>/)
  assert.ok(!html.includes('Gmail connected'))
})

test('connected Gmail matches Twilio status box and standard action buttons', () => {
  const GmailConnections = load('components/settings/GmailConnections.tsx', {
    configured: true,
    connections: [{ id: 'synthetic-connection', email: 'office@example.com', last_synced_at: null, last_error: null, page_token: null }],
    review: [], leads: [],
  }).default
  const { colors, spacing, typography } = load('lib/tokens.ts')
  const html = renderToStaticMarkup(React.createElement(GmailConnections, { tenantId: 'synthetic-tenant' }))
  assert.ok(html.includes('✓ Gmail connected'))
  assert.ok(html.includes('office@example.com'))
  assert.ok(html.includes('Not synced yet'))
  assert.ok(html.includes(`background:${colors.surfaceMuted}`))
  assert.ok(html.includes(`padding:${spacing['2xl']}`))
  assert.ok(!html.includes('>Connect Google mailbox</button>'))
  assert.ok(!html.includes('Capture starts now;'))
  for (const label of ['Sync now', 'Reconnect', 'Disconnect']) {
    const button = html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0]
    assert.ok(button, label)
    assert.ok(button.includes(`font-size:${typography.sizeBase}`), label)
  }
  assert.ok(html.includes('Connect another mailbox'))
})

test('loading Gmail does not offer a duplicate connection before data arrives', () => {
  const GmailConnections = load('components/settings/GmailConnections.tsx').default
  const html = renderToStaticMarkup(React.createElement(GmailConnections, { tenantId: 'synthetic-tenant' }))
  assert.ok(html.includes('Loading…'))
  assert.ok(!html.includes('Connect Google mailbox'))
})