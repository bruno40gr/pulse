/* eslint-disable @typescript-eslint/no-require-imports -- Offline shared disclosure and layout checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')

test('shared disclosure defaults closed and delegates keyboard behavior to native details/summary', () => {
  const exports = {}
  const code = ts.transpileModule(source('components/ui/Disclosure.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require(id) {
    if (id.endsWith('.module.css')) return { default: { disclosure: 'disclosure', summary: 'summary', chevron: 'chevron', label: 'label' } }
    if (id === '@/lib/tokens') return { spacing: { sm: '8px' } }
    return require(id)
  } })
  const element = exports.Disclosure({ summary: 'Activity', children: 'History' })
  assert.equal(element.type, 'details')
  assert.equal(element.props.open, undefined)
  assert.equal(element.props.children[0].type, 'summary')
  assert.equal(element.props.children[0].props.children[0].props['aria-hidden'], 'true')
  const css = source('components/ui/Disclosure.module.css')
  assert.match(css, /\[open\].*chevron/)
  assert.match(css, /focus-visible/)
})

test('email thread readers and lead activity use one shared disclosure implementation', () => {
  for (const file of ['components/inbox/Conversations.tsx', 'components/inbox/ConversationsPrototype.tsx', 'components/leads/LeadActivitySection.tsx']) {
    assert.match(source(file), /import \{ Disclosure \} from '@\/components\/ui\/Disclosure'/)
    assert.match(source(file), /<Disclosure/)
    assert.doesNotMatch(source(file), /ChevronRight|ChevronDown/)
  }
  const activity = source('components/leads/LeadActivitySection.tsx')
  assert.match(activity, /entries\.slice\(0, 2\)/)
  assert.match(activity, /View all activity/)
  assert.match(activity, /<Modal/)
})

test('lead notes own scrolling while follow-up and activity stay in a bounded rail', () => {
  const panel = source('components/leads/LeadDetailPanel.tsx')
  assert.match(panel, /aria-label="Lead notes and follow-up" style=\{notesRailStyle\}/)
  assert.match(panel, /<NotesSection key=\{lead.id\} title="Notes" panel/)
  assert.match(source('components/ui/NotesSection.tsx'), /flex: 1, minHeight: 0, overflowY: 'auto'/)
  assert.match(panel, /const notesRailStyle:.*overflow: 'hidden'/)
  assert.match(panel, /const followUpSectionStyle:.*flexShrink: 0/)
  assert.match(panel, /<LeadActivitySection key=\{lead.id\}/)
  assert.match(panel, /mobileSection === 'notes' \? notesRail/)
})