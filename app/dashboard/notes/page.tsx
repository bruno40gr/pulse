'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, MessageCircle, Pin, Trash2 } from 'lucide-react'
import { Button, EmptyState, PageContainer, PageHeader } from '@/components/ui'
import NoteConversationPanel from '@/components/notes/NoteConversationPanel'
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
  completed_at: string | null
  note_date: string
  reply_count: number
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

function getLocalDateValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  onToggleComplete: () => void
  onDelete: () => void
  onReply: () => void
}

function NoteCard(props: NoteCardProps) {
  const { note, editing, editTitle, editBody } = props
  const bg = NOTE_COLORS[note.color] || NOTE_COLORS.white
  const isWhite = note.color === 'white'
  const cardStyle: React.CSSProperties = {
    breakInside: 'avoid',
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: 390,
    maxHeight: 460,
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'hidden',
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
  const pinButtonStyle: React.CSSProperties = {
    ...iconBtnStyle,
    color: note.pinned ? '#DC2626' : 'rgba(55, 65, 81, 0.45)',
  }
  const completionButton = (
    <button
      type="button"
      onClick={props.onToggleComplete}
      title={note.completed_at ? 'Mark note as open' : 'Mark note as done'}
      aria-label={note.completed_at ? 'Mark note as open' : 'Mark note as done'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 7px', borderRadius: radius.sm,
        border: `1px solid ${note.completed_at ? '#86C99C' : colors.border}`,
        background: note.completed_at ? '#F0FDF4' : 'rgba(255,255,255,0.55)',
        color: note.completed_at ? colors.greenDark : colors.textSecondary,
        fontSize: '10px', fontWeight: typography.weightBold, letterSpacing: '0.05em', textTransform: 'uppercase',
        fontFamily: typography.fontSans, cursor: 'pointer', flexShrink: 0,
      }}
    >
      <Check size={12} strokeWidth={2.4} />
      {note.completed_at ? 'Done' : 'Mark done'}
    </button>
  )

  if (editing) {
    return (
      <div style={{ ...cardStyle, position: 'relative', overflowY: 'auto' }}>
        <button
          type="button"
          onClick={props.onPin}
          title={note.pinned ? 'Unpin note' : 'Pin note'}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          style={{ ...pinButtonStyle, position: 'absolute', top: spacing.md, left: spacing.md }}
        >
          <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
        </button>
        <div style={{ position: 'absolute', top: spacing.md, right: spacing.md }}>
          {completionButton}
        </div>
        <div style={{ paddingTop: 34 }}>
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
            style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'vertical', minHeight: 90 }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') props.onSaveEdit()
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Note color">
            {NOTE_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => props.onColor(key)}
                title={`Set color to ${key}`}
                aria-label={`Set color to ${key}`}
                style={{
                  width: 18, height: 18, borderRadius: '50%', background: NOTE_COLORS[key],
                  border: key === note.color ? `2px solid ${colors.text}` : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={props.onDelete}
            title="Delete note"
            aria-label="Delete note"
            style={{ ...iconBtnStyle, color: '#B91C1C' }}
          >
            <Trash2 size={16} />
          </button>
          <Button variant="ghost" size="sm" onClick={props.onCancelEdit}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={props.onSaveEdit}>Save</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...cardStyle, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={props.onPin}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        style={{ ...pinButtonStyle, position: 'absolute', top: spacing.md, left: spacing.md }}
      >
        <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
      </button>
      <div style={{ position: 'absolute', top: spacing.md, right: spacing.md }}>
        {completionButton}
      </div>
      <div style={{ minHeight: 0, flex: '1 1 auto', paddingTop: 34, overflow: 'hidden' }}>
        {note.title && (
          <div style={{
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
            fontWeight: 600, fontSize: 15, color: colors.text, marginBottom: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}>
            {note.title}
          </div>
        )}
        {note.body && (
          <div style={{
            display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 14, overflow: 'hidden',
            fontSize: 13.5, lineHeight: 1.5, color: colors.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}>
            <NoteBody body={note.body} />
          </div>
        )}
      </div>
      <div style={{ width: '100%', marginTop: spacing.md, paddingTop: spacing.sm, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Button variant="ghost" size="sm" onClick={props.onReply} style={{ color: colors.textSecondary }}>
            <MessageCircle size={14} aria-hidden="true" />
            {note.reply_count > 0 ? <strong>Replies {note.reply_count}</strong> : 'Reply'}
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onStartEdit}>
            Edit
          </Button>
        </div>
        <span style={{ display: 'block', fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.created_by || 'You'} · {formatTimestamp(note.updated_at)}
        </span>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [tenantId] = useState<string>(() => getActiveTenantId())
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [showDone, setShowDone] = useState(true)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftColor, setDraftColor] = useState('yellow')
  const [draftPinned, setDraftPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [conversationNote, setConversationNote] = useState<Note | null>(null)

  const handleReplyAdded = (noteId: string, replyCount: number) => {
    setNotes((current) => current.map((note) => note.id === noteId ? { ...note, reply_count: replyCount } : note))
    setConversationNote((current) => current?.id === noteId ? { ...current, reply_count: replyCount } : current)
  }

  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenant: tenantId })
      if (selectedDate) params.set('date', selectedDate)
      if (showDone) params.set('show_done', 'true')
      const res = await fetch(`/api/notes?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNotes(sortNotes(Array.isArray(data) ? data : []))
    } catch {
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, showDone, tenantId])

  useEffect(() => {
    setLoading(true)
    fetchNotes()
  }, [fetchNotes])

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

  const generateTitle = async (body: string): Promise<string | null> => {
    if (!body.trim()) return null
    try {
      const res = await fetch(`/api/notes/title?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null
    } catch {
      return null
    }
  }

  const handleAdd = async () => {
    const typedTitle = draftTitle.trim()
    const body = draftBody.trim()
    if (!typedTitle && !body) return
    setSaving(true)
    try {
      const title = typedTitle || await generateTitle(body)
      const res = await fetch(`/api/notes?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, color: draftColor, pinned: draftPinned, note_date: selectedDate || getLocalDateValue() }),
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

  const handleToggleComplete = (note: Note) => {
    const completed_at = note.completed_at ? null : new Date().toISOString()
    setNotes((prev) => {
      if (!showDone && completed_at) return prev.filter((entry) => entry.id !== note.id)
      return prev.map((entry) => (entry.id === note.id ? { ...entry, completed_at } : entry))
    })
    patchNote(note.id, { completed_at })
  }

  const handleDelete = (note: Note) => {
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    showToast('Note deleted', () => {
      fetch(`/api/notes?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: note.title, body: note.body, color: note.color, pinned: note.pinned, note_date: note.note_date }),
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

  const saveEdit = async () => {
    if (!editingId) return
    const id = editingId
    const typedTitle = editTitle.trim()
    const body = editBody.trim()
    if (!typedTitle && !body) { setEditingId(null); return }
    const title = typedTitle || await generateTitle(body)
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

      <div style={{
        display: 'flex', alignItems: 'end', gap: spacing.md, flexWrap: 'wrap', marginTop: `-${spacing.lg}`,
        marginBottom: spacing.xl,
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>
          Date {selectedDate ? '' : '(all dates)'}
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="Notes date"
            style={{
              minHeight: 36, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface,
              color: colors.text, padding: '0 10px', fontFamily: typography.fontSans, fontSize: typography.sizeSm,
            }}
          />
        </label>
        {selectedDate && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate('')}>
            All dates
          </Button>
        )}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm, minHeight: 36, color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeSm, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(event) => setShowDone(event.target.checked)}
            style={{ width: 16, height: 16, accentColor: colors.action, cursor: 'pointer' }}
          />
          Show done notes
        </label>
      </div>

      <div style={{ maxWidth: 390, marginBottom: spacing['2xl'] }}>
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
            <button
              type="button"
              onClick={() => setDraftPinned((v) => !v)}
              title={draftPinned ? 'Unpin' : 'Pin'}
              aria-label={draftPinned ? 'Unpin note' : 'Pin note'}
              style={{ ...iconBtnStyle, color: draftPinned ? '#DC2626' : 'rgba(55, 65, 81, 0.45)' }}
            >
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
        <div style={{ columnWidth: 390, columnGap: spacing.lg }}>
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
              onToggleComplete={() => handleToggleComplete(note)}
              onDelete={() => handleDelete(note)}
              onReply={() => setConversationNote(note)}
            />
          ))}
        </div>
      )}

      <NoteConversationPanel
        note={conversationNote}
        tenantId={tenantId}
        onReplyAdded={handleReplyAdded}
        onClose={() => setConversationNote(null)}
      />

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


