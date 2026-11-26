/* eslint-disable @typescript-eslint/no-require-imports -- Isolated component interactions, no network or live writes. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate)
    if (match) return match
  }
}

function setup() {
  const state = []; let cursor = 0; let loader
  const requests = []; let payload = { notifications: [], unread_count: 0 }; let fail = false; let navigated
  const imports = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
      useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
      useCallback(callback) { return callback },
      useEffect(callback) { callback() },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': { Bell: 'Bell' },
    '@/lib/tenant': { getActiveTenantId: () => 'school' },
    '@/lib/notification-summary': { notificationSummary: item => item.title },
    '@/lib/visible-polling': { startVisiblePolling: load => { loader = load; return { stop() {}, refresh() {} } } },
    '@/lib/tokens': { colors: {}, radius: {}, spacing: {}, typography: {} },
    '@/components/layout/SignedInUser': { __esModule: true, default: 'SignedInUser' },
    '@/components/ui/ControlButton': { ControlButton: 'ControlButton' },
    '@/components/ui/Button': { Button: 'Button' },
    '@/components/ui/Select': { Select: 'Select' },
    '@/components/ui/LoadingSkeleton': { LoadingSkeleton: 'LoadingSkeleton' },
    '@/components/ui/Modal': { Modal: 'Modal', ModalHeader: 'ModalHeader' },
  }
  const mod = { exports: {} }
  const source = fs.readFileSync(path.resolve(__dirname, '../../components/notifications/NotificationBell.tsx'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    module: mod, exports: mod.exports,
    require: id => { if (!(id in imports)) throw new Error(id); return imports[id] },
    fetch: async (url, init) => { requests.push({ url, init }); return { ok: !fail, json: async () => payload } },
    window: { location: { assign: link => { navigated = link } } },
    Date,
  })
  return {
    render() { cursor = 0; return mod.exports.default({}) },
    async load(next, failed = false) { payload = next; fail = failed; await loader(new AbortController().signal) },
    requests, navigated: () => navigated,
  }
}
const button = (tree, label) => find(tree, node => node.type === 'Button' && node.props.children === label)
const select = (tree, label) => find(tree, node => node.type === 'Select' && node.props.label === label)
const notice = { id: 'mention', title: 'Mention in a note', body: 'Context', link: '/dashboard/notes?note=original', created_at: '2026-11-26T12:00:00Z', read_at: null, dismissed_at: null }

test('inbox starts with a skeleton; filters clear stale content and request mention history', async () => {
  const h = setup()
  assert.ok(find(h.render(), node => node.type === 'LoadingSkeleton'))
  await h.load({ notifications: [notice], unread_count: 1, has_more: true })
  let tree = h.render()
  assert.ok(button(tree, 'Open'))
  select(tree, 'Notifications').props.onChange({ target: { value: 'mentions' } })
  tree = h.render()
  assert.ok(find(tree, node => node.type === 'LoadingSkeleton'))
  assert.equal(button(tree, 'Open'), undefined)
  await h.load({ notifications: [notice], unread_count: 1, has_more: true })
  tree = h.render()
  assert.equal(button(tree, 'Dismiss all notifications'), undefined, 'Mention filter must not bulk-dismiss unrelated notifications')
  select(tree, 'View').props.onChange({ target: { value: 'history' } })
  h.render()
  await h.load({ notifications: [], unread_count: 1, has_more: false })
  assert.match(h.requests.at(-1).url, /mentions=true&history=true/)
})

test('older and newer controls browse pages and history items reopen the original source', async () => {
  const h = setup(); h.render()
  await h.load({ notifications: [notice], unread_count: 1, has_more: true })
  let tree = h.render()
  assert.equal(button(tree, 'Newer').props.disabled, true)
  button(tree, 'Older').props.onClick()
  h.render()
  await h.load({ notifications: [{ ...notice, dismissed_at: '2026-11-26T13:00:00Z' }], has_more: false })
  assert.match(h.requests.at(-1).url, /offset=30/)
  tree = h.render()
  assert.equal(button(tree, 'Older').props.disabled, true)
  assert.equal(button(tree, 'Dismiss'), undefined)
  button(tree, 'Open').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(JSON.parse(h.requests.at(-1).init.body).action, 'seen')
  assert.equal(h.navigated(), notice.link)
})

test('failed loads show an error and retry, never a verified empty inbox', async () => {
  const h = setup(); h.render()
  await h.load({}, true)
  const tree = h.render()
  assert.ok(find(tree, node => node.props?.role === 'alert'))
  assert.ok(button(tree, 'Retry'))
  assert.ok(!JSON.stringify(tree).includes('No notifications in this view.'))
})

test('sticky editors expose mention picker without task conversion or assignment controls', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../components/notes/DashboardNotes.tsx'), 'utf8')
  assert.equal((source.match(/showMentionButton/g) || []).length, 2)
  for (const removed of ['Create a task', 'Convert to task', 'My tasks', 'Open tasks', 'Suggested owner:', 'saveTask', 'taskMentions']) assert.ok(!source.includes(removed), removed)
  for (const retained of ['mention_membership_ids: editMentionIds', 'mention_membership_ids: draftMentionIds', 'NoteConversationPanel', 'setDraftPrivate', 'toggleDone', 'Historical follow-up']) assert.ok(source.includes(retained), retained)
})