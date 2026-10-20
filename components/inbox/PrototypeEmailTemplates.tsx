'use client'

import { useState } from 'react'
import { Button, Input, Textarea, Notice, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { OptionGallery } from '@/components/ui/OptionGallery'
import { colors, spacing, typography } from '@/lib/tokens'
import { fillMockTemplate } from '@/lib/prototype-messaging'
import { prototypePreviewDocument } from '@/lib/conversations-prototype-html'
import type { TemplateProps } from '@/components/inbox/PrototypeTemplates'

const CREATE_TEMPLATE = 'create-new-template'

export default function PrototypeEmailTemplates({ channel, templates, onApply, onCreate, currentBody, currentSubject, person, onDismiss, triggerLabel = 'Templates' }: TemplateProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const available = templates.filter(template => template.channel === channel)
  const selectedId = selected || available[0]?.id || CREATE_TEMPLATE
  const isCreating = selectedId === CREATE_TEMPLATE
  const preview = available.find(template => template.id === selectedId)
  function dismiss() { setOpen(false); setConfirmReplace(false); onDismiss?.() }
  function select(id: string) { setSelected(id); setConfirmReplace(false); setCreateError('') }
  async function create() {
    if (creating || !newName.trim() || !newBody.trim() || channel === 'email' && !newSubject.trim()) return
    if (available.some(template => template.name.trim().toLowerCase() === newName.trim().toLowerCase())) {
      setCreateError('A template with this name already exists.'); return
    }
    setCreating(true); setCreateError('')
    const template = { id: `custom-${crypto.randomUUID()}`, channel, category: 'Outreach', name: newName.trim(), subject: newSubject.trim(), body: newBody.trim() }
    try {
      await onCreate(template)
      setSelected(template.id); setNewName(''); setNewSubject(''); setNewBody('')
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Could not create template.') } finally { setCreating(false) }
  }
  function apply() {
    if (!preview) return
    if ((currentBody.trim() || currentSubject?.trim()) && !confirmReplace) { setConfirmReplace(true); return }
    onApply(preview, 'replace'); dismiss()
  }
  return <>
    <Button variant="secondary" onClick={() => { setSelected(available[0]?.id || CREATE_TEMPLATE); setConfirmReplace(false); setCreateError(''); setOpen(true) }}>{triggerLabel}</Button>
    <Modal isOpen={open} onClose={dismiss} size="wide" ariaLabel={channel === 'email' ? 'Email templates' : 'SMS templates'}>
      <ModalHeader title={channel === 'email' ? 'Email templates' : 'SMS templates'} onClose={dismiss} />
      <ModalBody>
        <OptionGallery label="Template gallery" options={[...available.map(template => ({ id: template.id, name: template.name })), { id: CREATE_TEMPLATE, name: 'Create new template' }]} selectedId={selectedId} onSelect={select} disabled={creating} />
        {isCreating ? <section aria-label="Create template" style={{ display: 'grid', gap: spacing.lg, marginTop: spacing.xl }}>
          <Input aria-label="Template name" placeholder="Template name" value={newName} maxLength={200} onChange={event => setNewName(event.target.value)} />
          {channel === 'email' && <Input aria-label="Template subject" placeholder="Subject" value={newSubject} maxLength={500} onChange={event => setNewSubject(event.target.value)} />}
          <Textarea aria-label="Template message" placeholder="Message" value={newBody} rows={7} onChange={event => setNewBody(event.target.value)} />
          {createError && <p role="alert" style={typography.bodySmall}>{createError}</p>}
        </section> : preview ? <section aria-label="Template preview" style={{ marginTop: spacing.xl, padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: 8, overflowWrap: 'anywhere' }}>
          {channel === 'email' && <strong>{fillMockTemplate(preview.subject, person)}</strong>}
          {preview.html ? <iframe title="Template content" sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(fillMockTemplate(preview.html, person))} style={{ width: '100%', height: 260, border: 0 }} /> : <p style={{ ...typography.body, whiteSpace: 'pre-wrap' }}>{fillMockTemplate(preview.body, person)}</p>}
        </section> : <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Select a template to preview it.</p>}
        {confirmReplace && <Notice variant="warning" style={{ marginTop: spacing.lg }}>You are about to insert a different template. This will override your current email draft.</Notice>}
      </ModalBody>
      <ModalFooter>
        {isCreating ? <Button disabled={creating || !newName.trim() || !newBody.trim() || channel === 'email' && !newSubject.trim()} onClick={() => void create()}>{creating ? 'Saving…' : 'Save template'}</Button> : <>
          {confirmReplace && <Button variant="secondary" onClick={() => setConfirmReplace(false)}>Cancel</Button>}
          <Button disabled={!preview} onClick={apply}>{confirmReplace ? 'Confirm replace' : 'Use template'}</Button>
        </>}
      </ModalFooter>
    </Modal>
  </>
}
