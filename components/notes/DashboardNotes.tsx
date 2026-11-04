'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, Lock, MessageCircle, Pin, Trash2 } from 'lucide-react'
import { Button, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageContainer, PageHeader, Select, Textarea, Avatar, Badge } from '@/components/ui'
import { TaskCompletionButton } from '@/components/ui/TaskCompletionButton'
import { ControlButton } from '@/components/ui/ControlButton'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { SlidePanelHeader } from '@/components/ui/SlidePanelHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import MentionTextarea from '@/components/notes/MentionTextarea'
import NoteConversationPanel from '@/components/notes/NoteConversationPanel'
import { getActiveTenantId } from '@/lib/tenant'
import { removeCurrentSearchParam } from '@/lib/browser-url'
import { getDailyNoteColor } from '@/lib/sticky-note-appearance'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { formatFullTimestamp } from '@/lib/presentation-date'
import { NOTE_COLORS, NOTE_INK, NOTE_MUTED_INK, noteBackground } from '@/lib/dashboard-note-appearance'
import styles from './DashboardNotes.module.css'
import { localNoteDate, noteDateOffset, mentionedTaskOwners, type NoteTask, type TaskOwner, type TaskPerson } from '@/lib/note-tasks'
const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS)
interface Note {
  id: string; title: string | null; body: string; color: string; pinned: boolean; is_private: boolean;
  participant_count: number; created_by: string; completed_at: string | null; created_at: string; reply_count: number;
  follow_up: NoteTask | null; note_date: string; updated_at: string
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
  owners: TaskOwner[]
  editing: boolean
  editTitle: string
  editBody: string
  editMentionIds: string[]
  onStartEdit: () => void
  onEditTitle: (v: string) => void
  onEditBody: (v: string) => void
  onEditMentionIds: (ids: string[]) => void
  onRelatedPersonMention: (person: TaskPerson) => void
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
  const bg = noteBackground(note.color, !!note.completed_at, editing)
  const overdue = !!note.follow_up && !note.completed_at && note.follow_up.dueDate < localNoteDate()
  const due = note.follow_up ? new Date(`${note.follow_up.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const plainInput: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, color: colors.text }
  const owner = props.owners.find(person => person.id === note.follow_up?.ownerId)
  return <div className={styles.sticky} ref={root} onBlur={event => {
    if (editing && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) props.onSaveEdit()
  }} onClick={() => { if (!editing) props.onStartEdit() }}
    style={{ width: '100%', maxWidth: 390, minHeight: 300, maxHeight: 460, boxSizing: 'border-box', overflowY: editing ? 'auto' : 'hidden', background: bg, transition: 'background 140ms ease', border: `1px solid ${colors.borderLight}`, borderRadius: radius.xl, boxShadow: shadows.sm, padding: spacing.lg, display: 'flex', flexDirection: 'column', cursor: 'text' }}>
    <div onClick={event => event.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
      <ControlButton kind="icon" type="button" selected={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={props.onPin}><Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} /></ControlButton>
      <div style={{ flex: 1 }} />
      <TaskCompletionButton completed={!!note.completed_at} aria-label={note.completed_at ? 'Mark note as open' : 'Mark note as done'} onClick={props.onToggleComplete} />

    </div>
    <div style={{ flex: 1, minHeight: 0, textDecoration: note.completed_at ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>
      {editing ? <>
        <input autoFocus aria-label="Note title" placeholder="Title" value={props.editTitle} onChange={event => props.onEditTitle(event.target.value)} style={{ ...plainInput, fontWeight: 600, fontSize: 15, marginBottom: spacing.sm }} />
        <MentionTextarea taskMentions highlightMentions onRelatedPersonMention={props.onRelatedPersonMention} value={props.editBody} onChange={props.onEditBody} mentionMembershipIds={props.editMentionIds} onMentionMembershipIdsChange={props.onEditMentionIds} placeholder="Take a note…" style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, minHeight: 130, resize: 'vertical' }} />
      </> : <div tabIndex={0} role="button" aria-label={`Edit ${note.title || 'note'}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onStartEdit() } }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, whiteSpace: 'pre-wrap' }}>{note.title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 10, overflow: 'hidden' }}><NoteBody body={note.body} /></div>
      </div>}
    </div>
    {note.follow_up && <div onClick={event => event.stopPropagation()} style={{ marginTop: spacing.lg }}>
      <ControlButton kind="name" type="button" onClick={props.onTask} aria-label={`Task assigned to ${owner?.name || 'Unavailable staff member'}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, color: NOTE_MUTED_INK }}>
        <Avatar firstName={owner?.name || 'Staff'} lastName="" size={28} style={{ background: colors.espresso, color: colors.surface, fontSize: 14 }} /><span>{owner?.name.replace(' (me)', '')}</span>
        <CalendarDays size={16} aria-hidden="true" /><time dateTime={note.follow_up.dueDate}>{due}</time>
        {overdue ? <Badge variant="error" style={{ background: '#FFE3E3', color: '#8F1717' }}>Overdue</Badge> : note.completed_at ? <Badge variant="success" style={{ background: '#E0F3E5', color: '#1F5C3A' }}>Done</Badge> : note.follow_up.dueDate === localNoteDate() ? <Badge variant="neutral" style={{ background: '#FFFFFF', color: NOTE_INK }}>Today</Badge> : null}
      </ControlButton>
    </div>}
    <div onClick={event => event.stopPropagation()} style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: spacing.md, paddingTop: spacing.sm }}>
      {editing && <div className={styles.swatches} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: spacing.sm }}>{NOTE_COLOR_KEYS.map(color => <ColorSwatch key={color} color={NOTE_COLORS[color]} selected={note.color === color} label={`Set color to ${color}`} onClick={() => props.onColor(color)} />)}<ControlButton kind="icon" aria-label="Delete note" onClick={props.onDelete}><Trash2 size={16} /></ControlButton></div>}
      {!note.follow_up && editing && mentionedTaskOwners(props.editBody, props.owners).length > 0 && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
        <Button variant="secondary" className={styles.secondary} size="sm" onClick={props.onSaveEdit}>Keep as note</Button>
        <Button variant="primary" className={styles.primary} size="sm" onClick={props.onTask}>Convert to task</Button>
      </div>}
      {note.is_private && <div style={{ fontSize: 11, color: NOTE_MUTED_INK }}><Lock size={12} /> Private · {note.participant_count} person</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="ghost" className={styles.reply} size="sm" onClick={props.onReply}><MessageCircle size={16} />{note.reply_count ? `Replies ${note.reply_count}` : 'Reply'}</Button>
        <div style={{ fontSize: 12, color: NOTE_MUTED_INK }}>{note.created_by} · <time dateTime={note.created_at} title={formatFullTimestamp(note.created_at)}>{new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div>
      </div>
    </div>
  </div>
}

export default function DashboardNotes() {
  const [tenantId] = useState(() => getActiveTenantId())
  const [notes, setNotes] = useState<Note[]>([])
  const [ready, setReady] = useState(false)
  const [owners, setOwners] = useState<TaskOwner[]>([])
  const [membershipId, setMembershipId] = useState('')
  const [people, setPeople] = useState<TaskPerson[]>([])
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [showDone, setShowDone] = useState(true)
  const [editing, setEditing] = useState<Note | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [specificDate, setSpecificDate] = useState(false)
  const [draft, setDraft] = useState<NoteTask>({ description: '', personId: null, ownerId: '', dueDate: '' })
  const [personQuery, setPersonQuery] = useState('')
  const [personSearchOpen, setPersonSearchOpen] = useState(false)
  const [activePerson, setActivePerson] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editMentionIds, setEditMentionIds] = useState<string[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftMentionIds, setDraftMentionIds] = useState<string[]>([])
  const [draftColor, setDraftColor] = useState(getDailyNoteColor)
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [conversation, setConversation] = useState<Note | null>(null)
  const relatedMentions = useRef(new Map<string, TaskPerson>())
  const draftRelatedMentions = useRef(new Map<string, TaskPerson>())
  const pendingSave = useRef(false)
  const linkedNoteHandled = useRef(false)
  const today = localNoteDate()
  const plainInput: CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: typography.fontSans, color: NOTE_INK, boxSizing: 'border-box' }
  const composerBg = noteBackground(draftColor)
  const mentionedTeammate = mentionedTaskOwners(draftBody, owners)[0]

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${path}${path.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenantId)}`, init)
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || 'Could not save your changes.')
    return data
  }

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/notes?tenant=${encodeURIComponent(tenantId)}&show_done=true`).then(async response => {
      if (!response.ok) throw new Error('Could not load notes. Please reload to retry.')
      const data = await response.json()
      if (!cancelled) setNotes(Array.isArray(data) ? data : [])
    }).catch(error => { if (!cancelled) setNotice(error.message) }).finally(() => { if (!cancelled) setReady(true) })
    void fetch(`/api/notes/directory?tenant=${encodeURIComponent(tenantId)}&owners=true`).then(async response => {
      if (!response.ok) throw new Error('Could not load staff. Task assignment is unavailable; reload to retry.')
      const data = await response.json()
      if (!cancelled) { setOwners(data.owners); setMembershipId(data.membershipId) }
    }).catch(error => { if (!cancelled) setNotice(error.message) })
    return () => { cancelled = true }
  }, [tenantId])

  useEffect(() => {
    if (!ready || linkedNoteHandled.current) return
    const id = new URLSearchParams(window.location.search).get('note')
    if (!id) return
    linkedNoteHandled.current = true
    removeCurrentSearchParam('note')
    const note = notes.find(note => note.id === id)
    if (note) setConversation(note)
    else setNotice('This note is unavailable or you no longer have access.')
  }, [notes, ready])

  useEffect(() => {
    if (!editing || (!personSearchOpen && !draft.personId)) return
    let cancelled = false
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ tenant: tenantId })
      if (personSearchOpen) params.set('q', personQuery)
      else if (draft.personId) params.set('selected', draft.personId)
      void fetch(`/api/notes/directory?${params}`).then(async response => {
        if (!response.ok) throw new Error('Could not search related people.')
        const data: TaskPerson[] = await response.json()
        if (!cancelled) {
          setPeople(data)
          if (!personSearchOpen) {
            const selected = data.find(person => person.id === draft.personId)
            setPersonQuery(selected?.name || 'Linked record unavailable')
          }
        }
      }).catch(error => { if (!cancelled) setError(error.message) })
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [editing, personSearchOpen, personQuery, draft.personId, tenantId])

  const updateNote = (note: Note) => {
    setNotes(current => current.map(entry => entry.id === note.id ? { ...entry, ...note } : entry))
    setConversation(current => current?.id === note.id ? { ...current, ...note } : current)
  }
  const patchNote = async (id: string, changes: Record<string, unknown>) => {
    const saved = await request(`/api/notes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
    updateNote(saved)
    return saved as Note
  }
  const changeNote = (note: Note, changes: Record<string, unknown>) => {
    void patchNote(note.id, changes).catch(error => setNotice(error.message))
  }
  const toggleDone = (note: Note) => changeNote(note, { completed_at: note.completed_at ? null : new Date().toISOString() })

  const saveInline = async (note: Note): Promise<Note | null> => {
    if (pendingSave.current) return null
    if (editTitle === (note.title || '') && editBody === note.body) { setEditingId(null); return note }
    pendingSave.current = true
    try {
      const saved = await patchNote(note.id, { title: editTitle, body: editBody, mention_membership_ids: editMentionIds })
      setEditingId(current => current === note.id ? null : current)
      return saved
    } catch (error) {
      setNotice(`${(error as Error).message} Your edit is still open; click outside to retry.`)
      return null
    } finally { pendingSave.current = false }
  }

  const openEditor = (note: Note, isNew = false) => {
    const owner = mentionedTaskOwners(note.body, owners)[0]
    const related = (isNew ? draftRelatedMentions.current.get('composer') : relatedMentions.current.get(note.id))
    const matchingRelated = related && mentionedTaskOwners(note.body, [{ id: related.id, name: related.name }]).length ? related : null
    setDraft(note.follow_up || { description: note.body, personId: matchingRelated?.id || null, ownerId: owner?.id || membershipId, dueDate: today })
    setPersonQuery(''); setPeople([]); setPersonSearchOpen(false); setActivePerson(0)
    setCreatingTask(isNew)
    setSpecificDate(!!note.follow_up && ![0, 1, 2].some(days => noteDateOffset(days) === note.follow_up?.dueDate))
    setEditing(note); setError('')
  }
  const handleAdd = async (asTask = false) => {
    if (saving || (!draftTitle.trim() && !draftBody.trim()) || (asTask && !mentionedTeammate)) return
    if (asTask) {
      openEditor({ id: '', title: draftTitle.trim(), body: draftBody.trim(), color: draftColor, pinned: false, is_private: draftPrivate, participant_count: 0, created_by: '', completed_at: null, created_at: '', updated_at: '', note_date: today, reply_count: 0, follow_up: null }, true)
      return
    }
    setSaving(true)
    try {
      const note = await createNote()
      setNotes(current => [note, ...current]); resetComposer()
    } catch (error) { setNotice((error as Error).message) }
    finally { setSaving(false) }
  }
  const resetComposer = () => { setDraftTitle(''); setDraftBody(''); setDraftMentionIds([]); setDraftPrivate(false); setDraftColor(getDailyNoteColor()); draftRelatedMentions.current.clear() }
  const createNote = async (task?: NoteTask): Promise<Note> => {
    let title: string | null = draftTitle.trim() || null
    if (!title && draftBody.trim()) {
      try { title = (await request('/api/notes/title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draftBody.trim() }) })).title || null } catch { /* Title generation is optional; content must still save. */ }
    }
    return request('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body: draftBody.trim(), color: draftColor, pinned: false, is_private: draftPrivate, note_date: today, mention_membership_ids: draftMentionIds, ...(task ? { follow_up: task } : {}) }) })
  }
  const saveTask = async () => {
    if (saving || !editing) return
    if (!draft.description.trim() || !draft.ownerId || !draft.dueDate) { setError('Add a description, owner and due date.'); return }
    if (personQuery.trim() && !draft.personId) { setError('Choose a related person from the results, or clear the field.'); return }
    setSaving(true); setError('')
    try {
      if (creatingTask) {
        const note = await createNote(draft)
        setNotes(current => [note, ...current]); resetComposer()
      } else {
        await patchNote(editing.id, { follow_up: draft })
      }
      setEditing(null)
    } catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  const deleteNote = (note: Note) => {
    if (!window.confirm('Delete this note and its replies? This cannot be undone.')) return
    void request(`/api/notes/${note.id}`, { method: 'DELETE' }).then(() => {
      setNotes(current => current.filter(entry => entry.id !== note.id))
      if (editingId === note.id) setEditingId(null)
    }).catch(error => setNotice(error.message))
  }
  const selectPerson = (person: TaskPerson) => {
    setDraft(current => ({ ...current, personId: person.id }))
    setPersonQuery(person.name); setPersonSearchOpen(false)
  }
  const matchingPeople = people
  const visible = notes.filter(note => {
    if (!showDone && note.completed_at) return false
    if (filter === 'open' && (!note.follow_up || note.completed_at)) return false
    if (filter === 'mine' && (!membershipId || note.follow_up?.ownerId !== membershipId)) return false
    const createdDate = note.note_date || localNoteDate(new Date(note.created_at))
    return dateFilter === 'all' || (dateFilter === 'today' && createdDate === today) ||
      (dateFilter === 'yesterday' && createdDate === noteDateOffset(-1)) ||
      (dateFilter === 'week' && createdDate >= noteDateOffset(-7) && createdDate <= today) ||
      (dateFilter === 'range' && createdDate >= dateFrom && createdDate <= dateTo)
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) ||
    (filter !== 'all' ? (a.follow_up?.dueDate || '').localeCompare(b.follow_up?.dueDate || '') : b.created_at.localeCompare(a.created_at)))
  return <div className={styles.surface}><PageContainer style={{ boxSizing: 'border-box', minWidth: 0 }}>
    <PageHeader title="Notes" />
    <div className={styles.toolbar} style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap', marginTop: `-${spacing.lg}`, marginBottom: spacing.xl }}>
      <Select label="Date" controlSize="toolbar" fullWidth={false} value={dateFilter} onChange={event => {
        if (event.target.value === 'range') setRangeOpen(true)
        else setDateFilter(event.target.value)
      }}>
        <option value="all">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Last week</option><option value="range">Date range</option>
      </Select>
      {dateFilter === 'range' && <Button variant="secondary" className={styles.secondary} onClick={() => setRangeOpen(true)}>Edit date range</Button>}
      <div role="group" aria-label="View" style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        {([{ key: 'all', label: 'All notes' }, { key: 'open', label: 'Open tasks' }, { key: 'mine', label: 'My tasks' }]).map(view => <Button key={view.key} size="toolbar" variant={filter === view.key ? 'primary' : 'secondary'} className={filter === view.key ? styles.primary : styles.secondary} aria-pressed={filter === view.key} onClick={() => setFilter(view.key)}>{view.label}</Button>)}
      </div>
      <div style={{ marginLeft: 'auto', minHeight: 42, display: 'flex', alignItems: 'center' }}>
        <ToggleSwitch checked={!showDone} onChange={checked => setShowDone(!checked)} label="Hide notes marked ‘done’" />
      </div>
    </div>
      <div style={{ maxWidth: 390, marginBottom: spacing['2xl'] }}>
        <div className={styles.sticky} style={{ background: composerBg, border: '1px solid rgba(0,0,0,0.06)', borderRadius: radius.xl, boxShadow: shadows.md, padding: spacing.lg }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title"
            style={{ ...plainInput, fontSize: 15, fontWeight: 600, marginBottom: spacing.sm }}
          />
          <MentionTextarea
            taskMentions highlightMentions onRelatedPersonMention={person => draftRelatedMentions.current.set('composer', person)}
            value={draftBody}
            onChange={setDraftBody}
            mentionMembershipIds={draftMentionIds}
            onMentionMembershipIdsChange={setDraftMentionIds}
            placeholder="Take a note…"
            style={{ ...plainInput, fontSize: 14, lineHeight: 1.5, resize: 'none', minHeight: 72 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            <div className={styles.swatches} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {NOTE_COLOR_KEYS.map((key) => (
                <ColorSwatch color={NOTE_COLORS[key]} selected={key === draftColor} label={`Set color to ${key}`}
                  key={key}
                  type="button"
                  onClick={() => { setDraftColor(key) }}
                  title={key}
                />
              ))}
            </div>
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
            <Button className={mentionedTeammate || (!draftTitle.trim() && !draftBody.trim()) ? styles.secondary : styles.primary} variant={mentionedTeammate ? 'secondary' : 'primary'} size="sm" onClick={() => void handleAdd()} disabled={saving} aria-disabled={!draftTitle.trim() && !draftBody.trim()}>
              {mentionedTeammate ? 'Keep as note' : 'Add as note'}
            </Button>
            {mentionedTeammate && <Button variant="primary" className={styles.primary} size="sm" disabled={saving} onClick={() => void handleAdd(true)}>Create a task</Button>}
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: spacing.lg, paddingTop: spacing.md, color: NOTE_MUTED_INK, fontSize: 13 }}>
            {mentionedTeammate ? <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><Avatar firstName={mentionedTeammate.name} lastName="" size={28} style={{ background: colors.espresso, color: colors.surface, fontSize: 14 }} /><span>Suggested owner: {mentionedTeammate.name}</span></div> : <em>Mention a teammate with @ to create a task.</em>}
          </div>
          {draftPrivate && (
            <div style={{ color: NOTE_MUTED_INK, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginTop: spacing.sm }}>
              Private: only you and people you mention can access this conversation. Reply mentions can add more people later.
            </div>
          )}
        </div>
      </div>

    {!ready ? <p>Loading notes…</p> : visible.length === 0 ? <p>No notes match these filters.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(0, min(100%, 390px)))', gap: spacing.md, alignItems: 'start', justifyContent: 'start' }}>
      {visible.map(note => <article key={note.id} aria-label={note.title || 'Untitled note'}>
        <NoteCard note={note} owners={owners}
          onRelatedPersonMention={person => relatedMentions.current.set(note.id, person)}
          editing={editingId === note.id} editTitle={editTitle} editBody={editBody} editMentionIds={editMentionIds}
          onStartEdit={() => { if (pendingSave.current || (editingId && editingId !== note.id)) return; setEditingId(note.id); setEditTitle(note.title || ''); setEditBody(note.body); setEditMentionIds([]) }} onEditTitle={setEditTitle} onEditBody={setEditBody} onEditMentionIds={setEditMentionIds}
          onSaveEdit={() => { void saveInline(note) }}
          onPin={() => changeNote(note, { pinned: !note.pinned })} onColor={color => changeNote(note, { color })} onToggleComplete={() => toggleDone(note)}
          onDelete={() => deleteNote(note)} onReply={() => setConversation(note)}
          onTask={() => { void (async () => {
            const current = editingId === note.id ? await saveInline(note) : note
            if (current) openEditor(current)
          })() }} />
      </article>)}
    </div>}
    {notice && <div role="alert" style={{ marginTop: spacing.lg, color: colors.error }}>{notice}<Button variant="ghost" onClick={() => setNotice('')}>Dismiss</Button></div>}
    <Modal isOpen={rangeOpen} onClose={() => setRangeOpen(false)} ariaLabel="Notes date range" size="sm">
      <ModalHeader title="Date range" onClose={() => setRangeOpen(false)} />
      <ModalBody><FieldGrid columns={1}><Input label="From" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /><Input label="To" type="date" min={dateFrom || undefined} value={dateTo} onChange={event => setDateTo(event.target.value)} /></FieldGrid></ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setRangeOpen(false)}>Cancel</Button><Button disabled={!dateFrom || !dateTo || dateFrom > dateTo} onClick={() => { setDateFilter('range'); setRangeOpen(false) }}>Apply</Button></ModalFooter>
    </Modal>
    <NoteConversationPanel note={conversation} tenantId={tenantId} onClose={() => setConversation(null)} onReplyAdded={(id, count, participantCount) => {
      setNotes(current => current.map(note => note.id === id ? { ...note, reply_count: count, ...(participantCount === undefined ? {} : { participant_count: participantCount }) } : note))
    }} />
    <SlidePanel isOpen={!!editing} onClose={() => { if (!saving) setEditing(null) }} ariaLabel="Task details" width="min(100vw, 560px)">
      <SlidePanelHeader title={editing?.follow_up ? 'Task details' : creatingTask ? 'Create a task' : 'Convert to task'} onClose={() => { if (!saving) setEditing(null) }} />
      <form className={styles.surface} onSubmit={event => { event.preventDefault(); void saveTask() }} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ModalBody>
          {editing?.is_private && <p style={{ color: NOTE_MUTED_INK }}>Assigning an owner adds them to this private conversation, including its existing replies. Existing participants keep access.</p>}
          {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
          <FieldGrid columns={1}>
            <Textarea label="Description" required rows={4} style={{ resize: 'vertical' }} value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} />
            <div>
              <div style={{ marginBottom: spacing.xs, fontSize: typography.sizeBase, fontWeight: typography.weightMedium }}>Due date</div>
              <div role="group" aria-label="Due date shortcuts" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
                {([{ days: 0, label: 'Today' }, { days: 1, label: 'Tomorrow' }, { days: 2, label: '2 days' }]).map(option => <Button type="button" key={option.days} size="sm" variant={!specificDate && draft.dueDate === noteDateOffset(option.days) ? 'primary' : 'secondary'} aria-pressed={!specificDate && draft.dueDate === noteDateOffset(option.days)} onClick={() => { setDraft({ ...draft, dueDate: noteDateOffset(option.days) }); setSpecificDate(false) }}>{option.label}</Button>)}
                <Button type="button" size="sm" variant={specificDate ? 'primary' : 'secondary'} aria-pressed={specificDate} onClick={() => setSpecificDate(true)}>Specific date</Button>
              </div>
              {specificDate ? <Input label="Due date" type="date" required value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} /> : <time dateTime={draft.dueDate} style={{ color: NOTE_MUTED_INK, fontSize: typography.sizeSm }}>{new Date(`${draft.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>}
            </div>
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
            <Select label="Owner" required value={draft.ownerId} onChange={event => setDraft({ ...draft, ownerId: event.target.value })}>
              <option value="" disabled>Select an owner</option>
              {draft.ownerId && !owners.some(owner => owner.id === draft.ownerId) && <option value={draft.ownerId} disabled>Unavailable staff member — select a new owner</option>}
              {owners.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </Select>
          </FieldGrid>
        </ModalBody>
        <ModalFooter><Button disabled={saving} type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? 'Saving…' : editing?.follow_up ? 'Save task' : creatingTask ? 'Create task' : 'Convert to task'}</Button></ModalFooter>
      </form>
    </SlidePanel>

  </PageContainer></div>
}
