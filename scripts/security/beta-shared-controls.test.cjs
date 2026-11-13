/* eslint-disable @typescript-eslint/no-require-imports -- Offline component contract tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const root = path.resolve(__dirname, '../..')

function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: id => {
    if (id in dependencies) return dependencies[id]
    if (id === 'react/jsx-runtime') return require(id)
    if (id === 'react') return { ...React, useId: () => 'control-id' }
    if (id.endsWith('.module.css')) return { default: {} }
    if (id === 'lucide-react') return { Check: 'check', X: 'close' }
    throw new Error(`Unexpected dependency: ${id}`)
  } })
  return loaded.exports
}
const tokens = load('lib/tokens.ts')
const dependencies = { '@/lib/tokens': tokens, './ControlButton': { ControlButton: 'button' },
  './Button': { Button: 'button' }, '@/components/ui/ButtonBase': { ButtonBase: 'button' } }
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  return [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)]
}
function text(node) {
  if (node == null) return ''
  if (typeof node !== 'object') return String(node)
  return React.Children.toArray(node.props?.children).map(text).join('')
}

test('action bar preserves default labels and clear action while allowing selection nouns', () => {
  const { TableContextActionBar } = load('components/ui/TableWorkspaceControls.tsx', dependencies)
  let cleared = false
  const props = { selectedCount: 1, actions: [], onClear: () => { cleared = true } }
  assert.match(text(TableContextActionBar(props)), /1 selected/)
  assert.match(text(TableContextActionBar({ ...props, selectionNoun: 'students' })), /1 student selected/)
  const plural = TableContextActionBar({ ...props, selectedCount: 2, selectionNoun: 'students' })
  assert.match(text(plural), /2 students selected/)
  nodes(plural).find(node => node.props['aria-label'] === 'Clear selection').props.onClick()
  assert.equal(cleared, true)
})

test('radio group uses a shared native group and reports the selected option', () => {
  const { RadioOptionGroup } = load('components/ui/RadioOptionGroup.tsx', dependencies)
  let chosen
  const tree = RadioOptionGroup({ label: 'Enrollment', value: 'new',
    options: [{ id: 'new', label: 'New' }, { id: 'existing', label: 'Existing', description: 'Already enrolled' }],
    onChange: value => { chosen = value } })
  const inputs = nodes(tree).filter(node => node.type === 'input')
  assert.equal(tree.type, 'fieldset')
  assert.equal(inputs[0].props.name, inputs[1].props.name)
  assert.equal(inputs[0].props.checked, true)
  assert.equal(inputs[1].props.checked, false)
  assert.ok(inputs[1].props['aria-describedby'])
  inputs[1].props.onChange()
  assert.equal(chosen, 'existing')
})

test('compact tab bubbles are opt-in and step navigation remains opt-in', () => {
  const { Tabs } = load('components/ui/Tabs.tsx', dependencies)
  const props = { activeKey: 'requests', compact: true, onChange() {} }
  assert.equal(text(Tabs({ ...props, items: [{ key: 'requests', label: 'Requests', count: 3 }] })), 'Requests')
  assert.equal(text(Tabs({ ...props, items: [{ key: 'requests', label: 'Requests', count: 3, countAppearance: 'bubble' }] })), 'Requests3')
  const { ModalStepper } = load('components/ui/ModalStepper.tsx', dependencies)
  const stepProps = { steps: ['Details', 'Review'], currentStep: 0 }
  assert.equal(nodes(ModalStepper(stepProps)).filter(node => node.type === 'button').length, 0)
  let step
  nodes(ModalStepper({ ...stepProps, onStepChange: value => { step = value } }))
    .filter(node => node.type === 'button')[1].props.onClick()
  assert.equal(step, 1)
})