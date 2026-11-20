/* eslint-disable @typescript-eslint/no-require-imports -- Offline rendering and shared UI regression contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')

function load(file) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(source(file), { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: name => {
    if (name === 'react/jsx-runtime') return require(name)
    if (name === '@/lib/tokens') return { colors: { border: '#ddd', borderLight: '#eee' }, spacing: {}, radius: {}, typography: {} }
    if (name.endsWith('.module.css')) return { default: { block: 'skeleton' } }
    if (name === '@/components/ui/Badge') return { Badge: ({ children }) => React.createElement('span', null, children) }
    throw new Error(`Unexpected dependency ${name}`)
  } })
  return loaded.exports
}

test('skeleton announces loading once, hides placeholder geometry and supports reduced motion', () => {
  const { LoadingSkeleton } = load('components/ui/LoadingSkeleton.tsx')
  const html = renderToStaticMarkup(React.createElement(LoadingSkeleton, { label: 'Loading campaigns', variant: 'cards', rows: 2 }))
  assert.match(html, /role="status" aria-label="Loading campaigns" aria-busy="true"/)
  assert.equal((html.match(/aria-hidden="true"/g) || []).length, 2)
  assert.doesNotMatch(html, />Loading/)
  assert.match(source('components/ui/LoadingSkeleton.module.css'), /prefers-reduced-motion: reduce/)
})

test('bands keep table geometry while campaigns keep card geometry during loading', () => {
  const bands = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(bands, /<ResponsiveDataTable loading=\{bandsState === 'loading'\}/)
  assert.doesNotMatch(bands, /<p role="status">Loading bands/)
  for (const file of ['components/campaigns/EmailCampaignHistory.tsx', 'app/dashboard/history/page.tsx']) {
    const code = source(file)
    assert.match(code, /<LoadingSkeleton label="Loading (email|SMS) campaigns" variant="cards"/)
    assert.doesNotMatch(code, /<p role="status">Loading/)
  }
})

test('expanded campaign cards retain their neutral border and keyboard actions belong to the card only', () => {
  const { CampaignCard } = load('components/campaigns/CampaignCard.tsx')
  const props = { headline: 'Campaign', status: { label: 'Sent', variant: 'success' }, date: 'Nov 20', stats: [] }
  const collapsed = renderToStaticMarkup(React.createElement(CampaignCard, props))
  const expanded = renderToStaticMarkup(React.createElement(CampaignCard, { ...props, selected: true }))
  assert.equal(expanded, collapsed)
  assert.match(source('components/campaigns/CampaignCard.tsx'), /event.target === event.currentTarget/)
  assert.match(source('components/campaigns/CampaignCard.tsx'), /closest\('button, a, input, select, textarea/)
})

test('multiselect escapes table overflow but remains inside the active dialog focus boundary', () => {
  const code = source('components/ui/MultiSelect.tsx')
  assert.match(code, /createPortal\(/)
  assert.match(code, /position: 'fixed'/)
  assert.match(code, /closest\('\[role="dialog"\]'\) \|\| document.body/)
  assert.match(code, /!menu.current\?\.contains\(event.target as Node\)/)
  assert.match(code, /window.addEventListener\('scroll', place, true\)/)
  assert.doesNotMatch(code, /appearance === 'field' \? \{ border/)
  const workspace = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(workspace, /style=\{\{ border: 'none', borderRadius: 0 \}\} rows=\{band.members\}/)
})