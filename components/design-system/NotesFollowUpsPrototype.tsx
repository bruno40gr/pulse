'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Button, DenseSectionPanel, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageContainer, PageHeader, Select, Textarea } from '@/components/ui'
import { Tabs } from '@/components/ui/Tabs'
import { ControlButton } from '@/components/ui/ControlButton'
import { TaskCompletionButton } from '@/components/ui/TaskCompletionButton'
import { getNoteBackground, NOTE_COLORS } from '@/lib/sticky-note-appearance'
import { colors, spacing, typography } from '@/lib/tokens'
import { initialReviewNotes, localReviewDate, matchesReviewFilter, promoteReviewNote, PROTOTYPE_STORAGE_KEY, readReviewNotes, REVIEW_OWNERS, REVIEW_PEOPLE, type FollowUp, type FollowUpFilter, type PrototypeNote } from '@/lib/notes-follow-ups-prototype'
import styles from './NotesFollowUpsPrototype.module.css'

export default function NotesFollowUpsPrototype() {
  const [notes, setNotes] = useState<PrototypeNote[]>([])
  const [ready, setReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState('')
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [filter, setFilter] = useState<FollowUpFilter>('all')
  const [owner, setOwner] = useState('all')
  const [kind, setKind] = useState('all')
  const [editing, setEditing] = useState<PrototypeNote | null>(null)
  const [draft, setDraft] = useState<FollowUp>({ title: '', personId: null, ownerId: 'admin', dueDate: '' })
  const [error, setError] = useState('')
  const [personId, setPersonId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', body: '', color: 'yellow' })
  const today = localReviewDate()

  useEffect(() => {
    let restored: PrototypeNote[] | null = null
    try {
      const raw = localStorage.getItem(PROTOTYPE_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        restored = readReviewNotes(saved.notes)
        if (saved.view === 'list' || saved.view === 'cards') setView(saved.view)
      }
    } catch { setStorageWarning('Browser storage is unavailable. Changes will last for this visit only.') }
    setNotes(restored || initialReviewNotes())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify({ notes, view })) }
    catch { setStorageWarning('Browser storage is unavailable. Changes will last for this visit only.') }
  }, [notes, view, ready])

  const visible = notes.filter(note => matchesReviewFilter(note, filter, today)
    && (owner === 'all' || note.followUp?.ownerId === owner)
    && (kind === 'all' || REVIEW_PEOPLE.find(person => person.id === note.followUp?.personId)?.kind === kind))
    .sort((a, b) => (a.followUp?.dueDate || '9999').localeCompare(b.followUp?.dueDate || '9999'))
  const person = REVIEW_PEOPLE.find(entry => entry.id === personId)
  const personNotes = notes.filter(note => note.followUp?.personId === personId)
  const toggleDone = (note: PrototypeNote) => setNotes(current => current.map(entry => entry.id === note.id ? { ...entry, completedAt: entry.completedAt ? null : new Date().toISOString() } : entry))
  const openEditor = (note: PrototypeNote) => {
    setPersonId(null)
    setDraft(note.followUp || { title: note.title, personId: null, ownerId: 'admin', dueDate: today })
    setEditing(note)
    setError('')
  }
  const dueLabel = (note: PrototypeNote) => note.completedAt ? 'Completed' : !note.followUp ? 'Just a note' : note.followUp.dueDate < today ? `Overdue · ${note.followUp.dueDate}` : note.followUp.dueDate === today ? 'Due today' : `Due ${note.followUp.dueDate}`
  const related = (note: PrototypeNote) => {
    const relatedPerson = REVIEW_PEOPLE.find(entry => entry.id === note.followUp?.personId)
    return relatedPerson ? <ControlButton kind="link" onClick={() => setPersonId(relatedPerson.id)}>{relatedPerson.name} · {relatedPerson.kind === 'lead' ? 'Lead' : 'Contact'}</ControlButton> : <span style={{ color: colors.textSecondary }}>{note.followUp ? 'No person linked' : 'Unlinked note'}</span>
  }
  const actions = (note: PrototypeNote) => <div className={styles.meta}>
    {note.followUp && <TaskCompletionButton completed={!!note.completedAt} aria-label={`${note.completedAt ? 'Reopen' : 'Complete'} ${note.followUp.title}`} onClick={() => toggleDone(note)} />}
    {!note.completedAt && <Button variant="secondary" size="sm" onClick={() => openEditor(note)}>{note.followUp ? 'Reschedule / edit' : 'Make a follow-up'}</Button>}
  </div>

  return <PageContainer style={{ boxSizing: 'border-box', minWidth: 0, fontFamily: typography.fontSans, fontSize: typography.sizeBase }}>
    <PageHeader title="Notes" subtitle="A thought when you need it. A follow-up when you mean it." right={<Button onClick={() => { setCreating(true); setError('') }}>New sticky note</Button>} />
    <p style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 0 }}>Interactive prototype · Fictional people · Saved only in this browser · No messages or production changes.</p>
    {storageWarning && <p role="status">{storageWarning}</p>}
    <div className={styles.toolbar}>
      <Tabs ariaLabel="Notes view" variant="prominent" controlSize="toolbar" items={[{ key: 'cards', label: 'Cards' }, { key: 'list', label: 'List' }]} activeKey={view} onChange={setView} />
      <Select aria-label="Show notes" controlSize="toolbar" fullWidth={false} value={filter} onChange={event => setFilter(event.target.value as FollowUpFilter)}>
        <option value="all">All open notes</option><option value="today">Today + overdue</option><option value="upcoming">Upcoming follow-ups</option><option value="notes">Just notes</option><option value="completed">Completed</option>
      </Select>
      <Select aria-label="Assigned to" controlSize="toolbar" fullWidth={false} value={owner} onChange={event => setOwner(event.target.value)}><option value="all">Everyone</option>{REVIEW_OWNERS.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
      <Select aria-label="Related record type" controlSize="toolbar" fullWidth={false} value={kind} onChange={event => setKind(event.target.value)}><option value="all">Leads + contacts</option><option value="lead">Leads only</option><option value="contact">Contacts only</option></Select>
    </div>
    <p role="status" style={{ color: colors.textSecondary }}>{visible.length} {visible.length === 1 ? 'item' : 'items'} · Same notes, different views. Only purposeful follow-ups appear in the daily list.</p>
    {!ready ? <p>Loading your review…</p> : visible.length === 0 ? <p>No notes match these filters.</p> : view === 'cards' ? <div className={styles.cards}>
      {visible.map(note => <article key={note.id} className={styles.card} aria-label={note.title}>
        <DenseSectionPanel title={note.followUp?.title || note.title} headingLevel="h2" actions={actions(note)} style={{ background: getNoteBackground(note.color, !!note.completedAt) }}>
          <p className={styles.body}>{note.body}</p>
          <div className={styles.meta}>{related(note)}</div>
          <p style={{ marginBottom: 0, color: note.followUp && !note.completedAt && note.followUp.dueDate < today ? colors.error : colors.textSecondary }}>{dueLabel(note)}{note.followUp ? ` · ${REVIEW_OWNERS.find(entry => entry.id === note.followUp?.ownerId)?.name}` : ''}</p>
        </DenseSectionPanel>
      </article>)}
    </div> : <div className={styles.list} style={{ '--notes-border': colors.border, '--notes-muted': colors.textSecondary, '--notes-hover': colors.tableRowHover } as CSSProperties}>
      <table className={styles.table} aria-label="Notes and follow-ups"><thead><tr><th>Note / action</th><th>Related to</th><th>Assigned to</th><th>Due</th><th>Actions</th></tr></thead>
        <tbody>{visible.map(note => <tr key={note.id}>
          <td><strong style={{ borderLeft: `4px solid ${NOTE_COLORS[note.color] || colors.border}`, paddingLeft: spacing.sm }}>{note.followUp?.title || note.title}</strong><p style={{ marginBottom: 0, color: colors.textSecondary }}>{note.body}</p></td>
          <td>{related(note)}</td><td>{REVIEW_OWNERS.find(entry => entry.id === note.followUp?.ownerId)?.name || 'Not a task'}</td><td>{dueLabel(note)}</td><td>{actions(note)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p style={{ marginTop: spacing['3xl'], color: colors.textSecondary }}>Notes do not become tasks automatically. No projects, boards or dependencies. Leads and contacts stay separate.</p>

    <Modal isOpen={!!editing} onClose={() => setEditing(null)} ariaLabel="Make a follow-up" size="md">
      <ModalHeader title={editing?.followUp ? 'Edit follow-up' : 'Make a follow-up'} onClose={() => setEditing(null)} />
      <form style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }} onSubmit={event => {
        event.preventDefault()
        if (!editing) return
        try {
          const updated = promoteReviewNote(editing, draft)
          setNotes(current => current.map(note => note.id === updated.id ? updated : note))
          setEditing(null)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the fields.') }
      }}>
        <ModalBody><p>The original note and its color stay. This adds an explicit action, not a duplicate.</p>
          {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
          <FieldGrid columns={1}>
            <Input label="Action" required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
            <Select label="Related lead or contact" value={draft.personId || ''} onChange={event => setDraft({ ...draft, personId: event.target.value || null })}><option value="">No person linked</option>{REVIEW_PEOPLE.map(entry => <option key={entry.id} value={entry.id}>{entry.name} ({entry.kind})</option>)}</Select>
            <Select label="Owner" value={draft.ownerId} onChange={event => setDraft({ ...draft, ownerId: event.target.value })}>{REVIEW_OWNERS.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
            <Input label="Due date" type="date" required value={draft.dueDate} onChange={event => setDraft({ ...draft, dueDate: event.target.value })} />
          </FieldGrid>
        </ModalBody>
        <ModalFooter><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">{editing?.followUp ? 'Save follow-up' : 'Create follow-up'}</Button></ModalFooter>
      </form>
    </Modal>

    <Modal isOpen={creating} onClose={() => setCreating(false)} ariaLabel="New sticky note" size="md">
      <ModalHeader title="New sticky note" onClose={() => setCreating(false)} />
      <form style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }} onSubmit={event => {
        event.preventDefault()
        if (!newNote.title.trim() || !newNote.body.trim()) { setError('Add a title and note.'); return }
        setNotes(current => [...current, { id: crypto.randomUUID(), title: newNote.title.trim(), body: newNote.body.trim(), color: newNote.color, followUp: null, completedAt: null }])
        setCreating(false); setNewNote({ title: '', body: '', color: 'yellow' }); setFilter('all'); setKind('all'); setOwner('all')
      }}>
        <ModalBody>{error && <p role="alert">{error}</p>}<FieldGrid columns={1}>
          <Input label="Title" required value={newNote.title} onChange={event => setNewNote({ ...newNote, title: event.target.value })} />
          <Textarea label="Note" required value={newNote.body} onChange={event => setNewNote({ ...newNote, body: event.target.value })} />
          <Select label="Sticky color" value={newNote.color} onChange={event => setNewNote({ ...newNote, color: event.target.value })}>{Object.keys(NOTE_COLORS).map(color => <option key={color} value={color}>{color}</option>)}</Select>
        </FieldGrid></ModalBody>
        <ModalFooter><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit">Save note</Button></ModalFooter>
      </form>
    </Modal>

    <Modal isOpen={!!person} onClose={() => setPersonId(null)} ariaLabel="Related person preview" size="lg">
      <ModalHeader title={person?.name || 'Person preview'} onClose={() => setPersonId(null)} />
      <ModalBody><p>{person?.kind === 'lead' ? 'Lead' : 'Contact'} workspace preview · Notes &amp; follow-ups</p><p style={{ color: colors.textSecondary }}>The same items, filtered to this person. This is not a replacement for the Odeon profile workspace.</p>
        <div className={styles.personList}>{personNotes.map(note => <DenseSectionPanel key={note.id} title={note.followUp?.title || note.title} actions={actions(note)} style={{ background: getNoteBackground(note.color, !!note.completedAt) }}><p className={styles.body}>{note.body}</p><span>{dueLabel(note)}</span></DenseSectionPanel>)}</div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setPersonId(null)}>Back to notes</Button></ModalFooter>
    </Modal>
  </PageContainer>
}