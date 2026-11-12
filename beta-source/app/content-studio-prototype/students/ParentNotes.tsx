'use client'

import { useState } from 'react'
import { Button, NotesSection, SectionTitle, Select } from '@/beta-source/components/ui'
import { parentSharedNotes } from '@/beta-source/lib/academy-parent-portal'
import type { FamilyPreviewData, PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import { previewStudentName, type PreviewNote } from '@/beta-source/lib/academy-student-preview'
import type { NoteAttachment } from '@/beta-source/lib/note-links'
import { colors } from '@/beta-source/lib/tokens'
import { SectionHeader } from './SectionHeader'

export function ParentNotes({ data, account, notes, drafts, onDraft, onSave }: { data: FamilyPreviewData; account: PreviewAccount; notes: Record<string, PreviewNote[]>; drafts: Record<string, string>; onDraft: (studentId: string, text: string) => void; onSave: (studentId: string, text: string, id?: string, links?: NoteAttachment[]) => boolean }) {
  const [selected, setSelected] = useState(data.students[0]?.id || '')
  const [error, setError] = useState('')
  const student = data.students.find(person => person.id === selected) || data.students[0]
  if (!student) return null
  return <>
    <SectionHeader actions={<Select label="Student" value={student.id} onChange={event => { setSelected(event.target.value); setError('') }}>{data.students.map(person => <option key={person.id} value={person.id}>{previewStudentName(person)}</option>)}</Select>}><SectionTitle as="h2" variant="card">Notes</SectionTitle></SectionHeader>
    <p>Notes shared with your family and the academy. Only you can edit notes you wrote.</p>
    <NotesSection key={student.id} title={`${previewStudentName(student)} · Shared notes`} panel attachmentsEnabled avatarInitial={account.holderName[0]} avatarBg={colors.tealDark} cardBg={colors.surface} notes={parentSharedNotes(data, account, notes, student.id).map(note => ({ ...note, editable: note.actor_id === account.holderId }))} draft={drafts[student.id] || ''} onDraftChange={text => onDraft(student.id, text)} onSave={(text, _mentions, links) => { const saved = onSave(student.id, text, undefined, links); setError(saved ? '' : 'Unable to save this note. Your draft is retained.'); return saved }} onEdit={(entry, text) => onSave(student.id, text, entry.id)} renderToolbar={(onAdd, composing) => <SectionHeader actions={<Button variant="secondary" disabled={composing} onClick={onAdd}>Add note</Button>}><SectionTitle as="h3" variant="card">{previewStudentName(student)} · Shared notes</SectionTitle></SectionHeader>} />
    {error && <p role="alert">{error}</p>}
  </>
}