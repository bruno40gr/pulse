'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, NotesSection, Notice } from '@/components/ui'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { colors, spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

type BandNote = { id: string; body: string; title?: string | null; created_at: string; created_by?: string | null; completed_at?: string | null; updated_at?: string }

/** The same chronological notes list/editor as Contacts and Leads, not sticky cards. */
export default function BandNotes({ bandName }: { bandName: string }) {
  const tenant = getActiveTenantId()
  const query = `tenant=${encodeURIComponent(tenant)}`
  const [notes, setNotes] = useState<BandNote[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const inFlight = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setCanManage(false)
    void fetch(`/api/notes?${query}&band=${encodeURIComponent(bandName)}&show_done=true`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const rows = await response.json()
        if (!response.ok || !Array.isArray(rows)) throw new Error(rows.error || 'Could not load band notes.')
        if (controller.signal.aborted) return
        setNotes(rows); setCanManage(response.headers.get('X-Notes-Can-Manage') === 'true')
      }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [bandName, query, revision])
  async function mutate(path: string, method: 'POST' | 'PATCH', body: object) {
    if (!canManage || inFlight.current) return false
    inFlight.current = true; setSaving(true); setError('')
    try {
      const response = await fetch(`${path}?${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const note = await response.json()
      if (!response.ok || !note.id) throw new Error(note.error || 'Could not save the note.')
      setNotes(current => method === 'POST' ? [note, ...current] : current.map(row => row.id === note.id ? { ...row, ...note } : row))
      return true
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the note.'); return false }
    finally { inFlight.current = false; setSaving(false) }
  }
  if (loading) return <LoadingSkeleton label="Loading band notes" rows={3} />
  if (error && !notes.length && !canManage) return <Notice variant="error">{error}<Button variant="secondary" size="sm" onClick={() => setRevision(value => value + 1)}>Retry</Button></Notice>
  return <div style={{ display: 'grid', gap: spacing.md }}>
    {error && <Notice variant="error">{error}</Notice>}
    <NotesSection title="Internal notes" notes={notes.map(note => ({ id: note.id, text: note.title ? `${note.title}\n${note.body}` : note.body,
      timestamp: note.created_at, actor_name: note.created_by, completed_at: note.completed_at, editable: canManage }))}
      avatarInitial="T" avatarBg={colors.textMuted} cardBg={colors.surface} panel saving={saving} mentionsEnabled={canManage}
      helperText="Internal staff notes for this band." addLabel="Add a note"
      onSave={canManage ? (text, mention_membership_ids) => mutate('/api/notes', 'POST', { body: text, band_name: bandName, mention_membership_ids }) : undefined}
      onEdit={canManage ? (entry, text) => mutate(`/api/notes/${encodeURIComponent(entry.id!)}`, 'PATCH', { title: '', body: text }) : undefined}
      onToggleComplete={canManage ? async index => {
        const note = notes[index]
        if (note) await mutate(`/api/notes/${encodeURIComponent(note.id)}`, 'PATCH', { completed_at: note.completed_at ? null : new Date().toISOString() })
      } : undefined} />
  </div>
}