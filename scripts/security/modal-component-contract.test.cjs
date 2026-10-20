/* eslint-disable @typescript-eslint/no-require-imports -- Offline shared-component contract checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const root = path.resolve(__dirname, '../..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')

function modal() {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source('components/ui/Modal.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, document: { body: {} }, require(id) {
    if (id === 'react') return { ...React, useId: () => 'title', useContext: () => 'title' }
    if (id === 'react-dom') return { createPortal: node => node }
    if (id === '@/lib/useDialogLayer') return { DialogTitleContext: { Provider: 'provider' }, useDialogLayer: () => ({ mounted: true, isTop: () => true }) }
    if (id === './BackControl') return { BackControl: 'back' }
    if (id === '@/components/ui/ControlButton') return { ControlButton: 'control' }
    if (id === '@/lib/tokens') return { colors: {}, radius: {}, shadows: {}, spacing: { xs: '4px', xl: '24px', '2xl': '32px' }, typography: { h2: {}, size2xl: '1.5rem' } }
    return require(id)
  } })
  return exports
}

test('large and wide shared modals own fixed height; compact dialogs remain content-sized', () => {
  const { Modal } = modal()
  for (const size of ['lg', 'wide']) {
    const dialog = Modal({ isOpen: true, size }).props.children
    assert.equal(dialog.props.style.height, 'min(80dvh, 640px)')
    assert.equal(dialog.props.style.overflow, 'hidden')
    assert.equal(Modal({ isOpen: true, size, layout: 'content' }).props.children.props.style.height, undefined)
  }
  assert.equal(Modal({ isOpen: true, size: 'sm' }).props.children.props.style.height, undefined)
})

test('shared modal header defaults to compact spacing and larger title', () => {
  const header = modal().ModalHeader({ title: 'Templates' })
  assert.equal(header.props.style.padding, '4px 32px')
  const heading = header.props.children[0].props.children[2].props.children[0].props.children[0]
  assert.equal(heading.type, 'h2')
  assert.equal(heading.props.style.fontSize, '1.5rem')
})

test('template picker consumes shared sizing, header and gallery without local CSS', () => {
  const picker = source('components/inbox/PrototypeEmailTemplates.tsx')
  assert.match(picker, /<OptionGallery/)
  assert.doesNotMatch(picker, /<style>|gridTemplateColumns|640px|80dvh|titleSize=|template-gallery-option/)
  assert.match(source('components/ui/ControlButton.module.css'), /:hover:not\(:disabled\)/)
  assert.match(source('components/ui/ControlButton.module.css'), /:focus-visible/)
  for (const file of ['Conversations', 'ConversationsPrototype', 'PrototypeEmailComposer', 'PrototypeNewMessage']) {
    assert.doesNotMatch(source(`components/inbox/${file}.tsx`), /height: 'min\(80dvh, 640px\)'/)
  }
})