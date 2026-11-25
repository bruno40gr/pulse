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
const base = { options: people, selectedIds: [], mode: 'existing', draft: { firstName: '', lastName: '', email: '', phone: '', birthday: '' }, onSelectionChange() {}, onModeChange() {}, onDraftChange() {} }

test('contact shows relationship underneath; Details stays at two words without exposing search metadata', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  const person = { id: 'parent', name: 'Sam Kim', relationship: 'Parent', status: 'Already added to family', statusReason: 'Already linked to this family', searchText: 'sam@example.invalid 5551234567' }
  let tree = render({ ...base, options: [person] })
  const table = find(tree, 'ResponsiveDataTable')
  assert.deepEqual(Array.from(table.props.columns, column => column.header), ['Select', 'Contact', 'Details'])
  const contact = table.props.columns[1].render(person)
  assert.equal(find(contact, 'PersonName').props.children, 'Sam Kim')
  assert.ok(nodes(contact).some(node => node.props?.children === 'Parent'))
  const details = table.props.columns[2].render(person)
  assert.equal(details.props.children, 'Already added')
  assert.equal(details.props.title, person.statusReason)
  assert.equal(table.props.columns[2].render({ ...person, status: undefined, disabled: true }).props.children, 'Unavailable')
  find(tree, 'Input').props.onChange({ target: { value: '5551234567' } })
  tree = render({ ...base, options: [person] })
  assert.equal(find(tree, 'ResponsiveDataTable').props.rows.length, 1)
  find(tree, 'Input').props.onChange({ target: { value: 'sam@' } })
  assert.equal(find(render({ ...base, options: [person] }), 'ResponsiveDataTable').props.rows.length, 1)
})

test('loading and failure never masquerade as an empty contact list; region remains bounded', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  const loading = render({ ...base, state: 'loading' })
  assert.equal(find(loading, 'ResponsiveDataTable'), undefined)
  const region = nodes(loading).find(node => node.props?.role === 'region')
  assert.equal(region.props['aria-busy'], true)
  assert.equal(region.props.style.overflow, 'auto')
  assert.match(region.props.style.maxHeight, /clamp/)
  assert.equal(region.props.style.height, undefined, 'short results must not reserve a fixed blank area')
  assert.equal(find(render(base), 'ResponsiveDataTable').props.stickyHeaderOffset, 0)
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

test('existing-only relationship selection keeps searchable results without offering creation', () => {
  const render = component('components/contacts/ParticipantPicker.tsx')
  let selected
  const props = { ...base, existingOnly: true, mode: 'new', onSelectionChange: ids => { selected = ids } }
  let tree = render(props)
  assert.equal(find(tree, 'RadioOptionGroup'), undefined)
  assert.equal(find(tree, 'ContactDetailsFields'), undefined)
  find(tree, 'Input').props.onChange({ target: { value: 'ADA@' } })
  tree = render(props)
  const table = find(tree, 'ResponsiveDataTable')
  assert.deepEqual(Array.from(table.props.rows, person => person.id), ['a'])
  table.props.columns[0].render(people[0]).props.onChange()
  assert.deepEqual(Array.from(selected), ['a'])
})

test('family selection reuses the event picker, shows account context and allows cross-account links', () => {
  const source = fs.readFileSync(path.join(root, 'components/contacts/LiveFamilyManagement.tsx'), 'utf8')
  assert.doesNotMatch(source, /<Select|<option|Existing primary routing, billing/)
  assert.equal((source.match(/<ParticipantPicker/g) || []).length, 2)
  assert.match(source, /label="Students to add"/)
  assert.doesNotMatch(source, /selectedStudent|Choose dependent|label="Dependents"/)
  assert.match(source, /kind: managerMode === 'new' \? 'manager-create' : 'manager-link'/)
  assert.match(source, /label="Account holders"/)
  assert.match(source, /linkedIds\.map/)
  assert.match(source, /disabled: members\.some\(member => member\.id === person\.id\)/)
  assert.match(source, /kind: 'link-child', accountId: currentAccountId, personId: existingStudent/)
  assert.match(source, /birthday: ''/)
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
  const fields = find(tree, 'ContactDetailsFields')
  fields.props.onChange('firstName', 'New')
  assert.equal(draft.firstName, 'New')
  assert.equal(find(tree, 'RadioOptionGroup').props.layout, undefined)
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
  tree.props.onDraftChange({ firstName: 'New', lastName: 'Student', email: 'new@example.test', phone: '5551234567', birthday: '2012-03-04' })
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
  assert.equal(calls[1].body.phone, '5551234567')
  assert.equal(calls[1].body.date_of_birth, '2012-03-04')
})

test('shared contact details preserve the reference field order, types and changes', () => {
  const render = component('components/contacts/ContactDetailsFields.tsx')
  const changes = []
  const inputs = nodes(render({ value: base.draft, disabled: true, onChange: (...args) => changes.push(args) })).filter(node => node.type === 'Input')
  assert.deepEqual(inputs.map(node => node.props.label), ['First name', 'Last name', 'Email', 'Phone', 'Birthday'])
  assert.deepEqual(inputs.map(node => node.props.type), [undefined, undefined, 'email', 'tel', 'date'])
  for (const input of inputs) assert.equal(input.props.disabled, true)
  inputs[3].props.onChange({ target: { value: '123' } })
  assert.deepEqual(changes, [['phone', '123']])
})

test('events, band creation and existing-band additions share the actual composition', () => {
  const source = file => fs.readFileSync(path.join(root, file), 'utf8')
  assert.match(source('beta-source/app/content-studio-prototype/event-explorer/WorkflowEditor.tsx'), /<ParticipantPicker/)
  for (const file of ['CreateBandWizard', 'ProductionBandsWorkspace']) assert.match(source(`components/bands/${file}.tsx`), /<BandStudentPicker/)
  const workspace = source('components/bands/ProductionBandsWorkspace.tsx')
  assert.match(workspace, /<Modal isOpen layout="fixed" size="lg"/)
  assert.doesNotMatch(workspace, /Everyone in Contacts is already|No student is currently seeking/)
})