/* eslint-disable @typescript-eslint/no-require-imports -- Offline DOM ownership regression tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function harness() {
  const handlers = new Map()
  const body = { children: [], style: { overflow: 'auto' } }
  const document = { body, activeElement: null, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) }
  class Element {
    constructor(parent = null) { this.parent = parent; this.inert = false; this.style = {}; this.attributes = {}; this.isConnected = true; this.tabIndex = 0; this.items = [] }
    closest() { return this.inert ? this : this.parent?.closest() || null }
    contains(element) { return element === this || !!element?.parent && this.contains(element.parent) }
    querySelectorAll() { return this.items }
    getClientRects() { return this.hidden ? [] : [{}] }
    setAttribute(key, value) { this.attributes[key] = value }
    removeAttribute(key) { delete this.attributes[key] }
    focus() { if (!this.closest()) document.activeElement = this }
  }
  let mutation
  class MutationObserver {
    constructor(callback) { mutation = callback }
    observe() {}
    disconnect() { mutation = undefined }
  }
  const exports = {}
  const file = path.resolve(__dirname, '../../lib/dialog-stack.ts')
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, document, HTMLElement: Element, Node: Element, MutationObserver, getComputedStyle: () => ({ visibility: 'visible' }) })
  function layer(escape = true) {
    const root = new Element(); const dialog = new Element(root)
    const first = new Element(dialog); const last = new Element(dialog)
    dialog.items = [first, last]; body.children.push(root)
    const result = { root, dialog, first, last, closes: 0 }
    result.cleanup = exports.registerDialog({ root, dialog, canEscape: () => escape, dismiss: () => result.closes++ })
    return result
  }
  function key(key, shiftKey = false) { const event = { key, shiftKey, preventDefault() { this.prevented = true }, stopImmediatePropagation() {} }; handlers.get('keydown')?.(event); return event }
  return { document, body, Element, layer, key, handlers, mutate: () => mutation?.(), ...exports }
}

test('stack owns initial focus, inert background, topmost Escape and opener restoration', () => {
  const h = harness(); const background = new h.Element(); const opener = new h.Element(background)
  h.body.children.push(background); opener.focus()
  const parent = h.layer()
  assert.equal(h.document.activeElement, parent.first)
  assert.equal(background.inert, true)
  parent.last.focus(); const child = h.layer()
  assert.equal(parent.root.inert, true)
  assert.ok(+child.root.style.zIndex > +parent.root.style.zIndex)
  h.key('Escape'); assert.equal(child.closes, 1); assert.equal(parent.closes, 0)
  child.cleanup(); assert.equal(h.document.activeElement, parent.last)
  assert.equal(h.body.style.overflow, 'hidden')
  parent.cleanup(); assert.equal(h.document.activeElement, opener)
  assert.equal(h.body.style.overflow, 'auto'); assert.equal(background.inert, false)
  assert.equal(h.handlers.size, 0)
})

test('Tab wraps visible controls and handles an empty dialog', () => {
  const h = harness(); const panel = h.layer()
  panel.last.focus(); assert.equal(h.key('Tab').prevented, true); assert.equal(h.document.activeElement, panel.first)
  h.key('Tab', true); assert.equal(h.document.activeElement, panel.last)
  panel.last.hidden = true; panel.first.focus(); h.key('Tab'); assert.equal(h.document.activeElement, panel.first)
  panel.dialog.items = []; h.key('Tab'); assert.equal(h.document.activeElement, panel.dialog)
  panel.cleanup()
})

test('non-dismissible top dialog blocks Escape from reaching its parent', () => {
  const h = harness(); const parent = h.layer(); const confirmation = h.layer(false)
  assert.equal(h.key('Escape').prevented, true)
  assert.equal(parent.closes, 0); assert.equal(confirmation.closes, 0)
  assert.equal(h.isTopDialog(parent.root), false)
  confirmation.cleanup(); parent.cleanup()
})

test('out-of-order cleanup retains scroll lock and restores original inert values', () => {
  const h = harness(); const existing = new h.Element(); existing.inert = true; h.body.children.push(existing)
  const parent = h.layer(); const child = h.layer()
  parent.cleanup(); assert.equal(h.body.style.overflow, 'hidden'); assert.equal(child.root.inert, false)
  const added = new h.Element(); h.body.children.push(added); h.mutate(); assert.equal(added.inert, true)
  child.cleanup(); assert.equal(existing.inert, true); assert.equal(added.inert, false)
  assert.equal(h.body.style.overflow, 'auto')
})