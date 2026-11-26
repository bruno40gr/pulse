'use client'

import { useRef, useState } from 'react'
import { Button, Input, Textarea, Notice, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { OptionGallery } from '@/components/ui/OptionGallery'
import { colors, spacing, typography } from '@/lib/tokens'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { fillMockTemplate } from '@/lib/prototype-messaging'
import { prototypePreviewDocument } from '@/lib/conversations-prototype-html'
import type { TemplateProps } from '@/components/inbox/PrototypeTemplates'

const CREATE_TEMPLATE = 'create-new-template'

export default function PrototypeEmailTemplates({ channel, templates, onApply, onCreate, onEdit, onRemove, onOpen, canManage = true, managementOnly = false, currentBody, currentSubject, person, onDismiss, triggerLabel = 'Templates' }: TemplateProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [opening, setOpening] = useState(false)
  const inFlight = useRef(false)
  const available = templates.filter(template => template.channel === channel)
  const selectedId = selected || available[0]?.id || CREATE_TEMPLATE
  const isCreating = selectedId === CREATE_TEMPLATE
  const preview = available.find(template => template.id === selectedId)
  function canLeaveEditor() {
    const changed = editing ? newName !== preview?.name || newSubject !== preview?.subject || newBody !== preview?.body : isCreating && Boolean(newName || newSubject || newBody)
    return !changed || window.confirm('Discard unsaved changes?')
  }
  function dismiss() { if (inFlight.current || !canLeaveEditor()) return; setOpen(false); setConfirmReplace(false); setConfirmRemove(false); setEditing(false); setNewName(''); setNewSubject(''); setNewBody(''); onDismiss?.() }
  function select(id: string) { if (inFlight.current || !canLeaveEditor()) return; setSelected(id); setConfirmReplace(false); setConfirmRemove(false); setEditing(false); setNewName(''); setNewSubject(''); setNewBody(''); setCreateError('') }
  async function openLibrary() {
    if (inFlight.current) return
    inFlight.current = true; setOpening(true); setCreateError('')
    try { await onOpen?.(); setSelected(available[0]?.id || (canManage ? CREATE_TEMPLATE : '')); setConfirmReplace(false); setConfirmRemove(false); setEditing(false); setOpen(true) }
    catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Could not refresh templates. Please retry.') }
    finally { inFlight.current = false; setOpening(false) }
  }
  async function create() {
    if (inFlight.current || !canManage || !newName.trim() || !newBody.trim() || channel === 'email' && !newSubject.trim()) return
    if (available.some(template => (!editing || template.id !== preview?.id) && template.name.trim().toLowerCase() === newName.trim().toLowerCase())) {
      setCreateError('A template with this name already exists.'); return
    }
    inFlight.current = true; setCreating(true); setCreateError('')
    const template = { id: editing && preview ? preview.id : `custom-${crypto.randomUUID()}`, channel, category: 'Outreach', name: newName.trim(), subject: newSubject.trim(), body: newBody.trim() }
    try {
      if (editing) await onEdit?.(template); else await onCreate(template)
      setSelected(template.id); setEditing(false); setNewName(''); setNewSubject(''); setNewBody('')
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Could not save template.') } finally { inFlight.current = false; setCreating(false) }
  }
  async function remove() {
    if (!preview || !onRemove || !canManage || inFlight.current) return
    inFlight.current = true; setCreating(true); setCreateError('')
    try { await onRemove(preview); setSelected(''); setConfirmRemove(false) }
    catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Could not remove template.') }
    finally { inFlight.current = false; setCreating(false) }
  }
  function apply() {
    if (!preview) return
    if ((currentBody.trim() || currentSubject?.trim()) && !confirmReplace) { setConfirmReplace(true); return }
    onApply(preview, 'replace'); dismiss()
  }
  return <>
    <Button variant="secondary" disabled={opening} onClick={() => void openLibrary()}>{opening ? 'Loading templates…' : triggerLabel}</Button>
    {!open && createError && <Notice variant="error">{createError}</Notice>}
    <Modal isOpen={open} onClose={dismiss} closeOnEscape={!creating} closeOnBackdrop={!creating} size="wide" ariaLabel={channel === 'email' ? 'Email templates' : 'SMS templates'}>
      <ModalHeader title={channel === 'email' ? 'Email templates' : 'SMS templates'} onClose={dismiss} />
      <ModalBody>
        <OptionGallery label="Template gallery" options={[...available.map(template => ({ id: template.id, name: template.name })), ...(canManage ? [{ id: CREATE_TEMPLATE, name: 'Create new template' }] : [])]} selectedId={selectedId} onSelect={select} disabled={creating} />
        {(isCreating && canManage) || editing ? <section aria-label={editing ? 'Edit template' : 'Create template'} style={{ display: 'grid', gap: spacing.lg, marginTop: spacing.xl }}>
          <Input label="Template name" value={newName} maxLength={200} disabled={creating} onChange={event => setNewName(event.target.value)} />
          {channel === 'email' && <Input label="Subject" value={newSubject} maxLength={500} disabled={creating} onChange={event => setNewSubject(event.target.value)} />}
          <Textarea label="Message" value={newBody} rows={7} maxLength={20000} disabled={creating} onChange={event => setNewBody(event.target.value)} />
        </section> : preview ? <section aria-label="Template preview" style={{ marginTop: spacing.xl }}><SurfacePanel appearance="flat" style={{ overflowWrap: 'anywhere' }}>
          {channel === 'email' && <strong>{managementOnly ? preview.subject : fillMockTemplate(preview.subject, person)}</strong>}
          {preview.html ? <iframe title="Template content" sandbox="" referrerPolicy="no-referrer" srcDoc={prototypePreviewDocument(managementOnly ? preview.html : fillMockTemplate(preview.html, person))} style={{ width: '100%', height: 260, border: 0 }} /> : <p style={{ ...typography.body, whiteSpace: 'pre-wrap' }}>{managementOnly ? preview.body : fillMockTemplate(preview.body, person)}</p>}
        </SurfacePanel></section> : available.length > 0 ? <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Select a template.</p> : null}
        {confirmReplace && <Notice variant="warning" style={{ marginTop: spacing.lg }}>Replace your current email draft?</Notice>}
        {!available.length && !canManage && <Notice>No email templates yet.</Notice>}
        {confirmRemove && <Notice variant="warning">Remove this template for everyone? Existing emails and drafts will not change.</Notice>}
        {createError && <Notice variant="error">{createError}</Notice>}
      </ModalBody>
      <ModalFooter>
        {((isCreating && canManage) || editing) ? <><Button variant="secondary" disabled={creating} onClick={() => { setEditing(false); setSelected(available[0]?.id || CREATE_TEMPLATE); setCreateError('') }}>Cancel</Button><Button disabled={creating || !canManage || !newName.trim() || !newBody.trim() || channel === 'email' && !newSubject.trim()} onClick={() => void create()}>{creating ? 'Saving…' : 'Save template'}</Button></> : confirmRemove ? <><Button variant="secondary" disabled={creating} onClick={() => setConfirmRemove(false)}>Cancel</Button><Button variant="destructive" disabled={creating} onClick={() => void remove()}>{creating ? 'Removing…' : 'Confirm remove'}</Button></> : <>
          {canManage && preview && onEdit && <Button variant="secondary" onClick={() => { setNewName(preview.name); setNewSubject(preview.subject); setNewBody(preview.body); setEditing(true); setConfirmReplace(false); setCreateError('') }}>Edit template</Button>}
          {canManage && preview && onRemove && <Button variant="destructive" onClick={() => { setConfirmRemove(true); setConfirmReplace(false); setCreateError('') }}>Remove template</Button>}
          {confirmReplace && <Button variant="secondary" onClick={() => setConfirmReplace(false)}>Cancel</Button>}
          {!managementOnly && <Button disabled={!preview} onClick={apply}>{confirmReplace ? 'Replace email' : 'Use template'}</Button>}
        </>}
      </ModalFooter>
    </Modal>
  </>
}
