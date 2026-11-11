import { applyFamilyAction, parentFamilyProjection, previewContacts, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from './academy-family-preview'
import { absenceEligible, bookPreviewMakeup, cancelPreviewReplacement, movePreviewLesson, previewCalendarLessons, type MakeupPreviewState, type PreviewMakeup } from './academy-makeup-preview'
import { editPreviewNote, workspaceInitial, type PreviewNote } from './academy-student-preview'

/** Local simulation only. A real portal must enforce grants and mutations on the server. */
export function parentPortalProjection(data: FamilyPreviewData, account: PreviewAccount): FamilyPreviewData {
  const projected = parentFamilyProjection(data, account)
  const studentIds = new Set(projected.students.map(student => student.id))
  return {
    ...projected,
    contacts: previewContacts(data).filter(person => person.id === account.holderId),
    accounts: (data.demoSchool || account.id === 'preview:kim') ? [{ ...account, studentIds: [...studentIds], followUp: undefined, studentFollowUps: undefined }] : [],
    students: projected.students.map(student => ({ ...student, notes: student.notes.filter(note => note.audience === 'family'), messages: [], family: [], enrollments: student.enrollments.map(enrollment => ({ ...enrollment, payerId: enrollment.payerId === account.holderId ? enrollment.payerId : '', paymentMethod: enrollment.payerId === account.holderId ? enrollment.paymentMethod : '' })) })),
    lessons: projected.lessons.filter(lesson => projected.students.some(student => student.enrollments.some(enrollment => enrollment.id === lesson.enrollmentId))),
  }
}

/** One-occurrence self-service only. Validate against full data for teacher conflicts. */
export function applyParentScheduleAction(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, action: { kind: 'move' | 'book'; id: string; booking: NonNullable<PreviewMakeup['booking']> } | { kind: 'cancel-makeup'; id: string }) {
  const account = data.accounts.find(item => item.id === accountId && (data.demoSchool || item.id === 'preview:kim'))
  if (!account) throw new Error('Schedule unavailable in this portal.')
  const visible = parentPortalProjection(data, account)
  const lessons = previewCalendarLessons(visible, state.items, { ...workspaceInitial, view: 'parent', accountId })
  if (action.kind === 'book') {
    const credit = state.items.find(item => item.id === action.id && !item.booking && visible.students.some(student => student.id === item.studentId && student.enrollments.some(enrollment => enrollment.id === item.enrollmentId && !enrollment.lifecycle)))
    if (!credit) throw new Error('Makeup unavailable in this portal.')
    if (action.booking.program !== credit.program) throw new Error('A makeup must keep its original program.')
    return { data, state: bookPreviewMakeup(data, state, accountId, action.id, action.booking) }
  }
  const lesson = lessons.find(item => item.id === action.id && item.status === 'Scheduled')
  if (!lesson) throw new Error('Lesson unavailable in this portal.')
  if (action.kind === 'cancel-makeup') {
    if (!lesson.makeup) throw new Error('Makeup unavailable in this portal.')
    return { data, state: cancelPreviewReplacement(data, state, accountId, action.id) }
  }
  if (!absenceEligible(lesson.date, lesson.time)) throw new Error('Rescheduling less than 24 hours before a lesson requires staff approval. Contact the academy.')
  return movePreviewLesson(data, state, accountId, action.id, action.booking)
}

export function parentSharedNotes(data: FamilyPreviewData, account: PreviewAccount, notes: Record<string, PreviewNote[]>, studentId: string): PreviewNote[] {
  const student = parentPortalProjection(data, account).students.find(person => person.id === studentId)
  return student ? [...(notes[`${studentId}:notes`] || []).filter(note => note.audience === 'family'), ...student.notes] : []
}

export function applyParentNote(data: FamilyPreviewData, accountId: string, notes: Record<string, PreviewNote[]>, action: { studentId: string; text: string; id: string; edit?: boolean; links?: PreviewNote['links'] }): Record<string, PreviewNote[]> {
  const account = data.accounts.find(item => item.id === accountId && (data.demoSchool || item.id === 'preview:kim'))
  if (!account || !parentPortalProjection(data, account).students.some(student => student.id === action.studentId)) throw new Error('Student notes unavailable.')
  if (!action.text.trim() || action.text.length > 12000) throw new Error('Enter a note of up to 12,000 characters.')
  const key = `${action.studentId}:notes`, entries = notes[key] || []
  if (action.edit) {
    const note = entries.find(item => item.id === action.id && item.audience === 'family')
    if (!note) throw new Error('Note unavailable.')
    const edited = editPreviewNote(note, account.holderId, action.text)
    return { ...notes, [key]: entries.map(item => item.id === edited.id ? edited : item) }
  }
  if (!action.id || Object.values(notes).some(entries => entries.some(note => note.id === action.id))) throw new Error('Note already exists.')
  return { ...notes, [key]: [{ id: action.id, text: action.text.trim(), timestamp: new Date().toISOString(), actor_id: account.holderId, actor_name: account.holderName, audience: 'family', ...(action.links?.length ? { links: action.links } : {}) }, ...entries] }
}

export function applyParentPortalAction(data: FamilyPreviewData, accountId: string, action: FamilyAction): FamilyPreviewData {
  const account = data.accounts.find(item => item.id === accountId)
  if (!account || (!data.demoSchool && account.id !== 'preview:kim') || action.accountId !== account.id) throw new Error('Action unavailable in this portal.')
  const visible = parentPortalProjection(data, account)
  switch (action.kind) {
    case 'child': {
      const next = applyFamilyAction(data, action)
      return { ...next, accounts: next.accounts.map(item => item.id === account.id ? { ...item, parentAddedStudentIds: [...(item.parentAddedStudentIds || []), action.id] } : item) }
    }
    case 'dependent-relationship':
      if (!visible.students.some(student => student.id === action.studentId)) throw new Error('Family group action unavailable in this portal.')
      return applyFamilyAction(data, action, { role: 'parent', holderId: account.holderId })
    case 'unlink-child':
      if (!visible.students.some(student => student.id === action.studentId) || (action.payerId && action.payerId !== action.studentId)) throw new Error('Family group action unavailable in this portal.')
      return applyFamilyAction(data, action, { role: 'parent', holderId: account.holderId })
    case 'contact-details':
      if (action.contact.id !== account.holderId && !visible.students.some(student => student.id === action.contact.id)) throw new Error('Only your contact details and linked students can be edited here.')
      break
    case 'add-card':
      if (action.payerId !== account.holderId) throw new Error('Only your payment methods can be managed here.')
      break
    case 'default-card':
    case 'remove-card':
      if (!visible.cards.some(card => card.id === action.cardId)) throw new Error('Payment method unavailable.')
      break
    case 'pay-invoice':
    case 'pay-invoices': {
      const ids = action.kind === 'pay-invoice' ? [action.invoiceId] : action.invoiceIds
      if (!ids.length || ids.some(id => !visible.invoices.some(invoice => invoice.id === id)) || action.payerId !== account.holderId || !visible.cards.some(card => card.id === action.cardId)) throw new Error('Payment unavailable.')
      break
    }
    default: throw new Error('Action unavailable in this portal.')
  }
  return applyFamilyAction(data, action)
}