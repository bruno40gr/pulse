'use client'

import { useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { fillMockTemplate } from '@/lib/prototype-messaging'
import { prototypePreviewDocument } from '@/lib/conversations-prototype-html'
import type { TemplateProps } from '@/components/inbox/PrototypeTemplates'

/** Selection only. Template management belongs in settings. */
export default function PrototypeEmailTemplates({ channel, templates, onApply, currentBody, person, onDismiss, triggerLabel = 'Templates' }: TemplateProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [feedback, setFeedback] = useState('')
  const available = templates.filter(template => template.channel === channel)
  const preview = available.find(template => template.id === selected)
  function dismiss() { setOpen(false); setConfirmReplace(false); onDismiss?.() }
  function apply() {
    if (!preview) return
    if (currentBody.trim() && !confirmReplace) { setConfirmReplace(true); return }
    onApply(preview, 'replace'); dismiss(); setFeedback(`${preview.name} applied.`)
  }
  return <>
    <Button variant="secondary" onClick={() => { setSelected(''); setConfirmReplace(false); setOpen(true) }}>{triggerLabel}</Button>
    {feedback && <p role="status" style={typography.bodySmall}>{feedback}</p>}
    <Modal isOpen={open} onClose={dismiss} size="wide" ariaLabel={channel === 'email' ? 'Email templates' : 'SMS templates'}>
      <ModalHeader title={channel === 'email' ? 'Email templates' : 'SMS templates'} onClose={dismiss} />
      <ModalBody>
        <section aria-label="Template gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: spacing.md }}>
          {available.map(template => <Button key={template.id} variant={selected === template.id ? 'primary' : 'secondary'} aria-pressed={selected === template.id} onClick={() => { setSelected(template.id); setConfirmReplace(false) }} style={{ whiteSpace: 'normal', height: 'auto', minHeight: 60 }}>{template.name}</Button>)}
        </section>
        {preview ? <section aria-label="Template preview" style={{ marginTop: spacing.xl, padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: 8, overflowWrap: 'anywhere' }}>
          {channel === 'email' && <strong>{fillMockTemplate(preview.subject, person)}</strong>}
          {preview.html ? <iframe title="Template content" sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(fillMockTemplate(preview.html, person))} style={{ width: '100%', height: 260, border: 0 }} /> : <p style={{ ...typography.body, whiteSpace: 'pre-wrap' }}>{fillMockTemplate(preview.body, person)}</p>}
        </section> : <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Select a template to preview it.</p>}
        {confirmReplace && <p role="alert">Replace the current draft? Recipients stay the same. You can undo after applying.</p>}
      </ModalBody>
      <ModalFooter leading={<Button variant="ghost" onClick={dismiss}>Write from scratch</Button>}>
        {confirmReplace && <Button variant="secondary" onClick={() => { if (preview) { onApply(preview, 'insert'); dismiss() } }}>Insert instead</Button>}
        <Button disabled={!preview} onClick={apply}>{confirmReplace ? 'Confirm replace' : 'Use template'}</Button>
      </ModalFooter>
    </Modal>
  </>
}
