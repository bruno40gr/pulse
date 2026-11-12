import { NOTE_COLORS } from './sticky-note-appearance'

export type PreviewStickyNote = {
  id: string
  title?: string
  text: string
  color: string
  studentIds: string[]
  createdAt: string
  author: string
  private: boolean
}

/**
 * Stand-in for the dashboard sticky-notes feed (`app/dashboard/notes`).
 * A note is surfaced on a student when it mentions that student; it keeps its own sticky colour.
 */
export const previewStickyNotes: PreviewStickyNote[] = [
  { id: 'preview:sticky:sophie-recital', title: 'Recital prep', text: 'Sophie wants to play “Für Elise” at the winter recital — prepare a simplified arrangement by mid-November.', color: 'yellow', studentIds: ['preview:sophie'], createdAt: '2026-10-30T15:00:00Z', author: 'Jordan Vale', private: false },
  { id: 'preview:sticky:sophie-billing', title: 'Billing follow-up', text: 'Check with Sam about the saved card before the next monthly invoice runs.', color: 'pink', studentIds: ['preview:sophie'], createdAt: '2026-10-28T17:30:00Z', author: 'Preview staff', private: true },
  { id: 'preview:sticky:ethan-drill', text: 'Ethan needs a left-hand drill sheet before Friday’s guitar lesson.', color: 'blue', studentIds: ['preview:ethan'], createdAt: '2026-10-29T09:00:00Z', author: 'Nina Patel', private: false },
]

export function stickyNoteColor(color: string): string {
  return NOTE_COLORS[color] || NOTE_COLORS.yellow
}

export function stickyNotesForStudent(studentId: string): PreviewStickyNote[] {
  return previewStickyNotes.filter(note => note.studentIds.includes(studentId))
}
