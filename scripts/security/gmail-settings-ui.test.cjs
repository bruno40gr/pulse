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

function load(file, workspace, runtime) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const context = vm.createContext({ ...runtime?.globals, module: loaded, exports: loaded.exports, require: id => {
    if (id === 'react' && runtime) return runtime.react
    if (id === 'react' && file === 'components/settings/GmailConnections.tsx' && workspace !== undefined) {
      let stateIndex = 0
      return { ...React, useState: initial => React.useState(stateIndex++ === 0 ? workspace : initial) }
    }
    if (['react', 'react/jsx-runtime', 'lucide-react'].includes(id)) return require(id)
    if (id === '@/lib/tokens') return load('lib/tokens.ts')
    if (id === './ControlButton') return { ControlButton: props => React.createElement('button', { 'aria-label': props['aria-label'], onClick: props.onClick }, props.children) }
    if (id === '@/components/ui') return { ...Object.fromEntries(['Button', 'Notice', 'SectionTitle', 'Select', 'SurfacePanel'].map(name => [name, load(`components/ui/${name}.tsx`)[name]])), Modal: ({ isOpen, children }) => isOpen ? React.createElement('div', { role: 'dialog' }, children) : null, ModalBody: ({ children }) => React.createElement('div', null, children), ModalFooter: ({ children }) => React.createElement('div', null, children), ModalHeader: ({ title }) => React.createElement('h2', null, title) }
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
  assert.match(html, /<h2[^>]*>Connect Business email<\/h2>/)
  assert.ok(html.includes('This will allow us to send and receive email from your email provider.'))
  assert.ok(!html.includes('When you do that, Google will ask you to allow us to:'))
  assert.ok(!html.includes('<strong>Read email:</strong>'))
  assert.ok(!html.includes('<strong>Send email:</strong>'))
  assert.ok(!html.includes('Connecting your account does not send any emails.'))
  assert.ok(html.includes(`font-size:${typography.body.fontSize}`))
  for (const removed of ['Only Contacted or Booked', 'Read-only access.', 'Historical import is not enabled.']) assert.ok(!html.includes(removed))
  assert.ok(html.includes(`padding:${spacing['3xl']}`))
  assert.ok(html.includes(`font-size:${typography.sizeBase}`))
  assert.ok(html.includes('box-shadow:none'))
  assert.match(html, /<button[^>]*>Connect with Google<\/button>/)
  assert.ok(!html.includes('Gmail connected'))
})

test('connected Gmail matches Twilio status box and standard action buttons', () => {
  const GmailConnections = load('components/settings/GmailConnections.tsx', {
    configured: true,
    connections: [{ id: 'synthetic-connection', email: 'office@example.com', last_synced_at: null, last_error: null, page_token: null, scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] }],
    review: [], leads: [],
  }).default
  const { colors, spacing, typography } = load('lib/tokens.ts')
  const html = renderToStaticMarkup(React.createElement(GmailConnections, { tenantId: 'synthetic-tenant' }))
  assert.ok(html.includes('✓ Gmail connected'))
  assert.ok(html.includes('read and send access'))
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

test('read-only mailbox is not presented as ready for sending', () => {
  const GmailConnections = load('components/settings/GmailConnections.tsx', {
    configured: true,
    connections: [{ id: 'connection', email: 'office@example.com', scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }],
    review: [], leads: [],
  }).default
  const html = renderToStaticMarkup(React.createElement(GmailConnections, { tenantId: 'synthetic-tenant' }))
  assert.ok(html.includes('Gmail connection needs authorization — read and send access required'))
  assert.ok(!html.includes('✓ Gmail connected'))
})

test('OAuth error is shown once, then removed from the URL without changing the settings tab', async () => {
  let href = 'https://example.com/dashboard/settings?tab=account&gmail=error&gmail_error=session#email'
  const errors = []
  const effects = []
  const replacements = []
  const state = { existing: 'navigation state' }
  const runtime = {
    globals: {
      URL, URLSearchParams,
      window: {
        location: { get href() { return href }, get search() { return new URL(href).search } },
        history: { state, replaceState(value, title, url) { replacements.push({ value, url }); href = new URL(url, href).href } },
      },
      fetch: async () => ({ ok: true, json: async () => ({ configured: true, connections: [], review: [], leads: [] }) }),
    },
    react: {
      useState: (() => { let index = 0; return initial => [initial, index++ === 1 ? value => errors.push(value) : () => {}] })(),
      useCallback: callback => callback,
      useEffect: callback => effects.push(callback),
    },
  }
  const Component = load('components/settings/GmailConnections.tsx', undefined, runtime).default
  Component({ tenantId: 'tenant' })
  effects[0]()
  await new Promise(resolve => setImmediate(resolve))
  assert.match(errors[0], /connection session expired/)
  assert.equal(replacements.length, 1)
  assert.equal(replacements[0].value, state)
  assert.equal(replacements[0].url, '/dashboard/settings?tab=account#email')
  errors.length = 0
  effects[0]()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(errors, [])
  assert.equal(replacements.length, 1)
})

test('disconnect confirmation explains the result without Google permission jargon', () => {
  const source = fs.readFileSync(path.join(root, 'components/settings/GmailConnections.tsx'), 'utf8')
  assert.match(source, /This app will stop sending and syncing email with this mailbox/)
  assert.match(source, /Your existing lead notes will not be deleted/)
  assert.doesNotMatch(source, /Google grant|Remove Pulse access/)
})

test('disconnect flushes previous connection errors and returns to a clean connect prompt', async () => {
  const workspace = { configured: true, connections: [{ id: 'mailbox', email: 'office@example.com', scopes: [] }], review: [], leads: [] }
  const states = [workspace, 'Old connection error', 'Old message', false, {}, false]
  let stateIndex = 0
  let href = 'https://example.com/dashboard/settings?tab=account&gmail=error&gmail_error=session'
  const calls = []
  const runtime = {
    globals: {
      URL, URLSearchParams,
      window: {
        confirm: () => true,
        location: { get href() { return href } },
        history: { state: null, replaceState(state, title, url) { href = new URL(url, href).href } },
      },
      fetch: async (url, options) => {
        calls.push(options?.method || 'GET')
        return { ok: true, json: async () => options?.method === 'POST' ? { ok: true } : { ...workspace, connections: [] } }
      },
    },
    react: {
      useState: () => { const index = stateIndex++; return [states[index], value => { states[index] = value }] },
      useCallback: callback => callback,
      useEffect: () => {},
    },
  }
  const Component = load('components/settings/GmailConnections.tsx', undefined, runtime).default
  function findDisconnect(node) {
    if (!node || typeof node !== 'object') return null
    if (node.props?.children === 'Disconnect') return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = findDisconnect(child)
      if (found) return found
    }
    return null
  }
  findDisconnect(Component({ tenantId: 'tenant' })).props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, ['POST', 'GET'])
  assert.equal(states[1], '')
  assert.equal(states[2], '')
  assert.equal(href, 'https://example.com/dashboard/settings?tab=account')
  stateIndex = 0
  const html = renderToStaticMarkup(Component({ tenantId: 'tenant' }))
  assert.match(html, /Connect with Google/)
  assert.doesNotMatch(html, /Old connection error|Old message|Mailbox settings updated/)
})