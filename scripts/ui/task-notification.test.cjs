const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file) {
 const exports = {}
 const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
 vm.runInNewContext(code, { exports, require(name) {
  if (name === 'react/jsx-runtime') return { jsx: (tag, props) => ({ tag, props }), jsxs: (tag, props) => ({ tag, props }) }
  if (name === './ButtonBase') return { ButtonBase: 'button' }
  if (name === 'lucide-react') return { Check: 'check' }
  if (name === '@/lib/tokens') return { colors: { espresso: '#111', border: '#ddd', surface: '#fff', green: '#3D8B5F', greenDark: '#1F5C3A' }, radius: { sm: 4 }, spacing: { xs: 4, sm: 8 }, typography: { sizeBase: 14, weightSemibold: 600 } }
  throw new Error(name)
 } })
 return exports
}
test('swatches stay circular, colored and selected without shrinking', () => {
 const { ColorSwatch } = load('components/ui/ColorSwatch.tsx')
 const onClick = () => {}
 const { props } = ColorSwatch({ color: '#FEF08A', selected: true, label: 'Yellow', onClick, type: 'button' })
 assert.equal(props.style.width, props.style.height)
 assert.equal(props.style.flexShrink, 0)
 assert.equal(props.style.background, '#FEF08A')
 assert.equal(props.style.borderRadius, '50%')
 assert.equal(props['aria-pressed'], true)
 assert.equal(props.onClick, onClick)
})
test('task completion retains its action and exposes open/completed state', () => {
 const { TaskCompletionButton } = load('components/ui/TaskCompletionButton.tsx')
 const onClick = () => {}
 for (const completed of [false, true]) {
  const { props } = TaskCompletionButton({ completed, onClick, type: 'button' })
  assert.equal(props.onClick, onClick)
  assert.equal(props['aria-pressed'], completed)
  assert.equal(props.children[1], completed ? 'Done' : 'Mark done')
  assert.equal(props.style.color, '#1F5C3A')
   assert.equal(props.style.background, completed ? 'rgba(61, 139, 95, 0.12)' : 'transparent')
 }
})
test('daily composer colors rotate without white and completed backgrounds are 80% transparent', () => {
 const { getDailyNoteColor, getNoteBackground } = load('lib/sticky-note-appearance.ts')
 const colors = Array.from({ length: 12 }, (_, index) => getDailyNoteColor(new Date(2026, 9, 1 + index)))
 assert.equal(new Set(colors).size, 6)
 assert.ok(colors.every((color) => color !== 'white' && color !== 'gray'))
 assert.equal(colors[0], colors[6])
 assert.equal(getNoteBackground('yellow', false), '#FEF08A')
 assert.equal(getNoteBackground('yellow', true), 'rgba(254, 240, 138, 0.2)')
 const page = fs.readFileSync(path.join(root, 'app/dashboard/notes/page.tsx'), 'utf8')
 assert.ok(page.includes("textDecoration: note.completed_at ? 'line-through' : 'none'"))
 assert.ok(page.includes('background: composerBg'))
})
test('notifications use one compact actor sentence with inline quotation', () => {
 const { notificationSummary } = load('lib/notification-summary.ts')
 assert.equal(notificationSummary({ actor_name: 'Josh Bennett', title: 'Josh B. mentioned you in a note', body: 'Hey Cohen', link: '/dashboard/notes?note=1' }), 'Josh B. mentioned you in a sticky note: “Hey Cohen”')
 assert.equal(notificationSummary({ actor_name: 'Bruno Wong', title: 'Mention', body: null, link: '/dashboard/leads?lead=1' }), 'Bruno W. mentioned you in a lead contact card')
})
