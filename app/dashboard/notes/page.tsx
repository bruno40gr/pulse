'use client'

import { useEffect, useState } from 'react'
import { Pin, Trash2 } from 'lucide-react'
import { Button, EmptyState, PageContainer, PageHeader } from '@/components/ui'
import MentionTextarea from '@/components/notes/MentionTextarea'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'

interface Note {
  id: string
  tenant_id: string
  title: string | null
  body: string
  color: string
  pinned: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

const NOTE_COLORS: Record<string, string> = {
  yellow: '#FEF08A',
  orange: '#FED7AA',
  pink: '#FBCFE8',
  purple: '#DDD6FE',
  blue: '#BFDBFE',
  green: '#BBF7D0',
  gray: '#E5E7EB',
  white: '#FFFFFF',
}
const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS)

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: '#374151',
  cursor: 'pointer',
}

function NoteBody({ body }: { body: string }) {
  const parts = body.split(/(@[\u00A0A-Za-z0-9._-]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.length > 1 && part.startsWith('@') ? (
          <span
            key={i}
            style={{
              display: 'inline-block',
              background: '#1F2937',
              color: '#FFFFFF',
              borderRadius: 6,
              padding: '0 6px',
              fontWeight: 600,
            }}
          >
            {part.replace(/\u00A0/g, ' ')}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

interface NoteCardProps {
  note: Note
  editing: boolean
  editTitle: string
  editBody: string
  onStartEdit: () => void
  onEditTitle: (v: string) => void
  onEditBody: (v: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onPin: () => void
  onColor: (color: string) => void
  onDelete: () => void
}

function NoteCard(props: NoteCardProps) {
  const { note, editing, editTitle, editBody } = props
  const bg = NOTE_COLORS[note.color] || NOTE_COLORS.white
  const isWhite = note.color === 'white'
  const cardStyle: React.CSSProperties = {
    breakInside: 'avoid',
    marginBottom: spacing.lg,
    background: bg,
    border: `1px solid ${isWhite ? colors.border : 'rgba(0,0,0,0.06)'}`,
    borderRadius: radius.md,
    boxShadow: shadows.sm,
    padding: spacing.lg,
  }
  const plainInput: React.CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: typography.fontSans,
    color: colors.text,
  }

  if (editing) {
    return (
      <div style={cardStyle}>
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => props.onEditTitle(e.target.value)}
          placeholder="Title"
          style={{ ...plainInput, fontSize: 15, fontWeight: 600, marginBottom: spacing.sm }}
        />
        <MentionTextarea
          value={editBody}
          onChange={props.onEditBody}
          placeholder="Take a note…"
          style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'none', minHeight: 90 }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') props.onSaveEdit()
          }}
        />
        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.md }}>
          <Button variant="ghost" size="sm" onClick={props.onCancelEdit}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={props.onSaveEdit}>Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div onClick={props.onStartEdit} style={{ cursor: 'text' }}>
        {note.title && (
          <div style={{ fontWeight: 600, fontSize: 15, color: colors.text, marginBottom: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {note.title}
          </div>
        )}
        {note.body && (
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: colors.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <NoteBody body={note.body} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
        <span style={{ fontSize: 11, color: '#374151' }}>{note.created_by || 'You'} · {formatTimestamp(note.updated_at)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ display: 'flex', gap: 3, marginRight: 6 }}>
            {NOTE_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => props.onColor(key)}
                title={key}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: NOTE_COLORS[key],
                  border: key === note.color ? `2px solid ${colors.text}` : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <button type="button" onClick={props.onPin} title={note.pinned ? 'Unpin' : 'Pin'} style={iconBtnStyle}>
            <Pin size={15} fill={note.pinned ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={props.onDelete} title="Delete" style={iconBtnStyle}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [tenantId] = useState<string>(() => getActiveTenantId())
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftColor, setDraftColor] = useState('yellow')
  const [draftPinned, setDraftPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/notes?tenant=${tenantId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotes(sortNotes(Array.isArray(data) ? data : []))
    } catch {
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchNotes() }, [tenantId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (message: string, undo?: () => void) => setToast({ message, undo })

  const resetComposer = () => {
    setDraftTitle(''); setDraftBody(''); setDraftColor('yellow'); setDraftPinned(false)
  }

  const patchNote = (id: string, updates: Record<string, unknown>) => {
    fetch(`/api/notes/${id}?tenant=${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {})
  }

  const handleAdd = async () => {
    const title = draftTitle.trim()
    const body = draftBody.trim()
    if (!title && !body) return
    setSaving(true)
    try {
      const res = await fetch(`/api/notes?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, color: draftColor, pinned: draftPinned }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'Request failed')
      }
      const created = await res.json()
      setNotes((prev) => sortNotes([created, ...prev]))
      resetComposer()
    } catch (error) {
      showToast(`Could not save note${error instanceof Error ? ` — ${error.message}` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const handlePin = (note: Note) => {
    const next = !note.pinned
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === note.id ? { ...n, pinned: next } : n))))
    patchNote(note.id, { pinned: next })
  }

  const handleColor = (note: Note, color: string) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, color } : n)))
    patchNote(note.id, { color })
  }

  const handleDelete = (note: Note) => {
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    showToast('Note deleted', () => {
      fetch(`/api/notes?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: note.title, body: note.body, color: note.color, pinned: note.pinned }),
      })
        .then((r) => r.json())
        .then((created) => { if (created?.id) setNotes((prev) => sortNotes([created, ...prev])) })
        .catch(() => {})
    })
    fetch(`/api/notes/${note.id}?tenant=${tenantId}`, { method: 'DELETE' }).catch(() => {})
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditTitle(note.title || '')
    setEditBody(note.body)
  }

  const saveEdit = () => {
    if (!editingId) return
    const id = editingId
    const title = editTitle.trim()
    const body = editBody.trim()
    if (!title && !body) { setEditingId(null); return }
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? { ...n, title: title || null, body, updated_at: new Date().toISOString() } : n))))
    setEditingId(null)
    patchNote(id, { title: title || null, body })
  }

  const composerBg = NOTE_COLORS[draftColor] || NOTE_COLORS.white
  const plainInput: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontFamily: typography.fontSans, color: colors.text,
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notes"
        subtitle="Quick thoughts, names, phone numbers. Jot it down."
      />

      <div style={{ maxWidth: 620, marginBottom: spacing['2xl'] }}>
        <div style={{ background: composerBg, border: '1px solid rgba(0,0,0,0.06)', borderRadius: radius.md, boxShadow: shadows.md, padding: spacing.lg }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title"
            style={{ ...plainInput, fontSize: 15, fontWeight: 600, marginBottom: spacing.sm }}
          />
          <MentionTextarea
            value={draftBody}
            onChange={setDraftBody}
            placeholder="Take a note…"
            style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'none', minHeight: 72 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {NOTE_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraftColor(key)}
                  title={key}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: NOTE_COLORS[key],
                    border: key === draftColor ? `2px solid ${colors.text}` : '1px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
            <button type="button" onClick={() => setDraftPinned((v) => !v)} title={draftPinned ? 'Unpin' : 'Pin'} style={iconBtnStyle}>
              <Pin size={16} fill={draftPinned ? 'currentColor' : 'none'} />
            </button>
            <div style={{ flex: 1 }} />
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={saving || (!draftTitle.trim() && !draftBody.trim())}>
              {saving ? 'Saving…' : 'Add'}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: typography.sizeBase, color: colors.textMuted }}>Loading notes…</div>
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Capture a quick thought, a name, or a phone number and it will live here as a sticky note."
        />
      ) : (
        <div style={{ columnWidth: 240, columnGap: spacing.lg }}>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              editing={editingId === note.id}
              editTitle={editTitle}
              editBody={editBody}
              onStartEdit={() => startEdit(note)}
              onEditTitle={setEditTitle}
              onEditBody={setEditBody}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingId(null)}
              onPin={() => handlePin(note)}
              onColor={(color) => handleColor(note, color)}
              onDelete={() => handleDelete(note)}
            />
          ))}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: spacing.md, background: colors.action, color: '#fff',
          padding: `${spacing.sm} ${spacing.lg}`, borderRadius: radius.lg, boxShadow: shadows.lg,
        }}>
          <span style={{ fontSize: 13 }}>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => { toast.undo?.(); setToast(null) }}
              style={{ background: 'transparent', border: 'none', color: '#FF5C7A', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </PageContainer>
  )
}


