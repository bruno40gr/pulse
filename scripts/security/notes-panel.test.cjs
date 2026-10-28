/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic component interaction tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

function setup(props = {}) {
  const state = []; let cursor = 0
  const component = { exports: {} }
  const stub = name => name
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
    useEffect() {},
  }
  const source = fs.readFileSync(path.join(root, 'components/ui/NotesSection.tsx'), 'utf8')
  const imports = {
    react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    './TaskCompletionButton': { TaskCompletionButton: stub('TaskCompletionButton') },
    './DenseSectionPanel': { DenseSectionPanel: stub('DenseSectionPanel') },
    'lucide-react': { Shield: stub('Shield') },
    '@/components/ui': { Button: stub('Button'), Textarea: stub('Textarea') },
    '@/components/notes/MentionTextarea': { default: stub('MentionTextarea') },
    '@/lib/tokens': { colors: {}, typography: {}, radius: {}, spacing: {} },
    '@/lib/note-author': { getNoteAuthorInitials: () => '?' },
    './Avatar': { Avatar: stub('Avatar') },
    '@/lib/staff-avatars': { getStaffAvatarUrl: () => null },
    '@/lib/tenant': { getActiveTenantId: () => 'synthetic' },
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    module: component, exports: component.exports, require: id => { if (!(id in imports)) throw new Error(`Unexpected import: ${id}`); return imports[id] }, Date,
  })
  const render = () => { cursor = 0; return component.exports.NotesSection({ title: 'Notes', notes: [], avatarInitial: 'T', avatarBg: '', cardBg: '', panel: true, onSave: async () => true, ...props }) }
  return { render }
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  const children = [node.props?.actions, ...[node.props?.children].flat(Infinity)]
  for (const child of children) { const match = find(child, predicate); if (match) return match }
}
const button = (tree, label) => find(tree, node => node.type === 'Button' && node.props.children === label)

test('notes card uses header action; history scrolls independently from editor', () => {
  const { render } = setup()
  let tree = render()
  assert.equal(tree.type, 'DenseSectionPanel')
  assert.equal(tree.props.actions.props.children, 'Add a note')
  tree.props.actions.props.onClick()
  tree = render()
  assert.equal(tree.props.actions, undefined)
  const history = find(tree, node => node.props?.['aria-label'] === 'Note history')
  assert.equal(history.props.style.overflowY, 'auto')
  assert.equal(history.props.style.minHeight, 0)
  const editor = find(tree, node => node.props?.style?.order === -1)
  assert.ok(editor)
  assert.equal(editor.props.style.flexShrink, 0)
  assert.ok(find(editor, node => node.type === 'Textarea'))
})

test('failed saves retain draft; success clears it; cancel does not save', async () => {
  let accepted = false; const saved = []; const drafts = []
  const { render } = setup({ draft: 'Keep this', onDraftChange: text => drafts.push(text), onSave: async text => { saved.push(text); return accepted } })
  let tree = render(); tree.props.actions.props.onClick(); tree = render()
  button(tree, 'Save note').props.onClick()
  // Flush async continuations across the isolated VM context.
  await new Promise(resolve => setImmediate(resolve))
  tree = render()
  assert.equal(find(tree, node => node.type === 'Textarea').props.value, 'Keep this')
  accepted = true
  button(tree, 'Save note').props.onClick(); await new Promise(resolve => setImmediate(resolve))
  tree = render()
  assert.ok(tree.props.actions)
  assert.equal(drafts.at(-1), '')
  tree.props.actions.props.onClick(); tree = render()
  find(tree, node => node.type === 'Textarea').props.onChange({ target: { value: 'Cancel me' } })
  tree = render(); button(tree, 'Cancel').props.onClick()
  assert.equal(saved.length, 2)
  assert.ok(render().props.actions)
  assert.equal(drafts.at(-1), '')
})

test('saving state disables the card action and lead drawer opts into panel layout', () => {
  assert.equal(setup({ saving: true }).render().props.actions.props.disabled, true)
  const source = fs.readFileSync(path.join(root, 'components/leads/LeadDetailPanel.tsx'), 'utf8')
  assert.match(source, /<NotesSection key=\{lead.id\} title="Notes" panel/)
})