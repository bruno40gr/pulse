/* eslint-disable @typescript-eslint/no-require-imports -- Offline design-system contracts. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: name => {
    if (name in dependencies) return dependencies[name]
    if (name === 'react/jsx-runtime') return require(name)
    if (name === 'react') return { ...require(name), useId: () => 'example' }
    throw Error(`Unexpected dependency ${name}`)
  } })
  return loaded.exports
}
const tokens = load('lib/tokens.ts')
function contrast(a, b) {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
test('electric fills use dark text and deeper teal protects text/focus contrast', () => {
  const { interaction, colors } = tokens
  assert.ok(contrast(interaction.selected, interaction.onSelected) >= 4.5)
  assert.ok(contrast(interaction.selectedSurface, interaction.selectedText) >= 4.5)
  assert.ok(contrast(colors.surface, interaction.selectedText) >= 4.5)
  assert.ok(contrast(colors.surface, interaction.focus) >= 3)
  for (const name of ['Pill', 'WeekdayToggleGroup', 'ModalStepper', 'ProgressStepper', 'TableWorkspaceControls']) {
    assert.match(read(`components/ui/${name}.tsx`), /interaction\.onSelected/)
  }
})
test('interaction roles use electric teal with deep text/focus, independent from links and status', () => {
  assert.equal(tokens.interaction.selected, '#00BEDF')
  assert.equal(tokens.interaction.selected, tokens.colors.tealElectric)
  assert.equal(tokens.interaction.selectedSurface, tokens.colors.tealLight)
  assert.equal(tokens.interaction.onSelected, tokens.colors.espresso)
  assert.notEqual(tokens.interaction.selected, tokens.colors.link)
  assert.equal(tokens.interaction.focus, tokens.colors.tealInk)
  assert.notEqual(tokens.interaction.primary, tokens.interaction.selected)
  assert.notEqual(tokens.colors.error, tokens.interaction.selected)
  const { interactionVariables } = load('lib/interaction-theme.ts', { './tokens': tokens })
  assert.equal(interactionVariables['--interaction-selected'], tokens.interaction.selected)
  assert.equal(interactionVariables['--interaction-focus'], tokens.interaction.focus)
  assert.match(read('app/layout.tsx'), /style=\{interactionVariables\}/)
})
test('checkbox primitive preserves mixed-state refs, handlers, disabled semantics and owns its accent', () => {
  const { CheckboxInput } = load('components/ui/Checkbox.tsx', { '@/lib/tokens': tokens })
  const ref = () => {}, onChange = () => {}
  const node = CheckboxInput({ ref, onChange, disabled: true, checked: true, 'aria-label': 'Select family', style: { accentColor: 'black' } })
  assert.equal(node.props.ref, ref)
  assert.equal(node.props.onChange, onChange)
  assert.equal(node.props.disabled, true)
  assert.equal(node.props.checked, true)
  assert.equal(node.props.style.accentColor, tokens.interaction.selected)
})
test('Beta control exports delegate to the canonical library', () => {
  for (const name of ['Checkbox', 'Switch', 'ControlButton', 'Input', 'Select', 'Textarea', 'SearchSelect', 'ModalStepper', 'ProgressStepper', 'Tabs', 'Pill', 'Button']) {
    assert.match(read(`beta-source/components/ui/${name}.tsx`), new RegExp(`export \\* from '@/components/ui/${name}'`))
  }
})
test('selection primitives use interaction roles rather than brand colors', () => {
  for (const name of ['Checkbox', 'RadioOptionGroup', 'Switch', 'ToggleSwitch', 'WeekdayToggleGroup', 'ModalStepper', 'ProgressStepper', 'Tabs', 'Pill', 'ColorSwatch']) {
    const source = read(`components/ui/${name}.tsx`)
    assert.match(source, /interaction\.selected/)
    // New-item notification badges are status, not selected-state styling.
    const selectionSource = name === 'Tabs' ? source.slice(0, source.indexOf("{typeof tab.notificationCount")) : source
    assert.doesNotMatch(selectionSource, /colors\.(crimson|tealDark|teal)\b/)
  }
  assert.doesNotMatch(read('components/ui/SearchSelect.tsx'), /SearchSelect.module.css/)
})
test('all explicit native-control accents in app and component trees use the role token', () => {
  function visit(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const name = `${dir}/${entry.name}`
      if (entry.isDirectory()) visit(name)
      else if (/\.(tsx|css)$/.test(name)) {
        const source = read(name)
        for (const match of source.matchAll(/accentColor:\s*([^,}\n]+)|accent-color:\s*([^;}]+)/g)) {
          const value = (match[1] || match[2]).trim()
          assert.ok(value === 'interaction.selected' || value === 'var(--interaction-selected)', `${name}: rogue accent ${value}`)
        }
      }
    }
  }
  for (const dir of ['app', 'components', 'beta-source/app', 'beta-source/components']) visit(dir)
})
