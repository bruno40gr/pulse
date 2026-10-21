/* eslint-disable @typescript-eslint/no-require-imports -- Offline component regression checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

function load(file) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, require(id) {
    if (id.endsWith('.module.css')) return { default: { control: 'control' } }
    if (id === '@/lib/tokens') return load('lib/tokens.ts')
    if (id.startsWith('./')) return load(`components/ui/${id.slice(2)}.tsx`)
    return require(id)
  } })
  return exports
}

test('clickable contact names match static person names without changing blue text links', () => {
  const { PersonName } = load('components/ui/PersonName.tsx')
  const { ControlButton } = load('components/ui/ControlButton.tsx')
  const { colors } = load('lib/tokens.ts')
  const onClick = () => {}
  const name = PersonName({ as: 'button', children: 'Alex Smith', onClick, style: { whiteSpace: 'nowrap', color: 'red', fontWeight: 400 } })
  const button = name.type(name.props)
  assert.equal(button.props.style.color, PersonName({ children: 'Alex Smith' }).props.style.color)
  assert.equal(button.props.style.color, colors.text)
  assert.equal(button.props.style.fontWeight, PersonName({ children: 'Alex Smith' }).props.style.fontWeight)
  assert.equal(button.props.style.padding, 0)
  assert.equal(button.props.style.whiteSpace, 'nowrap')
  assert.equal(button.props.onClick, onClick)
  assert.equal(button.props.type, 'button')
  assert.equal(button.props.children, 'Alex Smith')
  assert.equal(ControlButton({ kind: 'link', children: 'Website' }).props.style.color, colors.link)
})

test('all people table entry points use the same PersonName component, not link-styled names', () => {
  const files = [
    'app/dashboard/contacts/page.tsx', 'app/dashboard/staff/page.tsx',
    'components/leads/LeadsView.tsx', 'components/inbox/Conversations.tsx',
    'components/inbox/ConversationsPrototype.tsx', 'components/access/AccessManagementClient.tsx',
    'components/funding/FundedCasesWorkspace.tsx', 'components/funding/FundingProgramsHub.tsx',
    'components/ui/RecipientPicker.tsx',
    'components/contacts/ContactList.tsx',
  ]
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /<PersonName[ >]/, file)
    assert.ok(!source.includes('PersonNameButton'), file)
    assert.doesNotMatch(source, /<ControlButton kind="link"[^>]*aria-label=\{`Open conversation with/, file)
  }
})

test('account settings omit the shared staff access message', () => {
  const source = fs.readFileSync(path.join(root, 'app/dashboard/settings/page.tsx'), 'utf8')
  assert.ok(!source.includes('You are currently signed in through the shared staff access flow.'))
})