'use client'

import { useEffect, useRef, useState } from 'react'
import { FollowUpModal, type FollowUpEditorDraft } from './FollowUpModal'
import { Button, DenseSectionPanel, Notice } from '@/components/ui'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { sharedFollowUpsEnabled, type SharedFollowUp } from '@/lib/shared-follow-up'
import { spacing, typography, colors } from '@/lib/tokens'
import { contactFollowUpSummary, type ContactFollowUpSummary } from '@/lib/contact-follow-up-summary'

type Props = { personId: string; tenantId: string; name: string; canEdit: boolean; onChanged?: (summary: ContactFollowUpSummary) => void }

const dateInput = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Panels read the date AND message; only the shared modal edits them. */
export function ContactFollowUps(props: Props) {
  if (!sharedFollowUpsEnabled()) return null
  return <ContactFollowUpsContent key={`${props.tenantId}:${props.personId}`} {...props} />
}

function ContactFollowUpsContent({ personId, tenantId, name, canEdit, onChanged }: Props) {
  const [rows, setRows] = useState<SharedFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canEditInquiries, setCanEditInquiries] = useState(false)
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState<{ record: SharedFollowUp | null; draft: FollowUpEditorDraft } | null>(null)
  const [busy, setBusy] = useState(false)
  const savingRef = useRef(false)
  const endpoint = `/api/contacts/${encodeURIComponent(personId)}/follow-ups?tenant=${encodeURIComponent(tenantId)}`
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    void (async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || !Array.isArray(data.follow_ups)) throw new Error(data.error || 'Could not load follow-ups.')
        if (!controller.signal.aborted) { setRows(data.follow_ups); setCanEditInquiries(data.can_edit_inquiries === true) }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load follow-ups.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [endpoint, reload])
  function launch(record: SharedFollowUp | null) {
    setError(''); setEditor({ record, draft: { date: dateInput(record?.due_at ?? null), reminder: record?.message ?? '' } })
  }
  async function mutate(record: SharedFollowUp | null, action: 'save' | 'clear' | 'complete', due: string | null = null, reminder: string | null = null) {
    if (savingRef.current) return false
    savingRef.current = true
    setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action, lead_intake_id: record?.lead_intake_id ?? null, expected_version: record?.version ?? 0, due_at: due, message: reminder,
      }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save follow-up.')
      const next = [...rows.filter(item => item.id !== data.follow_up.id), data.follow_up]
      setRows(next)
      onChanged?.(contactFollowUpSummary(next))
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save follow-up.')
      return false
    } finally { savingRef.current = false; setBusy(false) }
  }
  const general = rows.find(row => !row.lead_intake_id)
  const open = rows.filter(row => row.status === 'open')
  return <>
    <DenseSectionPanel title="Follow-up" actions={!loading && !error && canEdit && general?.status !== 'open'
      ? <Button size="sm" variant="secondary" onClick={() => launch(general ?? null)}>Add follow-up</Button> : undefined}>
      {loading ? <LoadingSkeleton label="Loading follow-ups" rows={2} /> : <div style={{ display: 'grid', gap: spacing.lg }}>
        {error && <Notice variant="error">{error} <Button size="sm" variant="ghost" disabled={busy || Boolean(editor)} onClick={() => setReload(value => value + 1)}>Reload follow-ups</Button></Notice>}
        {!error && open.length === 0 && <p style={{ ...typography.bodySmall, margin: 0, color: colors.textSecondary }}>No follow-up scheduled.</p>}
        {open.map(row => <DenseSectionPanel key={row.id} title={row.lead_intake_id ? 'Inquiry follow-up' : 'Contact follow-up'} actions={canEdit && (!row.lead_intake_id || canEditInquiries) ? <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => launch(row)}>Edit follow-up</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void mutate(row, 'complete')}>Complete</Button>
        </div> : undefined}>
          <div style={{ display: 'grid', gap: spacing.sm, ...typography.bodySmall }}>
            <span>{new Date(row.due_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {row.message && <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.message}</span>}
            {row.lead_intake_id && <a href={`/dashboard/leads?lead=${encodeURIComponent(row.lead_intake_id)}`}>Open linked inquiry</a>}
          </div>
        </DenseSectionPanel>)}
      </div>}
    </DenseSectionPanel>
    {editor && <FollowUpModal name={name} date={editor.draft.date} reminder={editor.draft.reminder} hasFollowUp={editor.record?.status === 'open'} busy={busy}
      onDraftChange={draft => setEditor(current => current && { ...current, draft })}
      onClose={() => setEditor(null)} onSave={patch => mutate(editor.record, patch.follow_up_at ? 'save' : 'clear', patch.follow_up_at ?? null, patch.follow_up_note ?? null)} />}
  </>
}