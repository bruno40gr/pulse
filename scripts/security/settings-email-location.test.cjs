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

function render(tab, context = owner) {
  const loaded = { exports: {} }
  let stateIndex = 0
  const states = [tab, context, false]
  const wrapper = ({ children }) => React.createElement('div', null, children)
  const panel = name => function MockPanel() { return React.createElement('section', { 'data-panel': name }, name) }
  const dependencies = {
    react: { ...React, useState: initial => React.useState(stateIndex < states.length ? states[stateIndex++] : initial) },
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
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return renderToStaticMarkup(React.createElement(loaded.exports.default))
}

test('Account precedes Integrations and groups all email panels in their existing order', () => {
  const html = render('account')
  assert.ok(html.indexOf('>Account settings<') < html.indexOf('>Integrations<'))
  const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(panels, ['GmailConnections', 'PersonalEmailSignoff', 'OrganisationEmailSettings', 'EmailSignatureSettings'])
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
})

test('Moving email panels preserves integration and brand permission gates', () => {
  const html = render('account', { ...owner, canManageRoles: false, canManageIntegrations: false, canManageBrand: false })
  assert.ok(html.includes('data-panel="PersonalEmailSignoff"'))
  for (const name of ['GmailConnections', 'OrganisationEmailSettings', 'EmailSignatureSettings']) assert.ok(!html.includes(`data-panel="${name}"`))
  assert.ok(!html.includes('>Integrations<'))
})

test('Account deep links are honored before the role-management default', () => {
  assert.match(source, /if \(requestedTab === 'account'\) setTab\('account'\)/)
})