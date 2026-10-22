const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../..')
const pagePath = 'app/dashboard/rsvps/page.tsx'
const shared = ['Button', 'EmptyState', 'FieldLabel', 'FieldValue', 'Notice', 'PageContainer', 'PageHeader', 'SurfacePanel', 'DataGridTable']

function renderPage(workspace, busy = false, error = '') {
  const states = [workspace, busy, error]
  const cache = new Map()
  function load(relative) {
    const filename = path.resolve(root, relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    }).outputText
    function localRequire(id) {
      if (id === 'react' && relative === pagePath) return { ...React, useState: () => [states.shift(), () => {}] }
      if (id === '@/components/ui') return Object.assign({}, ...shared.map(name => load(`components/ui/${name}.tsx`)))
      if (id.endsWith('.module.css')) return {}
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id)
        const resolved = ['.tsx', '.ts', '/index.ts'].map(ext => base + ext).find(file => fs.existsSync(file))
        assert.ok(resolved, `Resolve ${id}`)
        return load(path.relative(root, resolved))
      }
      return require(id)
    }
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, module, module.exports)
    return module.exports
  }
  return renderToStaticMarkup(React.createElement(load(pagePath).default))
}

test('RSVP workspace uses the shared table and dashboard primitives, not bespoke table markup', () => {
  const source = fs.readFileSync(path.join(root, pagePath), 'utf8')
  for (const name of ['ResponsiveDataTable', 'PageContainer', 'PageHeader', 'SurfacePanel', 'FieldLabel', 'FieldValue', 'Notice', 'EmptyState']) {
    assert.ok(source.includes(`<${name}`), `${name} is reused`)
  }
  assert.doesNotMatch(source, /<(?:table|thead|tbody|tr|th|td)\b/)
  assert.doesNotMatch(source, /#[\da-f]{3,8}\b|fontSize:\s*['"]|maxWidth=/i)
})

test('shared table renders guest fields and full-list totals without CRM actions', () => {
  const html = renderPage({ parties: 12, guests: 37, rows: [{ id: 'rsvp-1', name: 'Guest <One>', email: 'guest@example.com', party_size: 3, created_at: '2026-10-22T12:00:00Z' }] })
  assert.match(html, /role="table" aria-label="Grand Opening guest list"/)
  for (const label of ['Name', 'Email', 'Party size', 'Submitted', 'RSVP parties', 'Total guests']) assert.ok(html.includes(label))
  assert.match(html, /Guest &lt;One&gt;/)
  assert.match(html, /guest@example.com/)
  assert.match(html, />12</)
  assert.match(html, />37</)
  assert.match(html, /Export CSV/)
  assert.doesNotMatch(html, /Select all|Add Lead|Create contact/)
})

test('loading uses shared table skeletons and disables actions', () => {
  const html = renderPage(null, true)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="table"/)
  assert.equal((html.match(/disabled=""/g) || []).length, 2)
  assert.doesNotMatch(html, /No RSVPs yet/)
})

test('empty and failed workspaces use shared empty and alert states', () => {
  const empty = renderPage({ parties: 0, guests: 0, rows: [] })
  assert.match(empty, /No RSVPs yet/)
  const failed = renderPage(null, false, 'Access denied')
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Access denied/)
  assert.match(failed, /Guest list unavailable/)
  assert.match(failed, /Refresh to try loading/)
})