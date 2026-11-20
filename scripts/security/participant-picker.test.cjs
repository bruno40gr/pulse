/* eslint-disable @typescript-eslint/no-require-imports -- Offline component interaction harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

function component(file, fetch) {
  const values = []
  let cursor = 0
  const loaded = { exports: {} }
  const jsx = (type, props) => ({ type, props })
  const dependencies = {
    react: { useId: () => 'test-radio', useState: initial => {
      const index = cursor++
      if (!(index in values)) values[index] = initial
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next }]
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lib/tokens': { spacing: {}, colors: {}, interaction: {} },
    '@/lib/tenant': { getActiveTenantId: () => 'test-tenant' },
  }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, fetch, Set, require: name => dependencies[name] || new Proxy({}, { get: (_, key) => key }) })
  return props => { cursor = 0; return Object.values(loaded.exports)[0](props) }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
}
const find = (tree, type) => nodes(tree).find(node => node.type === type)
const people = [{ id: 'a', name: 'Ada', detail: 'ada@example.test' }, { id: 'b', name: 'Bo', disabled: true }, { id: 'c', name: 'Cy', group: 'Seeking a band' }]
const base = { options: people, selectedIds: [], mode: 'existing', draft: { name: '', email: '' }, onSelectionChange() {}, onModeChange() {}, onDraftChange() {} }

test('loading and failure never masquerade as an empty contact list; region remains bounded', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  const loading = render({ ...base, state: 'loading' })
  assert.equal(find(loading, 'ResponsiveDataTable'), undefined)
  const region = nodes(loading).find(node => node.props?.role === 'region')
  assert.equal(region.props['aria-busy'], true)
  assert.equal(region.props.style.overflow, 'auto')
  assert.match(region.props.style.height, /clamp/)
  const failed = render({ ...base, state: 'error', error: 'Network unavailable' })
  assert.equal(find(failed, 'Notice').props.children, 'Network unavailable')
  assert.equal(find(failed, 'ResponsiveDataTable'), undefined)
})

test('single-selection events use radios and cannot select an already registered person', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  let selected
  const table = find(render({ ...base, onSelectionChange: ids => { selected = ids } }), 'ResponsiveDataTable')
  assert.equal(table.props.selection, undefined)
  const radio = table.props.columns[0].render(people[0])
  assert.equal(radio.props.type, 'radio')
  radio.props.onChange()
  assert.deepEqual(Array.from(selected), ['a'])
  assert.equal(table.props.columns[0].render(people[1]).props.disabled, true)
})

test('multi-selection respects disabled contacts and select-all only affects filtered matches', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  let selected
  const props = { ...base, multiple: true, selectedIds: ['c'], onSelectionChange: ids => { selected = ids } }
  let tree = render(props)
  find(tree, 'Input').props.onChange({ target: { value: 'ada@' } })
  tree = render(props)
  const table = find(tree, 'ResponsiveDataTable')
  assert.equal(table.props.rows.length, 1)
  table.props.selection.onToggleAll()
  assert.deepEqual(Array.from(selected), ['c', 'a'])
  assert.equal(table.props.selection.isSelectable(people[1]), false)
  table.props.selection.onToggle(people[1])
  assert.deepEqual(Array.from(selected), ['c', 'a'])
})

test('new-contact fields are inline and do not discard selected contacts', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  let draft
  const tree = render({ ...base, mode: 'new', selectedIds: ['a'], onDraftChange: value => { draft = value }, onCreate() {} })
  assert.equal(find(tree, 'Modal'), undefined)
  assert.equal(find(tree, 'ResponsiveDataTable'), undefined)
  const input = nodes(tree).find(node => node.props?.label === 'Participant name')
  input.props.onChange({ target: { value: 'New Student' } })
  assert.equal(draft.name, 'New Student')
  assert.equal(find(tree, 'Button').props.disabled, true)
})

test('production new-contact adapter retains errors inline and selects canonical API identity', async () => {
  let fail = true
  const calls = []
  const render = component('components/bands/BandStudentPicker.tsx', async (url, request) => {
    calls.push({ url, body: JSON.parse(request.body) })
    return { ok: !fail, json: async () => fail ? { error: 'Contact already exists' } : { person: { id: 'canonical-person', name: 'New Student' } } }
  })
  let created
  const props = { ...base, state: 'ready', onCreated: person => { created = person } }
  let tree = render(props)
  tree.props.onModeChange('new')
  tree.props.onDraftChange({ name: 'New Student', email: 'new@example.test' })
  tree = render(props)
  await tree.props.onCreate()
  // onCreate is a click callback: flush the async request chain.
  await new Promise(resolve => setImmediate(resolve))
  tree = render(props)
  assert.equal(tree.props.error, 'Contact already exists')
  assert.equal(tree.props.mode, 'new')
  assert.equal(created, undefined)
  fail = false
  tree.props.onCreate()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(created.id, 'canonical-person')
  assert.equal(render(props).props.mode, 'existing')
  assert.equal(calls[1].body.tenant_id, 'test-tenant')
  assert.equal(calls[1].body.last_name, 'Student')
})

test('events, band creation and existing-band additions share the actual composition', () => {
  const source = file => fs.readFileSync(path.join(root, file), 'utf8')
  assert.match(source('beta-source/app/content-studio-prototype/event-explorer/WorkflowEditor.tsx'), /<ParticipantPicker/)
  for (const file of ['CreateBandWizard', 'ProductionBandsWorkspace']) assert.match(source(`components/bands/${file}.tsx`), /<BandStudentPicker/)
  const workspace = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(workspace, /<Modal isOpen layout="fixed" size="lg"/)
  assert.doesNotMatch(workspace, /Everyone in Contacts is already|No student is currently seeking/)
})