/* eslint-disable @typescript-eslint/no-require-imports -- Isolated settings rendering; no network or database access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'app/dashboard/settings/page.tsx'), 'utf8')
const owner = { canManageRoles: true, canManageIntegrations: true, canManageBrand: true, canAccessDesignSystem: false, canUpdateCredentials: false, email: 'owner@example.com' }

function render(tab, context = owner, runtime = {}) {
  const loaded = { exports: {} }
  let stateIndex = 0
  const states = [tab, context, false]
  const wrapper = ({ children }) => React.createElement('div', null, children)
  const panel = name => function MockPanel() { return React.createElement('section', { 'data-panel': name }, name) }
  const dependencies = {
    react: { ...React, useState: initial => {
      const index = stateIndex++
      const [value, setValue] = React.useState(index < states.length ? states[index] : initial)
      return [value, next => { if (index === 0) runtime.onTab?.(next); setValue(next) }]
    }, ...(runtime.effects ? { useEffect: effect => runtime.effects.push(effect) } : {}) },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: wrapper },
    '@/lib/tenant': { getActiveTenantId: () => 'synthetic-tenant', getTenantBrand: () => ({}) },
    '@/components/ui': { Button: wrapper, PageContainer: wrapper, PageHeader: () => null },
    '@/components/ui/ControlButton': { ControlButton: ({ children }) => React.createElement('button', null, children) },
    '@/components/access/AccessManagementClient': { default: panel('access') },
    '@/lib/supabase/client': { createClient: () => { throw new Error('No auth calls expected') } },
    '@/lib/display-preferences': {},
    '@/lib/tokens': { colors: {}, typography: { body: {}, h2: {}, helper: {} }, radius: {}, spacing: {} },
  }
  for (const name of ['GmailConnections', 'PersonalEmailSignoff', 'OrganisationEmailSettings', 'EmailSignatureSettings']) {
    dependencies[`@/components/settings/${name}`] = { default: panel(name) }
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, URLSearchParams, window: { location: { search: runtime.search || '' } }, fetch: async () => ({ ok: true, json: async () => context }), require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return renderToStaticMarkup(React.createElement(loaded.exports.default))
}

test('Account precedes Integrations and groups all email panels in their existing order', () => {
  const html = render('account')
  assert.ok(html.indexOf('>Account settings<') < html.indexOf('>Integrations<'))
  const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(panels, ['GmailConnections', 'EmailSignatureSettings', 'OrganisationEmailSettings'])
  assert.ok(!html.includes('data-panel="PersonalEmailSignoff"'))
  assert.ok(html.includes('Email &amp; password'))
})

test('Integrations retains Twilio without any email panels', () => {
  const html = render('integrations')
  assert.ok(html.includes('Twilio'))
  assert.ok(!html.includes('data-panel='))
})

test('Brand no longer contains shared email signature settings', () => {
  const html = render('brand')
  assert.ok(html.includes('Logo'))
  assert.ok(!html.includes('data-panel='))
  assert.ok(html.includes('Logo on white'))
  assert.ok(html.includes('Logo on dark'))
  assert.ok(html.includes('We recommend adding two versions'))
  assert.ok(!html.includes('file upload is coming later'))
})

test('Moving email panels preserves integration and brand permission gates', () => {
  const html = render('account', { ...owner, canManageRoles: false, canManageIntegrations: false, canManageBrand: false })
  assert.ok(html.includes('data-panel="EmailSignatureSettings"'))
  for (const name of ['GmailConnections', 'OrganisationEmailSettings']) assert.ok(!html.includes(`data-panel="${name}"`))
  assert.ok(!html.includes('>Integrations<'))
})

test('Settings defaults to Account after access loads and preserves only authorised deep links', async () => {
  for (const [search, context, expected] of [
    ['', owner, 'account'],
    ['?tab=account', owner, 'account'],
    ['?tab=roles', owner, 'roles'],
    ['?tab=permissions', owner, 'permissions'],
    ['?tab=integrations', owner, 'integrations'],
    ['?tab=brand', owner, 'brand'],
    ['?tab=unknown', owner, 'account'],
    ['?tab=roles', { ...owner, canManageRoles: false }, 'account'],
    ['?tab=permissions', { ...owner, canManageRoles: false }, 'account'],
    ['?tab=integrations', { ...owner, canManageIntegrations: false }, 'account'],
    ['?tab=brand', { ...owner, canManageBrand: false }, 'account'],
  ]) {
    const effects = [], tabs = []
    render('account', context, { search, effects, onTab: tab => tabs.push(tab) })
    effects[0]()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(tabs, [expected], search || 'no requested tab')
  }
})