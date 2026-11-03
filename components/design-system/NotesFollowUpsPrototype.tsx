'use client'

// Isolated review mirror of the existing Notes composer/card presentation.
// Keep production Notes unchanged; only task affordances are experimental.
import { useEffect, useState, type CSSProperties } from 'react'
import { Lock, MessageCircle, Pin, Trash2 } from 'lucide-react'
import { Button, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageContainer, PageHeader, Select } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { TaskCompletionButton } from '@/components/ui/TaskCompletionButton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import MentionTextarea from '@/components/notes/MentionTextarea'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { formatFullTimestamp, formatPresentationDate } from '@/lib/presentation-date'
import { NOTE_COLORS, getNoteBackground } from '@/lib/sticky-note-appearance'
import { initialReviewNotes, localReviewDate, promoteReviewNote, PROTOTYPE_STORAGE_KEY, readReviewNotes, REVIEW_OWNERS, REVIEW_PEOPLE, type FollowUp, type PrototypeNote } from '@/lib/notes-follow-ups-prototype'
const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS)
interface Note {
  id: string; title: string; body: string; color: string; pinned: boolean; is_private: boolean;
  participant_count: number; created_by: string; completed_at: string | null; created_at: string; reply_count: number;
  followUp: FollowUp | null
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
  editMentionIds: string[]
  onStartEdit: () => void
  onEditTitle: (v: string) => void
  onEditBody: (v: string) => void
  onEditMentionIds: (ids: string[]) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onPin: () => void
  onColor: (color: string) => void
  onToggleComplete: () => void
  onDelete: () => void
  onTask: () => void
  taskLabel: string
  onReply: () => void
}

function NoteCard(props: NoteCardProps) {
  const { note, editing, editTitle, editBody } = props
  const bg = getNoteBackground(note.color, Boolean(note.completed_at))
  const isWhite = note.color === 'white'
  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 390,
    minHeight: 300,
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
  const completionButton = (
    <TaskCompletionButton completed={Boolean(note.completed_at)}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        props.onToggleComplete()
      }}
      title={note.completed_at ? 'Mark note as open' : 'Mark note as done'}
      aria-label={note.completed_at ? 'Mark note as open' : 'Mark note as done'}
    >
    </TaskCompletionButton>
  )

  if (editing) {
    return (
      <div style={{ ...cardStyle, position: 'relative', overflowY: 'auto' }}>
        <ControlButton kind="icon" selected={note.pinned}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            props.onPin()
          }}
          title={note.pinned ? 'Unpin note' : 'Pin note'}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          style={{ width: 26, position: 'absolute', top: spacing.md, left: spacing.md }}
        >
          <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
        </ControlButton>
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
            mentionMembershipIds={props.editMentionIds}
            onMentionMembershipIdsChange={props.onEditMentionIds}
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
              <ColorSwatch selected={key === note.color} color={NOTE_COLORS[key]} label={`Set color to ${key}`}
                key={key}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  props.onColor(key)
                }}
                title={`Set color to ${key}`}
                aria-label={`Set color to ${key}`}
              />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <ControlButton kind="icon"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              props.onDelete()
            }}
            title="Delete note"
            aria-label="Delete note"
            style={{ width: 26 }}
          >
            <Trash2 size={16} />
          </ControlButton>
          <Button variant="ghost" size="sm" onClick={props.onCancelEdit}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={props.onSaveEdit}>Save</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={props.onStartEdit}
      style={{ ...cardStyle, position: 'relative', display: 'flex', flexDirection: 'column', cursor: 'text' }}
    >
      <ControlButton kind="icon" selected={note.pinned}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          props.onPin()
        }}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        style={{ width: 26, position: 'absolute', top: spacing.md, left: spacing.md }}
      >
        <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
      </ControlButton>
      <div onClick={(event) => event.stopPropagation()} style={{ position: 'absolute', top: spacing.md, right: spacing.md, display: 'flex', gap: spacing.xs }}>
        <Button variant="ghost" size="sm" onClick={props.onTask}>{note.followUp ? 'Task details' : 'Make a task'}</Button>
        {completionButton}
      </div>
      <div style={{ minHeight: 0, flex: '1 1 auto', paddingTop: 34, overflow: 'hidden', textDecoration: note.completed_at ? 'line-through' : 'none' }}>
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
        {note.followUp && <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs }}>
          {note.followUp.title !== note.title && <div style={{ fontWeight: typography.weightSemibold }}>Task: {note.followUp.title}</div>}
          {props.taskLabel}
        </div>}
        {note.is_private && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.textSecondary, fontSize: 11, fontWeight: typography.weightSemibold, marginBottom: spacing.xs }}>
            <Lock size={12} aria-hidden="true" />
            Private · {note.participant_count} {note.participant_count === 1 ? 'person' : 'people'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); props.onReply() }} >
            <MessageCircle size={14} aria-hidden="true" />
            {note.reply_count > 0 ? <strong>Replies {note.reply_count}</strong> : 'Reply'}
          </Button>
          <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); props.onStartEdit() }}>
            Edit
          </Button>
        </div>
        <span style={{ display: 'block', fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.created_by || 'You'} · <time dateTime={note.created_at} title={formatFullTimestamp(note.created_at)} aria-label={formatFullTimestamp(note.created_at)}>{formatPresentationDate(note.created_at)}</time>
        </span>
      </div>
    </div>
  )
}

export default function NotesFollowUpsPrototype() {
  const [notes, setNotes] = useState<PrototypeNote[]>([])
  const [ready, setReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [showDone, setShowDone] = useState(true)
  const [editing, setEditing] = useState<PrototypeNote | null>(null)
  const [draft, setDraft] = useState<FollowUp>({ title: '', personId: null, ownerId: 'admin', dueDate: '' })
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editMentionIds, setEditMentionIds] = useState<string[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftMentionIds, setDraftMentionIds] = useState<string[]>([])
  const [draftColor, setDraftColor] = useState('yellow')
  const [draftPinned, setDraftPinned] = useState(false)
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const today = localReviewDate()
  const plainInput: CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, color: colors.text, boxSizing: 'border-box' }
  const composerBg = NOTE_COLORS[draftColor] || NOTE_COLORS.white

  useEffect(() => {
    let restored: PrototypeNote[] | null = null
    try {
      const raw = localStorage.getItem(PROTOTYPE_STORAGE_KEY)
      if (raw) restored = readReviewNotes(JSON.parse(raw).notes)
    } catch { setStorageWarning('Browser storage is unavailable. Changes last for this visit only.') }
    setNotes(restored || initialReviewNotes())
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify({ notes })) }
    catch { setStorageWarning('Browser storage is unavailable. Changes last for this visit only.') }
  }, [notes, ready])

  const updateNote = (id: string, changes: Partial<PrototypeNote>) => setNotes(current => current.map(note => note.id === id ? { ...note, ...changes } : note))
  const toggleDone = (note: PrototypeNote) => updateNote(note.id, { completedAt: note.completedAt ? null : new Date().toISOString() })
  const openEditor = (note: PrototypeNote) => {
    setDraft(note.followUp || { title: note.title, personId: null, ownerId: 'admin', dueDate: today })
    setEditing(note); setError('')
  }
  const handleAdd = () => {
    if (!draftTitle.trim() && !draftBody.trim()) return
    setNotes(current => [{ id: crypto.randomUUID(), title: draftTitle.trim(), body: draftBody.trim(), color: draftColor, followUp: null, completedAt: null, pinned: draftPinned, isPrivate: draftPrivate, createdAt: new Date().toISOString(), replies: [] }, ...current])
    setDraftTitle(''); setDraftBody(''); setDraftMentionIds([])
  }
  const dueLabel = (note: PrototypeNote) => !note.followUp ? '' : `${note.completedAt ? 'Done' : note.followUp.dueDate < today ? 'Overdue' : note.followUp.dueDate === today ? 'Due today' : 'Due'}${note.followUp.dueDate === today ? '' : ` · ${note.followUp.dueDate}`} · ${REVIEW_OWNERS.find(owner => owner.id === note.followUp?.ownerId)?.name}`
  const matchesTask = (note: PrototypeNote) => filter === 'all' || (!!note.followUp && (
    filter === 'completed' ? !!note.completedAt : !note.completedAt && (
      filter === 'open' || (filter === 'mine' && note.followUp.ownerId === 'admin') ||
      (filter === 'today' && note.followUp.dueDate <= today) || (filter === 'upcoming' && note.followUp.dueDate > today))))
  const visible = notes.filter(note => {
    if ((!showDone && filter !== 'completed' && note.completedAt) || !matchesTask(note)) return false
    const createdDate = localReviewDate(new Date(note.createdAt || `${today}T12:00:00`))
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const week = new Date(); week.setDate(week.getDate() - 7)
    return dateFilter === 'all' || (dateFilter === 'today' && createdDate === today) ||
      (dateFilter === 'yesterday' && createdDate === localReviewDate(yesterday)) ||
      (dateFilter === 'week' && createdDate >= localReviewDate(week) && createdDate <= today) ||
      (dateFilter === 'range' && createdDate >= dateFrom && createdDate <= dateTo)
  }).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) ||
    (filter !== 'all' ? (a.followUp?.dueDate || '').localeCompare(b.followUp?.dueDate || '') : (b.createdAt || '').localeCompare(a.createdAt || '')))
  const taskCount = (scope: string) => notes.filter(note => note.followUp && (scope === 'completed' ? !!note.completedAt : !note.completedAt && (
    scope === 'open' || (scope === 'mine' && note.followUp.ownerId === 'admin') ||
    (scope === 'today' && note.followUp.dueDate <= today) || (scope === 'upcoming' && note.followUp.dueDate > today)))).length
  const conversation = notes.find(note => note.id === conversationId)

  return <PageContainer style={{ boxSizing: 'border-box', minWidth: 0 }}>
    <PageHeader title="Notes" subtitle="Quick thoughts, names, phone numbers. Jot it down." />
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', marginTop: `-${spacing.lg}`, marginBottom: spacing.xl }}>
      {([['all', 'All dates'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last week'], ['range', 'Date range']] as const).map(([value, label]) =>
        <Button key={value} size="sm" variant={dateFilter === value ? 'primary' : 'secondary'} aria-pressed={dateFilter === value} onClick={() => value === 'range' ? setRangeOpen(true) : setDateFilter(value)}>{label}</Button>)}
      <ToggleSwitch checked={!showDone} onChange={checked => setShowDone(!checked)} label="Hide notes marked ‘done’" />
      <Select label="Tasks" controlSize="toolbar" fullWidth={false} value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="all">All notes</option>
        <option value="open">Open tasks ({taskCount('open')})</option>
        <option value="mine">Assigned to me ({taskCount('mine')})</option>
        <option value="today">Today + overdue ({taskCount('today')})</option>
        <option value="upcoming">Upcoming ({taskCount('upcoming')})</option>
        <option value="completed">Completed tasks ({taskCount('completed')})</option>
      </Select>
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
            mentionMembershipIds={draftMentionIds}
            onMentionMembershipIdsChange={setDraftMentionIds}
            placeholder="Take a note…"
            style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'none', minHeight: 72 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {NOTE_COLOR_KEYS.map((key) => (
                <ColorSwatch color={NOTE_COLORS[key]} selected={key === draftColor} label={`Set color to ${key}`}
                  key={key}
                  type="button"
                  onClick={() => { setDraftColor(key) }}
                  title={key}
                />
              ))}
            </div>
            <ControlButton kind="icon" selected={draftPinned}
              type="button"
              onClick={() => setDraftPinned((v) => !v)}
              title={draftPinned ? 'Unpin' : 'Pin'}
              aria-label={draftPinned ? 'Unpin note' : 'Pin note'}
              style={{ width: 26 }}
            >
              <Pin size={16} fill={draftPinned ? 'currentColor' : 'none'} />
            </ControlButton>
            <ControlButton kind="toggle"
              type="button"
              onClick={() => setDraftPrivate((value) => !value)}
              title={draftPrivate ? 'Make this note visible to everyone' : 'Only you and mentioned people can access this note'}
              role="switch"
              aria-checked={draftPrivate}

            >
              <span>Private</span>
              <span
                aria-hidden="true"
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: 32,
                  height: 18,
                  borderRadius: 999,
                  background: draftPrivate ? colors.action : colors.textMuted,
                  transition: 'background 0.15s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: draftPrivate ? 16 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: colors.surface,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    transition: 'left 0.15s ease',
                  }}
                />
              </span>
            </ControlButton>
            <div style={{ flex: 1 }} />
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={(!draftTitle.trim() && !draftBody.trim())}>
              Add
            </Button>
          </div>
          {draftPrivate && (
            <div style={{ color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginTop: spacing.sm }}>
              Private: only you and people you mention can access this conversation. Reply mentions can add more people later.
            </div>
          )}
        </div>
      </div>

    {!ready ? <p>Loading notes…</p> : visible.length === 0 ? <p>No notes match these filters.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(0, min(100%, 390px)))', gap: spacing.md, alignItems: 'start', justifyContent: 'start' }}>
      {visible.map(note => <article key={note.id} aria-label={note.title || 'Untitled note'}>
        <NoteCard note={{ ...note, pinned: !!note.pinned, is_private: !!note.isPrivate, participant_count: 1, created_by: 'Alex', completed_at: note.completedAt, created_at: note.createdAt || `${today}T12:00:00`, reply_count: note.replies?.length || 0 }}
          editing={editingId === note.id} editTitle={editTitle} editBody={editBody} editMentionIds={editMentionIds}
          onStartEdit={() => { setEditingId(note.id); setEditTitle(note.title); setEditBody(note.body) }} onEditTitle={setEditTitle} onEditBody={setEditBody} onEditMentionIds={setEditMentionIds}
          onSaveEdit={() => { updateNote(note.id, { title: editTitle, body: editBody }); setEditingId(null) }} onCancelEdit={() => setEditingId(null)}
          onPin={() => updateNote(note.id, { pinned: !note.pinned })} onColor={color => updateNote(note.id, { color })} onToggleComplete={() => toggleDone(note)}
          onDelete={() => setNotes(current => current.filter(entry => entry.id !== note.id))} onReply={() => setConversationId(note.id)}
          onTask={() => openEditor(note)} taskLabel={dueLabel(note)} />
      </article>)}
    </div>}
    <p style={{ color: colors.textSecondary, fontSize: typography.sizeXs, marginTop: spacing.xl }}>Mockup only · Existing Notes layout · Fictional data saved in this browser · No messages or production writes.</p>
    {storageWarning && <p role="status">{storageWarning}</p>}
    <Modal isOpen={rangeOpen} onClose={() => setRangeOpen(false)} ariaLabel="Notes date range" size="sm">
      <ModalHeader title="Date range" onClose={() => setRangeOpen(false)} />
      <ModalBody><FieldGrid columns={1}><Input label="From" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /><Input label="To" type="date" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)} /></FieldGrid></ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setRangeOpen(false)}>Cancel</Button><Button disabled={!dateFrom || !dateTo || dateFrom > dateTo} onClick={() => { setDateFilter('range'); setRangeOpen(false) }}>Apply</Button></ModalFooter>
    </Modal>
    <Modal isOpen={!!conversation} onClose={() => setConversationId(null)} ariaLabel="Note replies" size="md">
      <ModalHeader title={conversation?.title || 'Note replies'} onClose={() => setConversationId(null)} />
      <ModalBody><p>{conversation?.body}</p>{conversation?.replies?.map((text, index) => <p key={index}>Alex · {text}</p>)}<Input label="Reply" value={reply} onChange={event => setReply(event.target.value)} /><p style={{ color: colors.textSecondary }}>Fictional local replies only. Production conversations are unchanged.</p></ModalBody>
      <ModalFooter><Button disabled={!reply.trim()} onClick={() => { if (conversation) updateNote(conversation.id, { replies: [...(conversation.replies || []), reply.trim()] }); setReply('') }}>Reply</Button></ModalFooter>
    </Modal>
    <Modal isOpen={!!editing} onClose={() => setEditing(null)} ariaLabel="Make a task" size="md">
      <ModalHeader title={editing?.followUp ? 'Edit task' : 'Make a task'} onClose={() => setEditing(null)} />
      <form style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }} onSubmit={event => {
        event.preventDefault()
        if (!editing) return
        try {
          const updated = promoteReviewNote(editing, draft)
          setNotes(current => current.map(note => note.id === updated.id ? updated : note))
          setEditing(null)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the fields.') }
      }}>
        <ModalBody><p>Keep this note as it is. Add an owner and a due date to track it as a task.</p>
          {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
          <FieldGrid columns={1}>
            <Input label="Action" required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
            <Select label="Related lead or contact" value={draft.personId || ''} onChange={event => setDraft({ ...draft, personId: event.target.value || null })}><option value="">No person linked</option>{REVIEW_PEOPLE.map(entry => <option key={entry.id} value={entry.id}>{entry.name} ({entry.kind})</option>)}</Select>
            <Select label="Owner" value={draft.ownerId} onChange={event => setDraft({ ...draft, ownerId: event.target.value })}>{REVIEW_OWNERS.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
            <Input label="Due date" type="date" required value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} />
          </FieldGrid>
        </ModalBody>
        <ModalFooter><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">{editing?.followUp ? 'Save task' : 'Create task'}</Button></ModalFooter>
      </form>
    </Modal>

  </PageContainer>
}
