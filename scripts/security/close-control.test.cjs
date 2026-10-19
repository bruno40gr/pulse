/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the shared control without a browser build. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')

function loadControl() {
  const exports = {}
  const source = fs.readFileSync(path.resolve(__dirname, '../../components/ui/ControlButton.tsx'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, require(name) {
    if (name === './ButtonBase') return { ButtonBase: 'button' }
    if (name === 'lucide-react') return { X: 'CloseIcon' }
    if (name === '@/lib/tokens') return { colors: {}, radius: {}, spacing: {}, typography: {} }
    return require(name)
  } })
  return exports.ControlButton
}

test('Close has a consistent icon and cannot be shrunk below its 48px target', () => {
  const Control = loadControl()
  const onClick = () => {}
  const button = Control({ kind: 'close', 'aria-label': 'Close', onClick, style: { width: 16, height: 20, minWidth: 0, minHeight: 0 }, children: '×' })
  for (const dimension of ['width', 'height', 'minWidth', 'minHeight']) assert.equal(button.props.style[dimension], 48)
  assert.equal(button.props.style.flexShrink, 0)
  assert.equal(button.props.onClick, onClick)
  assert.equal(button.props['aria-label'], 'Close')
  const icon = React.Children.only(button.props.children)
  assert.equal(icon.type, 'CloseIcon')
  assert.equal(icon.props.size, 22)
  assert.equal(icon.props['aria-hidden'], 'true')
})

test('Other icon controls keep their own size and content', () => {
  const button = loadControl()({ kind: 'icon', style: { width: 44, height: 44 }, children: 'Back' })
  assert.equal(button.props.style.width, 44)
  assert.equal(button.props.style.height, 44)
  assert.equal(button.props.children, 'Back')
})