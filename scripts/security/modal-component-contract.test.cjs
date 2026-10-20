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
    if (id === '@/lib/tokens') return { colors: {}, radius: {}, shadows: {}, spacing: { xs: '4px', xl: '18px', '2xl': '24px' }, typography: { h2: { fontSize: '1.125rem' }, size2xl: '1.5rem' } }
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

test('shared modal header has consistent padding, minimum height, full width and 18px title', () => {
  const header = modal().ModalHeader({ title: 'Templates' })
  assert.equal(header.props.style.padding, '12px 18px')
  assert.equal(header.props.style.minHeight, 72)
  assert.equal(header.props.style.width, '100%')
  assert.equal(header.props.style.boxSizing, 'border-box')
  const heading = header.props.children[0].props.children[2].props.children.props.children[0]
  assert.equal(heading.type, 'h2')
  assert.equal(heading.props.style.fontSize, '1.125rem')
  const withClose = modal().ModalHeader({ title: 'Templates', onClose() {} })
  assert.equal(withClose.props.style.minHeight, header.props.style.minHeight)
  assert.equal(withClose.props.style.padding, header.props.style.padding)
})

test('Settings separates staff roles from permission editing and uses the shared responsive table', () => {
  const settings = source('app/dashboard/settings/page.tsx')
  const access = source('components/access/AccessManagementClient.tsx')
  assert.match(settings, /label: 'Roles'/)
  assert.match(settings, /label: 'Permissions'/)
  assert.match(settings, /view="permissions"/)
  assert.doesNotMatch(settings, /maxWidth="1100px"/)
  assert.doesNotMatch(access, /<Tabs|Add account|<table/)
  assert.match(access, /<ResponsiveDataTable<Membership, string>/)
  assert.match(access, /<Plus size=\{16\} \/>Add Staff/)
  assert.match(access, /fullName\(membership\)\}\{role\?\.key === 'owner'/)
  assert.doesNotMatch(access, /data.currentRoleKey === 'owner' \? 'Owner' : 'Admin'/)
  assert.doesNotMatch(access, /Manage the people who work in your organization|Define roles and choose the permissions|Your role|isCurrentOwner/)
  const people = access.slice(access.indexOf('function PeopleAccessPanel'), access.indexOf('function AccessLoadingState'))
  assert.ok(people.indexOf('>People</h2>') < people.indexOf('<SurfacePanel'))
  assert.ok(people.indexOf('onClick={onAddAccount} style={{ flexShrink: 0 }}') < people.indexOf('<SurfacePanel'))
  assert.match(people, /display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0/)
})

test('Contacts reserves clear-selection space and uses inline blue non-underlined actions', () => {
  const contacts = source('app/dashboard/contacts/page.tsx')
  const counter = contacts.slice(contacts.indexOf('{/* Viewing counter */}'), contacts.indexOf('{/* Viewing counter */}') + 2100)
  assert.match(counter, /minHeight: 40/)
  assert.match(counter, /visibility: selectedIds.size/)
  assert.match(counter, /<ControlButton kind="link"/)
  assert.match(counter, /marginBottom: spacing.lg/)
  const control = source('components/ui/ControlButton.tsx')
  assert.match(control, /color: colors.link, textDecoration: 'none'/)
  assert.doesNotMatch(control, /textDecoration: 'underline'/)
})

test('fullscreen modal owns viewport sizing without drawer geometry', () => {
  const overlay = modal().Modal({ isOpen: true, layout: 'fullscreen' })
  assert.equal(overlay.props.style.padding, 0)
  const style = overlay.props.children.props.style
  assert.equal(style.width, '100dvw')
  assert.equal(style.height, '100dvh')
  assert.equal(style.maxHeight, '100dvh')
  assert.equal(style.borderRadius, 0)
})

test('Contacts bulk channels confirm without repeating contacts then navigate into Conversations', () => {
  const flow = source('components/inbox/ContactBulkMessageModal.tsx')
  assert.match(flow, /router.push\(`\/dashboard\/inbox\/bulk\?selection=/)
  assert.match(flow, />Continue<\/Button>/)
  assert.doesNotMatch(flow, /SlidePanel|<ContactBulkComposer|<ul|description=/)
  const workspace = source('components/inbox/BulkMessageWorkspace.tsx')
  assert.match(workspace, /<PageHeader/)
  assert.match(workspace, /<ContactBulkComposer/)
  assert.match(workspace, /value.tenantId !== getActiveTenantId\(\)/)
  assert.doesNotMatch(workspace, /<Modal|<SlidePanel/)
  assert.match(source('app/dashboard/contacts/page.tsx'), /isComposeOpen && !singleComposeContact && <ContactBulkMessageModal/)
})

test('shared modal header cannot render a subtitle row', () => {
  assert.doesNotMatch(source('components/ui/Modal.tsx'), /description/)
})

test('both channels share expandable exclusion details and email keeps warnings outside To fields', () => {
  const notice = source('components/inbox/ExcludedRecipientsNotice.tsx')
  assert.match(notice, /aria-expanded=\{expanded\}/)
  assert.match(notice, /See contacts/)
  assert.match(notice, /contact.reason/)
  const email = source('components/inbox/ContactBulkComposer.tsx')
  assert.ok(email.indexOf('<ExcludedRecipientsNotice') > email.indexOf('{error && <Notice'))
  assert.ok(email.indexOf('<ExcludedRecipientsNotice') < email.indexOf('<PrototypeEmailComposer'))
  assert.match(email, /fromControl=\{<Select/)
  assert.doesNotMatch(email, /Organisation admin|sender\?\.name \|\| 'Organisation'/)
  assert.match(source('components/campaigns/ComposePanel.tsx'), /<ExcludedRecipientsNotice/)
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