'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Input, Textarea } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'
import styles from './LeadFollowUpCell.module.css'

/** Direct cell editing: explicit confirmation, retained failed drafts, no blur saves. */
export function LeadFollowUpCell({ name, field, date, reminder, dateLabel, dateStyle, onSave }: {
  name: string; field: 'date' | 'reminder'; date: string; reminder: string; dateLabel: string; dateStyle?: CSSProperties
  onSave: (date: string, reminder: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<'date' | 'reminder' | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dateTrigger = useRef<HTMLButtonElement>(null)
  const noteTrigger = useRef<HTMLButtonElement>(null)
  function close() {
    const trigger = editing === 'date' ? dateTrigger : noteTrigger
    setEditing(null); setError('')
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function save() {
    if (saving) return
    setSaving(true); setError('')
    try {
      await onSave(editing === 'date' ? draft : date, editing === 'reminder' ? draft : reminder)
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save follow-up')
    } finally { setSaving(false) }
  }
  function start(field: 'date' | 'reminder') {
    setDraft(field === 'date' ? date : reminder); setError(''); setEditing(field)
  }
  return <div className={styles.cell} onKeyDown={event => {
    if (!editing) return
    if (event.key === 'Escape' && !saving) { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'Enter' && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) && (editing === 'date' || event.metaKey || event.ctrlKey)) { event.preventDefault(); void save() }
  }}>
    {editing === field ? <div key={field} className={styles.editor} aria-busy={saving}>
      {field === 'date' ? <Input autoFocus type="date" aria-label={`Follow-up date for ${name}`} value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} /> : <Textarea autoFocus aria-label={`Follow-up reminder for ${name}`} rows={3} value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} />}
      <div style={{ display: 'flex', gap: spacing.xs }}>
        <ControlButton kind="icon" aria-label={`Save follow-up ${field}`} title="Save" disabled={saving} onClick={() => void save()}><Check size={16} /></ControlButton>
        <ControlButton kind="icon" aria-label={`Cancel follow-up ${field} edit`} title="Cancel" disabled={saving} onClick={close}><X size={16} /></ControlButton>
      </div>
      {error && <span role="alert" style={{ ...typography.bodySmall, color: colors.error }}>{error}</span>}
    </div> : <ControlButton key={field} ref={field === 'date' ? dateTrigger : noteTrigger} kind="name" className={styles.trigger} aria-label={`Edit follow-up ${field} for ${name}`} title={field === 'reminder' ? reminder || 'Edit follow-up reminder' : 'Edit follow-up date'} disabled={editing !== null} onClick={() => start(field)} style={field === 'date' ? dateStyle : undefined}>
      <span className={field === 'reminder' ? styles.preview : undefined}>{field === 'date' ? dateLabel : reminder}</span><Pencil aria-hidden="true" className={styles.pencil} size={13} />
    </ControlButton>}
  </div>
}
