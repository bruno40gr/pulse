'use client'

import { useState } from 'react'
import { Button, FieldGrid, Input, Notice, Select, SlidePanel, SlidePanelHeader, Textarea } from '@/components/ui'
import { spacing, typography, colors } from '@/lib/tokens'
import { followUpPatch, updateLeadFollowUps, type FollowUpPatch } from '@/lib/lead-bulk-follow-up'

export type BulkFollowUpTarget = { id: string; name: string; date: string; reminder: string }

export function LeadBulkFollowUpPanel({ targets, onSave, onClose }: {
  targets: BulkFollowUpTarget[]; onSave: (id: string, patch: FollowUpPatch) => Promise<void>; onClose: () => void
}) {
  const mixedDate = targets.some(target => target.date !== targets[0]?.date)
  const mixedReminder = targets.some(target => target.reminder !== targets[0]?.reminder)
  const [date, setDate] = useState(mixedDate ? '' : targets[0]?.date || '')
  const [reminder, setReminder] = useState(mixedReminder ? '' : targets[0]?.reminder || '')
  const [dateChanged, setDateChanged] = useState(false)
  const [reminderChanged, setReminderChanged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [retry, setRetry] = useState<{ ids: string[]; patch: FollowUpPatch } | null>(null)
  const close = () => { if (!saving) onClose() }
  async function submit() {
    setError('')
    let patch: FollowUpPatch
    try { patch = retry?.patch || followUpPatch({ date, reminder, dateChanged, reminderChanged }) }
    catch (error) { setError(error instanceof Error ? error.message : 'Check the follow-up date.'); return }
    if (!Object.keys(patch).length) return
    setSaving(true)
    const ids = retry?.ids || targets.map(target => target.id)
    let completed = 0
    const result = await updateLeadFollowUps(ids, patch, async (id, payload) => {
      try { await onSave(id, payload) }
      finally { completed++; setProgress(`Processed ${completed} of ${ids.length} leads.`) }
    })
    setSaving(false)
    if (!result.failed.length) { onClose(); return }
    setRetry({ ids: result.failed.map(item => item.id), patch })
    setError(`${targets.length - result.failed.length} of ${targets.length} leads updated. Could not update: ${result.failed.map(item => `${targets.find(target => target.id === item.id)?.name || item.id}: ${item.error}`).join('; ')}. Retry updates only these leads.`)
  }
  return <SlidePanel isOpen onClose={close} width="min(92vw, 520px)">
    <SlidePanelHeader title="Update follow up" subtitle={`${targets.length} ${targets.length === 1 ? 'lead' : 'leads'} selected`} onClose={close} />
    <form onSubmit={event => { event.preventDefault(); void submit() }} style={{ padding: spacing.lg, display: 'grid', gap: spacing.lg, overflowY: 'auto' }}>
      <p id="bulk-follow-up-help" style={{ ...typography.helper, color: colors.textSecondary, margin: 0 }}>Type to update everyone, leave a box blank to keep their current info, or clear a box to delete it for all.</p>
      <FieldGrid columns={1}>
        <FieldGrid>
          <Input label="Date" type="date" value={date} aria-describedby="bulk-follow-up-help" hint={mixedDate && !dateChanged ? 'Mixed — selected leads have different dates.' : undefined} disabled={saving || !!retry} onChange={event => { setDate(event.target.value); setDateChanged(true) }} />
          <Select label="Quick pick" value="" disabled={saving || !!retry} onChange={event => {
            const days = Number(event.target.value)
            if (!days) return
            const chosen = new Date()
            chosen.setDate(chosen.getDate() + days)
            setDate(`${chosen.getFullYear()}-${String(chosen.getMonth() + 1).padStart(2, '0')}-${String(chosen.getDate()).padStart(2, '0')}`)
            setDateChanged(true)
          }}>
            <option value="">Choose an interval</option>
            <option value="1">Tomorrow</option>
            <option value="7">Next week</option>
            <option value="30">Next month</option>
          </Select>
        </FieldGrid>
        {mixedDate && !dateChanged && <Button type="button" variant="ghost" disabled={saving || !!retry} onClick={() => { setDate(''); setDateChanged(true) }}>Clear follow-up date</Button>}
        <Textarea label="Reminder note" value={reminder} placeholder={mixedReminder && !reminderChanged ? 'Mixed' : undefined} aria-describedby="bulk-follow-up-help" rows={4} maxLength={12000} disabled={saving || !!retry} onChange={event => { setReminder(event.target.value); setReminderChanged(true) }} />
        {mixedReminder && !reminderChanged && <Button type="button" variant="ghost" disabled={saving || !!retry} onClick={() => { setReminder(''); setReminderChanged(true) }}>Clear follow-up reminder</Button>}
      </FieldGrid>
      {error && <Notice variant="error">{error}</Notice>}
      {saving && <p role="status">{progress || 'Updating leads…'}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
        <Button type="submit" disabled={saving || (!retry && !dateChanged && !reminderChanged)}>{saving ? 'Updating…' : retry ? `Retry ${retry.ids.length} failed ${retry.ids.length === 1 ? 'lead' : 'leads'}` : 'Update follow'}</Button>
        <Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
      </div>
    </form>
  </SlidePanel>
}