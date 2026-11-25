'use client'

import { useState } from 'react'
import { FollowUpModal, type FollowUpEditorDraft } from '@/components/follow-ups/FollowUpModal'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Notice } from '@/components/ui/Notice'
import { colors, spacing, typography } from '@/lib/tokens'

/** The production modal with fictional, in-memory data. No API calls or persisted records. */
export function FollowUpShowcase({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [saved, setSaved] = useState<FollowUpEditorDraft>({ date: '', reminder: '' })
  const [draft, setDraft] = useState(saved)
  const [failSave, setFailSave] = useState(false)
  const [message, setMessage] = useState('')
  function launch(existing: boolean) {
    const next = existing ? { date: '2026-12-01', reminder: 'Call Alex about lesson availability.' } : { date: '', reminder: '' }
    setSaved(next); setDraft(next); setMessage(''); setOpen(true)
  }
  return <DenseSectionPanel title="Follow-up modal" actions={<Button variant="secondary" size="sm" onClick={() => launch(false)}>Add follow-up</Button>}>
    <div style={{ display: 'grid', gap: spacing.lg }}>
      <p style={{ ...typography.bodySmall, margin: 0, color: colors.textSecondary }}>Interactive preview of the actual Leads modal. Alex Morgan is fictional; saves affect this preview only.</p>
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={() => launch(true)}>Preview existing follow-up</Button>
        <Button variant="ghost" size="sm" onClick={() => setFailSave(value => !value)} aria-pressed={failSave}>Save failure: {failSave ? 'On' : 'Off'}</Button>
      </div>
      {message && <Notice variant="success">{message}</Notice>}
    </div>
    {open && <FollowUpModal name="Alex Morgan" date={draft.date} reminder={draft.reminder} hasFollowUp={Boolean(saved.date)} onDraftChange={setDraft} onClose={() => setOpen(false)} onSave={async patch => {
      if (failSave) return false
      const next = { date: patch.follow_up_at ? draft.date : '', reminder: patch.follow_up_note || '' }
      setSaved(next); setDraft(next)
      setMessage(patch.follow_up_at ? 'Follow-up saved in this preview only.' : 'Follow-up cleared in this preview only.')
      return true
    }} />}
  </DenseSectionPanel>
}