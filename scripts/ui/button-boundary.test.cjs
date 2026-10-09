const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

test('native buttons are owned exclusively by ButtonBase', () => {
  const violations = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (file.endsWith('.tsx') && file !== path.join(root, 'components/ui/ButtonBase.tsx')) {
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        function visit(node) {
          if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'button') {
            violations.push(path.relative(root, file))
          }
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }
  }
  walk(path.join(root, 'app'))
  walk(path.join(root, 'components'))
  assert.deepEqual(violations, [])
})

test('ButtonBase forwards native properties without adding defaults or wrappers', () => {
  const source = fs.readFileSync(path.join(root, 'components/ui/ButtonBase.tsx'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.equal(name, 'react/jsx-runtime')
    return { jsx: (tag, props) => ({ tag, props }) }
  } })
  const handler = () => {}
  const ref = { current: null }
  const props = { type: 'submit', disabled: true, onClick: handler, ref, 'aria-label': 'Save', style: { padding: 4 }, children: 'Save' }
  const result = exports.ButtonBase(props)
  assert.equal(result.tag, 'button')
  assert.deepEqual(Object.keys(result.props), Object.keys(props))
  for (const key of Object.keys(props)) assert.equal(result.props[key], props[key])
  assert.deepEqual(Object.keys(exports.ButtonBase({}).props), [])
})

test('screens use approved controls and only layout overrides', () => {
  const allowed = new Set(['position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex', 'width', 'maxWidth', 'minWidth', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'justifySelf', 'gridColumn', 'gridRow', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'whiteSpace', 'overflow', 'textOverflow'])
  const violations = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (file !== path.join(root, 'components/ui')) walk(file)
      } else if (file.endsWith('.tsx')) {
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        function visit(node) {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const name = node.tagName.getText(source)
            if (name === 'ButtonBase') violations.push(`${file}: bare ButtonBase`)
            if (['Button', 'LoadingButton', 'ControlButton'].includes(name)) {
              for (const attr of node.attributes.properties) {
                if (!ts.isJsxAttribute(attr)) continue
                if (attr.name.getText(source) === 'className') violations.push(`${file}: button className override`)
                if (attr.name.getText(source) !== 'style') continue
                const expression = attr.initializer?.expression
                if (!expression || !ts.isObjectLiteralExpression(expression)) violations.push(`${file}: indirect button style`)
                else for (const property of expression.properties) {
                  if (!ts.isPropertyAssignment(property) || !allowed.has(property.name.getText(source).replace(/['"]/g, ''))) violations.push(`${file}: button appearance override`)
                }
              }
            }
          }
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }
  }
  walk(path.join(root, 'app'))
  walk(path.join(root, 'components'))
  assert.deepEqual(violations, [])
})