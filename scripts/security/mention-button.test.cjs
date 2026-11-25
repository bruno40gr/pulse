/* eslint-disable @typescript-eslint/no-require-imports -- Isolated editor interactions without providers. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function setup(initial = '', ids = []) {
  const state = []; let cursor = 0; let value = initial; let recipients = ids
  const element = { selectionStart: initial.length, selectionEnd: initial.length, focus() {}, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end } }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
    useEffect() {}, useLayoutEffect() {},
  }
  const stub = name => name
  const imports = { react, 'react/jsx-runtime': require('react/jsx-runtime'), '@/components/ui/ControlButton': { ControlButton: stub('ControlButton') }, '@/components/ui/Button': { Button: stub('Button') }, '@/lib/tokens': { colors: {}, radius: {}, shadows: {}, typography: {} }, '@/lib/tenant': { getActiveTenantId: () => 'school' } }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../components/notes/MentionTextarea.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    module: mod, exports: mod.exports, require: id => { if (!(id in imports)) throw new Error(id); return imports[id] }, requestAnimationFrame: callback => callback(), setTimeout,
  })
  const render = (showMentionButton = true) => { cursor = 0; const tree = mod.exports.default({ value, onChange: next => { value = next }, mentionMembershipIds: recipients, onMentionMembershipIdsChange: next => { recipients = next }, showMentionButton }); find(tree, n => n.type === 'textarea').props.ref.current = element; return tree }
  return { render, element, state, value: () => value, recipients: () => recipients }
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match }
}
test('mention button is opt-in and inserts at cursor without replacing surrounding text', () => {
  const h = setup('Call tomorrow')
  assert.equal(find(h.render(false), n => n.type === 'Button'), undefined)
  h.element.selectionStart = h.element.selectionEnd = 4
  find(h.render(), n => n.type === 'Button').props.onClick()
  assert.equal(h.value(), 'Call @ tomorrow')
  assert.equal(h.element.selectionStart, 6)
})
test('button uses existing selection path, retains recipients and supports repeated mentions', () => {
  const h = setup('Hello ', ['existing'])
  find(h.render(), n => n.type === 'Button').props.onClick()
  // Simulate directory results in the hook harness; use the real picker handler.
  const suggestions = h.state.findIndex(Array.isArray)
  h.state[suggestions] = [{ membership_id: 'cohen', first_name: 'Cohen', last_name: 'Lee' }]
  find(h.render(), n => n.type === 'ControlButton').props.onClick()
  assert.equal(h.value(), 'Hello @Cohen\u00a0Lee ')
  assert.deepEqual(Array.from(h.recipients()), ['existing', 'cohen'])
  find(h.render(), n => n.type === 'Button').props.onClick()
  h.state[suggestions] = [{ membership_id: 'sam', first_name: 'Sam', last_name: 'Kim' }]
  find(h.render(), n => n.type === 'ControlButton').props.onClick()
  assert.deepEqual(Array.from(h.recipients()), ['existing', 'cohen', 'sam'])
  const editor = find(h.render(), n => n.type === 'textarea')
  editor.props.onChange({ target: { value: 'Hello @Sam\u00a0Kim ', selectionStart: 15 } })
  assert.deepEqual(Array.from(h.recipients()), ['existing', 'sam'])
})