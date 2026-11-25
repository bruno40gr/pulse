'use client'

import { useRef, useState } from 'react'
import { Button, FieldGrid, Input, Notice, Select, Textarea } from '@/components/ui'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { followUpPatch, type FollowUpPatch } from '@/lib/lead-bulk-follow-up'

export type FollowUpEditorDraft = { date: string; reminder: string }

/** Persistence is supplied by the caller; opening this editor never writes a record. */
export function FollowUpModal({ name, date, reminder, hasFollowUp, busy = false, onDraftChange, onSave, onClose }: {
  name: string
  date: string
  reminder: string
  hasFollowUp: boolean
  busy?: boolean
  onDraftChange: (draft: FollowUpEditorDraft) => void
  onSave: (patch: FollowUpPatch) => Promise<boolean>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const disabled = busy || saving
  const close = () => { if (!disabled && !savingRef.current) onClose() }
  async function submit(clear = false) {
    if (disabled || savingRef.current) return
    let patch: FollowUpPatch
    try {
      if (!clear && !date) throw new Error('Choose a follow-up date.')
      if (!clear && reminder.length > 12000) throw new Error('Use a reminder of up to 12000 characters.')
      patch = followUpPatch({ date: clear ? '' : date, reminder: clear ? '' : reminder, dateChanged: true, reminderChanged: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the follow-up details.'); return }
    savingRef.current = true
    setSaving(true); setError('')
    try {
      if (await onSave(patch)) onClose()
      else setError('Could not save follow-up. Your draft is retained. Please try again.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save follow-up. Your draft is retained.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  return <Modal isOpen onClose={close} size="md" ariaLabel={`${name} follow-up`} closeOnBackdrop={!disabled} closeOnEscape={!disabled}>
    <ModalHeader title={`${name} follow-up`} onClose={close} />
    <form onSubmit={event => { event.preventDefault(); void submit() }} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <ModalBody>
        <FieldGrid columns={1}>
          <FieldGrid>
            <Input label="Date" type="date" value={date} disabled={disabled} onChange={event => { setError(''); onDraftChange({ date: event.target.value, reminder }) }} />
            <Select label="Quick pick" value="" disabled={disabled} onChange={event => {
              const days = { tomorrow: 1, next_week: 7, next_month: 30 }[event.target.value]
              if (!days) return
              const chosen = new Date(); chosen.setDate(chosen.getDate() + days)
              setError('')
              const nextDate = `${chosen.getFullYear()}-${String(chosen.getMonth() + 1).padStart(2, '0')}-${String(chosen.getDate()).padStart(2, '0')}`
              onDraftChange({ date: nextDate, reminder })
            }}>
              <option value="">Choose an interval</option>
              <option value="tomorrow">Tomorrow</option><option value="next_week">Next week</option><option value="next_month">Next month</option>
            </Select>
          </FieldGrid>
          <Textarea label="Reminder note" value={reminder} maxLength={12000} rows={4} disabled={disabled} placeholder="Optional reminder note" onChange={event => { setError(''); onDraftChange({ date, reminder: event.target.value }) }} />
          {error && <Notice variant="error">{error}</Notice>}
        </FieldGrid>
      </ModalBody>
      <ModalFooter leading={hasFollowUp ? <Button type="button" variant="ghost" disabled={disabled} onClick={() => void submit(true)}>Clear follow-up</Button> : undefined}>
        <Button type="button" variant="secondary" disabled={disabled} onClick={close}>Cancel</Button>
        <Button type="submit" disabled={disabled}>{saving ? 'Saving…' : 'Save follow-up'}</Button>
      </ModalFooter>
    </form>
  </Modal>
}