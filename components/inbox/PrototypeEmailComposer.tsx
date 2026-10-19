'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Bold, Italic, Underline, List, Send } from 'lucide-react'
import { Button, SurfacePanel, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { EmailComposerFields } from './EmailComposerFields'
import styles from './EmailComposer.module.css'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'
import { PROTOTYPE_EMAIL } from '@/lib/conversations-prototype'
import { prototypeHtmlText, prototypePreviewDocument, sanitizePrototypeHtml } from '@/lib/conversations-prototype-html'

export type PrototypeEmailDraft = { subject: string; html: string; recipients?: MockEmailRecipients; bodyText?: string; contactOnly?: boolean; contextThreadId?: string }
import PrototypeTemplates from '@/components/inbox/PrototypeTemplates'
import { PrototypeEmailRecipients } from '@/components/inbox/PrototypeRecipients'
import { fillMockTemplate, mockTextHtml, validMockEmailRecipients, type MockEmailRecipients, type MockRecipient, type MockTemplate } from '@/lib/prototype-messaging'

const line: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }

export default function PrototypeEmailComposer({ name, email, student, draft, onChange, onSend, people, templates, onCreateTemplate, onCollapse, onDiscard, replying, signatureHtml, senderName, senderEmail = PROTOTYPE_EMAIL, disabled = false }: {
  name: string; email: string; student: string; draft: PrototypeEmailDraft
  onChange: (draft: PrototypeEmailDraft) => void
  onSend: (body: string, html: string) => void
  signatureHtml: string; senderName: string
  senderEmail?: string; disabled?: boolean
  onCollapse: () => void; onDiscard: () => void; replying: boolean; people: MockRecipient[]; templates: MockTemplate[]; onCreateTemplate: (template: MockTemplate) => void
}) {
  const [managingRecipients, setManagingRecipients] = useState(false)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [undo, setUndo] = useState<PrototypeEmailDraft | null>(null)
  const editor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (mode === 'write' && editor.current && editor.current.innerHTML !== draft.html) {
      editor.current.innerHTML = sanitizePrototypeHtml(draft.html)
    }
  }, [draft.html, mode])

  function format(tag: 'strong' | 'em' | 'u' | 'ul') {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editor.current) return
    const range = selection.getRangeAt(0)
    if (!editor.current.contains(range.commonAncestorContainer) || range.collapsed) return
    const wrapper = document.createElement(tag)
    const fragment = range.extractContents()
    if (tag === 'ul') { const item = document.createElement('li'); item.append(fragment); wrapper.append(item) }
    else wrapper.append(fragment)
    range.insertNode(wrapper)
    range.selectNodeContents(wrapper); selection.removeAllRanges(); selection.addRange(range)
    onChange({ ...draft, html: editor.current.innerHTML })
  }

  return <SurfacePanel padding="0" style={{ overflow: 'hidden', width: '100%', minWidth: 0, maxWidth: '100%' }}><section aria-label="Email composer" style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    <div style={{ ...line, justifyContent: 'space-between', padding: `${spacing.lg} ${spacing.xl}`, background: colors.surfaceMuted, borderBottom: `1px solid ${colors.border}` }}>
      <strong style={{ ...typography.body }}>Draft {replying ? 'reply' : 'email'}</strong>
      <div style={line}>
        {(['write', 'preview'] as const).map(view => <ControlButton key={view} kind="toggle" aria-pressed={mode === view} selected={mode === view} onClick={() => setMode(view)}>{view === 'write' ? 'Write' : 'Preview'}</ControlButton>)}

      </div>
    </div>
    {undo && <Button variant="ghost" onClick={() => { onChange({ ...draft, subject: undo.subject, html: undo.html }); setUndo(null) }}>Undo template</Button>}
    <div style={{ padding: 'clamp(12px, 2vw, 24px)' }}>
      <EmailComposerFields from={<>{senderName} &lt;{senderEmail}&gt;</>} recipients={draft.recipients && !draft.contactOnly
        ? (['to', 'cc', 'bcc'] as const).filter(field => field === 'to' || draft.recipients![field].length).map(field => ({
          label: field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc',
          content: <div style={line}><span>{draft.recipients![field].length <= 3 ? draft.recipients![field].map(id => people.find(person => person.id === id)?.name || 'Recipient').join(', ') || 'No recipients selected' : `${draft.recipients![field].length} recipients`}</span>{field === 'to' && <Button variant="secondary" size="sm" onClick={() => setManagingRecipients(true)}>Manage recipients</Button>}</div>,
        }))
        : [{ label: 'To', content: <>{name} &lt;{email}&gt;</> }]}
        subject={draft.subject} onSubjectChange={subject => onChange({ ...draft, subject })} />
      <div aria-label="Message input area" style={{ marginTop: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface, minWidth: 0 }}>
        <div style={{ ...line, justifyContent: 'space-between', padding: spacing.sm, borderBottom: `1px solid ${colors.borderLight}` }}>
          <div aria-label="Email formatting" style={line}>
          {([{ tag: 'strong', label: 'Bold', icon: Bold }, { tag: 'em', label: 'Italic', icon: Italic }, { tag: 'u', label: 'Underline', icon: Underline }, { tag: 'ul', label: 'Bullet list', icon: List }] as const).map(({ tag, label, icon: Icon }) => <ControlButton kind="icon" key={tag} disabled={mode !== 'write'} aria-label={label} title={`${label} (select text first)`} onMouseDown={event => event.preventDefault()} onClick={() => format(tag)}><Icon size={15} /></ControlButton>)}
          </div>
        <PrototypeTemplates compact triggerLabel="Use template" channel="email" templates={templates} onCreate={onCreateTemplate} currentBody={prototypeHtmlText(draft.html)} currentSubject={draft.subject} person={!draft.recipients || draft.recipients.to.length + draft.recipients.cc.length + draft.recipients.bcc.length === 1 ? people.find(person => person.id === draft.recipients?.to[0]) || { name, student } : undefined} onApply={(template, action) => {
          setUndo(draft)
          const person = !draft.recipients || draft.recipients.to.length + draft.recipients.cc.length + draft.recipients.bcc.length === 1 ? people.find(person => person.id === draft.recipients?.to[0]) || { name, student } : undefined
          const html = sanitizePrototypeHtml(fillMockTemplate(template.html || mockTextHtml(template.body), person))
          onChange({ ...draft, subject: action === 'replace' || !draft.subject.trim() ? fillMockTemplate(template.subject, person) : draft.subject, html: action === 'replace' ? html : draft.html + html })
          setMode('write')
        }} />
        </div>
      {mode === 'write' && <div className={styles.writingArea}>
        <div ref={editor} className={styles.editor} data-placeholder="Write your message…" role="textbox" aria-label="Email body" aria-placeholder="Write your message…" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={event => onChange({ ...draft, html: event.currentTarget.innerHTML })}
          onPaste={event => {
            event.preventDefault()
            const selection = window.getSelection()
            if (!selection?.rangeCount) return
            const range = selection.getRangeAt(0)
            if (!editor.current?.contains(range.commonAncestorContainer)) return
            range.deleteContents()
            const text = document.createTextNode(event.clipboardData.getData('text/plain'))
            range.insertNode(text); range.setStartAfter(text); range.collapse(true)
            selection.removeAllRanges(); selection.addRange(range)
            onChange({ ...draft, html: editor.current.innerHTML })
          }} />
        {signatureHtml && <div aria-label="Your email signature" className={styles.signature} dangerouslySetInnerHTML={{ __html: sanitizePrototypeHtml(signatureHtml) }} />}
      </div>}
      {mode === 'preview' && <iframe title="Email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(draft.html + signatureHtml)} style={{ border: 0, width: '100%', height: 390 }} />}
      </div>
    </div>
    <div style={{ ...line, justifyContent: 'space-between', padding: 'clamp(12px, 2vw, 24px)', borderTop: `1px solid ${colors.border}` }}>
      <div style={line}><Button variant="secondary" onClick={onCollapse}>Save as draft</Button><ControlButton kind="link" onClick={onDiscard}>Discard draft</ControlButton></div>
      <Button disabled={disabled || !!draft.recipients && !validMockEmailRecipients(draft.recipients, people) || !draft.subject.trim() || !prototypeHtmlText(draft.html).trim()} onClick={() => onSend(prototypeHtmlText(draft.html + signatureHtml), sanitizePrototypeHtml(draft.html + signatureHtml))}><Send size={14} />Send email</Button>
    </div>
    {draft.recipients && <Modal isOpen={managingRecipients} onClose={() => setManagingRecipients(false)} ariaLabel="Manage recipients" size="lg" style={{ height: 'min(80dvh, 640px)' }}>
      <ModalHeader title="Select email recipients" onClose={() => setManagingRecipients(false)} compact />
      <ModalBody style={{ display: 'flex', flexDirection: 'column' }}><PrototypeEmailRecipients people={people} recipients={draft.recipients} onChange={recipients => onChange({ ...draft, recipients })} fill /></ModalBody>
      <ModalFooter><Button onClick={() => setManagingRecipients(false)}>Done</Button></ModalFooter>
    </Modal>}
  </section></SurfacePanel>
}
