/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic editor interactions; no network or data writes. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, imports = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module: mod, exports: mod.exports, Error, require: name => { if (!(name in imports)) throw new Error(name); return imports[name] } })
  return mod.exports
}
function setup(overrides = {}) {
  const state = []; let cursor = 0; let closed = 0
  const writes = []
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = next }] },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
  }
  const { FollowUpModal } = load('components/follow-ups/FollowUpModal.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'),
    '@/components/ui': Object.fromEntries(['Button', 'FieldGrid', 'Input', 'Notice', 'Select', 'Textarea'].map(name => [name, name])),
    '@/components/ui/Modal': Object.fromEntries(['Modal', 'ModalHeader', 'ModalBody', 'ModalFooter'].map(name => [name, name])),
    '@/lib/lead-bulk-follow-up': load('lib/lead-bulk-follow-up.ts'),
    '@/lib/tokens': { spacing: {}, typography: {} },
  })
  const props = { name: 'Synthetic contact', date: '2026-12-01', reminder: 'Call after school', hasFollowUp: true, onDraftChange: draft => { props.date = draft.date; props.reminder = draft.reminder }, onSave: async patch => { writes.push(patch); return true }, onClose: () => { closed++ }, ...overrides }
  return { render() { cursor = 0; return FollowUpModal(props) }, writes, props, closed: () => closed }
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.leading, node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match }
}
const button = (tree, text) => find(tree, node => node.type === 'Button' && node.props.children === text)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('opening/canceling never writes; field and quick-pick changes retain reminder', () => {
  const h = setup(); let tree = h.render()
  assert.equal(h.writes.length, 0)
  find(tree, n => n.type === 'Select').props.onChange({ target: { value: 'tomorrow' } })
  assert.match(h.props.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(h.props.reminder, 'Call after school')
  tree = h.render(); button(tree, 'Cancel').props.onClick()
  assert.equal(h.closed(), 1); assert.equal(h.writes.length, 0)
})
test('empty form permits an attempted save and explains the missing date without writing', async () => {
  const h = setup({ date: '', reminder: '' })
  assert.equal(button(h.render(), 'Save follow-up').props.disabled, false)
  assert.equal(find(h.render(), n => n.type === 'Notice'), undefined)
  find(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await tick()
  assert.match(find(h.render(), n => n.type === 'Notice').props.children, /Choose a follow-up date/)
  assert.equal(h.writes.length, 0)
})
test('save retains existing payload contract and clear remains distinct from completion', async () => {
  const h = setup()
  find(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  await tick()
  assert.equal(h.writes[0].follow_up_at, new Date('2026-12-01T12:00:00').toISOString())
  assert.equal(h.writes[0].follow_up_note, 'Call after school')
  assert.equal(h.closed(), 1)
  const clear = setup(); button(clear.render(), 'Clear follow-up').props.onClick(); await tick()
  assert.equal(clear.writes[0].follow_up_at, null); assert.equal(clear.writes[0].follow_up_note, null)
})
test('failed save retains draft and modal; invalid dates never reach persistence', async () => {
  const h = setup({ onSave: async () => false })
  find(h.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await tick()
  assert.equal(h.closed(), 0); assert.equal(h.props.reminder, 'Call after school')
  assert.match(find(h.render(), n => n.type === 'Notice').props.children, /draft is retained/)
  const invalid = setup({ date: '2026-02-31' })
  find(invalid.render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await tick()
  assert.equal(invalid.writes.length, 0)
  assert.match(find(invalid.render(), n => n.type === 'Notice').props.children, /valid follow-up date/)
})
test('pending writes prevent duplicate submissions and closing', async () => {
  let resolve; let writes = 0
  const h = setup({ onSave: () => { writes++; return new Promise(done => { resolve = done }) } })
  const tree = h.render()
  const form = find(tree, n => n.type === 'form')
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} })
  h.render().props.onClose()
  assert.equal(writes, 1); assert.equal(h.closed(), 0)
  assert.equal(h.render().props.closeOnEscape, false)
  resolve(true); await tick(); assert.equal(h.closed(), 1)
})