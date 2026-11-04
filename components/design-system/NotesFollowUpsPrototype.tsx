'use client'

// Isolated review mirror of the existing Notes composer/card presentation.
// Keep production Notes unchanged; only task affordances are experimental.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, Lock, MessageCircle, Pin, Trash2 } from 'lucide-react'
import { Button, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageContainer, PageHeader, Select, Textarea, Avatar, Badge } from '@/components/ui'
import { TaskCompletionButton } from '@/components/ui/TaskCompletionButton'
import { ControlButton } from '@/components/ui/ControlButton'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { SlidePanelHeader } from '@/components/ui/SlidePanelHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import MentionTextarea from '@/components/design-system/NotesPrototypeMentionTextarea'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { formatFullTimestamp } from '@/lib/presentation-date'
import { NOTE_COLORS, getNoteBackground } from '@/lib/sticky-note-appearance'
import { initialReviewNotes, localReviewDate, mentionedReviewPeople, reviewTaskDraft, promoteReviewNote, PROTOTYPE_STORAGE_KEY, readReviewNotes, REVIEW_OWNERS, REVIEW_PEOPLE, type FollowUp, type PrototypeNote } from '@/lib/notes-follow-ups-prototype'
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
              background: `color-mix(in srgb, ${colors.link} 18%, ${colors.surface})`,
              color: colors.info,
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
  onPin: () => void
  onColor: (color: string) => void
  onToggleComplete: () => void
  onDelete: () => void
  onTask: () => void
  onReply: () => void
}

function NoteCard(props: NoteCardProps) {
  const { note, editing } = props
  const root = useRef<HTMLDivElement>(null)
  const latestSave = useRef(props.onSaveEdit)
  latestSave.current = props.onSaveEdit
  useEffect(() => {
    if (!editing) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) latestSave.current()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [editing])
  const bg = `color-mix(in srgb, ${getNoteBackground(note.color, !!note.completed_at)} 62%, ${colors.surface} 38%)`
  const overdue = !!note.followUp && !note.completed_at && note.followUp.dueDate < localReviewDate()
  const due = note.followUp ? new Date(`${note.followUp.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const plainInput: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, color: colors.text }
  const owner = REVIEW_OWNERS.find(person => person.id === note.followUp?.ownerId)
  return <div ref={root} onBlur={event => {
    if (editing && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) props.onSaveEdit()
  }} onClick={() => { if (!editing) props.onStartEdit() }}
    style={{ width: '100%', maxWidth: 390, minHeight: 300, maxHeight: 460, boxSizing: 'border-box', overflowY: editing ? 'auto' : 'hidden', background: editing ? `color-mix(in srgb, ${bg} 94%, ${colors.text} 6%)` : bg, transition: 'background 140ms ease', border: `1px solid ${colors.borderLight}`, borderRadius: radius.xl, boxShadow: shadows.sm, padding: spacing.lg, display: 'flex', flexDirection: 'column', cursor: 'text' }}>
    <div onClick={event => event.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
      <ControlButton kind="icon" type="button" selected={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={props.onPin}><Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} /></ControlButton>
      <div style={{ flex: 1 }} />
      {!note.followUp && editing && mentionedReviewPeople(props.editBody).some(person => person.kind === 'staff') && <Button variant="secondary" size="sm" onClick={props.onTask}>Create task</Button>}
      {note.followUp && <TaskCompletionButton completed={!!note.completed_at} aria-label={note.completed_at ? 'Mark note as open' : 'Mark note as done'} onClick={props.onToggleComplete} />}

    </div>
    <div style={{ flex: 1, minHeight: 0, textDecoration: note.completed_at ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
      {editing ? <>
        <input autoFocus aria-label="Note title" placeholder="Title" value={props.editTitle} onChange={event => props.onEditTitle(event.target.value)} style={{ ...plainInput, fontWeight: 600, fontSize: 15, marginBottom: spacing.sm }} />
        <MentionTextarea value={props.editBody} onChange={props.onEditBody} placeholder="Take a note…" style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, minHeight: 130, resize: 'vertical' }} />
      </> : <div tabIndex={0} role="button" aria-label={`Edit ${note.title || 'note'}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onStartEdit() } }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, whiteSpace: 'pre-wrap' }}>{note.title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 10, overflow: 'hidden' }}><NoteBody body={note.body} /></div>
      </div>}
    </div>
    {note.followUp && <div onClick={event => event.stopPropagation()} style={{ marginTop: spacing.lg }}>
      <ControlButton kind="name" type="button" onClick={props.onTask} aria-label={`Task assigned to ${owner?.name || 'Alex'}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary }}>
        <Avatar firstName={owner?.name.replace(' (me)', '') || 'Alex'} lastName="" size={24} /><span>{owner?.name.replace(' (me)', '')}</span>
        <CalendarDays size={16} aria-hidden="true" /><time dateTime={note.followUp.dueDate}>{due}</time>
        {overdue ? <Badge variant="error" style={{ background: `color-mix(in srgb, ${colors.crimson} 16%, transparent)`, color: colors.error }}>Overdue</Badge> : note.completed_at ? <Badge variant="success">Done</Badge> : note.followUp.dueDate === localReviewDate() ? <Badge variant="neutral">Today</Badge> : null}
      </ControlButton>
    </div>}
    <div onClick={event => event.stopPropagation()} style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: spacing.md, paddingTop: spacing.sm }}>
      {editing && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: spacing.sm }}>{NOTE_COLOR_KEYS.map(color => <ColorSwatch key={color} color={NOTE_COLORS[color]} selected={note.color === color} label={`Set color to ${color}`} onClick={() => props.onColor(color)} />)}<ControlButton kind="icon" aria-label="Delete note" onClick={props.onDelete}><Trash2 size={16} /></ControlButton></div>}
      {note.is_private && <div style={{ fontSize: 11, color: colors.textSecondary }}><Lock size={12} /> Private · {note.participant_count} person</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onClick={props.onReply}><MessageCircle size={16} />{note.reply_count ? `Replies ${note.reply_count}` : 'Reply'}</Button>
        <div style={{ fontSize: 12, color: colors.textSecondary }}>{note.created_by} · <time dateTime={note.created_at} title={formatFullTimestamp(note.created_at)}>{new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div>
      </div>
    </div>
  </div>
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
  const [personQuery, setPersonQuery] = useState('')
  const [personSearchOpen, setPersonSearchOpen] = useState(false)
  const [activePerson, setActivePerson] = useState(0)
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
  const composerBg = `color-mix(in srgb, ${NOTE_COLORS[draftColor] || NOTE_COLORS.white} 62%, ${colors.surface} 38%)`
  const mentionedTeammate = mentionedReviewPeople(draftBody).find(person => person.kind === 'staff')

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
    const next = reviewTaskDraft(note, today)
    setDraft(next)
    setPersonQuery(REVIEW_PEOPLE.find(person => person.id === next.personId)?.name || '')
    setPersonSearchOpen(false)
    setEditing(note); setError('')
  }
  const handleAdd = (asTask = false) => {
    if ((!draftTitle.trim() && !draftBody.trim()) || (asTask && !mentionedTeammate)) return
    const note: PrototypeNote = { id: crypto.randomUUID(), title: draftTitle.trim(), body: draftBody.trim(), color: draftColor, followUp: null, completedAt: null, pinned: draftPinned, isPrivate: draftPrivate, createdAt: new Date().toISOString(), replies: [] }
    setNotes(current => [note, ...current])
    if (asTask) openEditor(note)
    setDraftTitle(''); setDraftBody(''); setDraftMentionIds([])
  }
  const matchingPeople = REVIEW_PEOPLE.filter(person => `${person.name} ${person.kind}`.toLowerCase().includes(personQuery.trim().toLowerCase()))
  const selectPerson = (person: typeof REVIEW_PEOPLE[number]) => {
    setDraft(current => ({ ...current, personId: person.id }))
    setPersonQuery(person.name); setPersonSearchOpen(false)
  }
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
        <div style={{ background: composerBg, border: '1px solid rgba(0,0,0,0.06)', borderRadius: radius.xl, boxShadow: shadows.md, padding: spacing.lg }}>
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
            highlightMentions
            placeholder="Take a note…"
            style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'none', minHeight: 72 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.lg }}>
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
            {mentionedTeammate && <Button variant="secondary" size="sm" onClick={() => handleAdd(true)}>Create task</Button>}
            <Button variant="primary" size="sm" onClick={() => handleAdd()} disabled={(!draftTitle.trim() && !draftBody.trim())}>
              Add as note
            </Button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: spacing.lg, paddingTop: spacing.md, color: colors.textSecondary, fontSize: 13 }}>
            {mentionedTeammate ? <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><Avatar firstName={mentionedTeammate.label} lastName="" size={24} /><span>Assigned to {mentionedTeammate.label}</span></div> : <em>Mention a teammate with @ to create a task.</em>}
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
          onSaveEdit={() => { updateNote(note.id, { title: editTitle, body: editBody }); setEditingId(current => current === note.id ? null : current) }}
          onPin={() => updateNote(note.id, { pinned: !note.pinned })} onColor={color => updateNote(note.id, { color })} onToggleComplete={() => toggleDone(note)}
          onDelete={() => setNotes(current => current.filter(entry => entry.id !== note.id))} onReply={() => setConversationId(note.id)}
          onTask={() => {
            const current = editingId === note.id ? { ...note, title: editTitle, body: editBody } : note
            if (editingId === note.id) { updateNote(note.id, { title: editTitle, body: editBody }); setEditingId(null) }
            openEditor(current)
          }} />
      </article>)}
    </div>}
    <p style={{ color: colors.textSecondary, fontSize: typography.sizeXs, marginTop: spacing.xl }}>Mockup only · Existing Notes layout · Fictional data saved in this browser · No messages or production writes.</p>
    {storageWarning && <p role="status">{storageWarning}</p>}
    <Modal isOpen={rangeOpen} onClose={() => setRangeOpen(false)} ariaLabel="Notes date range" size="sm">
      <ModalHeader title="Date range" onClose={() => setRangeOpen(false)} />
      <ModalBody><FieldGrid columns={1}><Input label="From" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /><Input label="To" type="date" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)} /></FieldGrid></ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setRangeOpen(false)}>Cancel</Button><Button disabled={!dateFrom || !dateTo || dateFrom > dateTo} onClick={() => { setDateFilter('range'); setRangeOpen(false) }}>Apply</Button></ModalFooter>
    </Modal>
    <SlidePanel isOpen={!!conversation} onClose={() => setConversationId(null)} ariaLabel="Note replies" width="min(100vw, 560px)">
      <SlidePanelHeader title={conversation?.title || 'Note replies'} onClose={() => setConversationId(null)} />
      <ModalBody><p>{conversation?.body}</p>{conversation?.replies?.map((text, index) => <p key={index}>Alex · {text}</p>)}<Input label="Reply" value={reply} onChange={event => setReply(event.target.value)} /><p style={{ color: colors.textSecondary }}>Fictional local replies only. Production conversations are unchanged.</p></ModalBody>
      <ModalFooter><Button disabled={!reply.trim()} onClick={() => { if (conversation) updateNote(conversation.id, { replies: [...(conversation.replies || []), reply.trim()] }); setReply('') }}>Reply</Button></ModalFooter>
    </SlidePanel>
    <SlidePanel isOpen={!!editing} onClose={() => setEditing(null)} ariaLabel="Task details" width="min(100vw, 560px)">
      <SlidePanelHeader title={editing?.followUp ? 'Task details' : 'Create a task'} onClose={() => setEditing(null)} />
      <form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }} onSubmit={event => {
        event.preventDefault()
        if (!editing) return
        if (personQuery.trim() && !draft.personId) { setError('Select a lead or contact from the search results, or clear the search.'); return }
        try {
          const updated = promoteReviewNote(editing, draft)
          setNotes(current => current.map(note => note.id === updated.id ? updated : note))
          setEditing(null)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the fields.') }
      }}>
        <ModalBody>
          {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
          <FieldGrid columns={1}>
            <Textarea label="Action" required rows={4} style={{ resize: 'vertical' }} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
            <div>
              <Input label="Related to" type="search" role="combobox" autoComplete="off" placeholder="Search leads or contacts…" aria-expanded={personSearchOpen} aria-controls="notes-task-people" aria-autocomplete="list" aria-activedescendant={personSearchOpen && matchingPeople[activePerson] ? `notes-task-person-${matchingPeople[activePerson].id}` : undefined}
                value={personQuery} onFocus={() => { setPersonSearchOpen(true); setActivePerson(0) }}
                onBlur={event => { if (!event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget)) setPersonSearchOpen(false) }}
                onChange={event => { setPersonQuery(event.target.value); setDraft({ ...draft, personId: null }); setPersonSearchOpen(true); setActivePerson(0) }}
                onKeyDown={event => {
                  if (event.key === 'Escape' && personSearchOpen) { event.preventDefault(); event.stopPropagation(); setPersonSearchOpen(false) }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault(); setPersonSearchOpen(true)
                    setActivePerson(index => matchingPeople.length ? (index + (event.key === 'ArrowDown' ? 1 : matchingPeople.length - 1)) % matchingPeople.length : 0)
                  }
                  if (event.key === 'Enter' && personSearchOpen) { event.preventDefault(); if (matchingPeople[activePerson]) selectPerson(matchingPeople[activePerson]) }
                }} />
              {personSearchOpen && <div id="notes-task-people" role="listbox" aria-label="Matching leads and contacts" style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, marginTop: spacing.xs }}>
                {matchingPeople.map((person, index) => <ControlButton key={person.id} id={`notes-task-person-${person.id}`} kind="row" type="button" role="option" aria-selected={draft.personId === person.id} selected={index === activePerson} style={{ width: '100%' }} onMouseDown={event => event.preventDefault()} onClick={() => selectPerson(person)}>{person.name} · {person.kind === 'lead' ? 'Lead' : 'Contact'}</ControlButton>)}
                {matchingPeople.length === 0 && <p role="status" style={{ padding: spacing.sm }}>No matching leads or contacts.</p>}
              </div>}
            </div>
            <Select label="Owner" value={draft.ownerId} onChange={event => setDraft({ ...draft, ownerId: event.target.value })}>{REVIEW_OWNERS.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
            <Input label="Due date" type="date" required value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} />
          </FieldGrid>
        </ModalBody>
        <ModalFooter><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">{editing?.followUp ? 'Save task' : 'Create task'}</Button></ModalFooter>
      </form>
    </SlidePanel>

  </PageContainer>
}
