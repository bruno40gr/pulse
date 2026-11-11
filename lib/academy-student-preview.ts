import type { NoteAttachment } from './note-links'

/** Fictional product-design fixtures, never canonical people or live enrollments. */
export type PreviewFamilyMember = { id: string; name: string; relationship: string; email?: string; phone?: string; studentId?: string }
export type PreviewEnrollment = {
  level: 1 | 2 | 3
  id: string; studentId: string; program: string; service: string; teacher: string
  day: string; time: string; duration: number; start: string; frequency: 'Weekly' | 'One-off'
  amountMinor: number; currency: string; priceUnit: string; collection: string
  payerId: string; paymentMethod: string; status: 'active' | 'pending'
  lifecycle?: 'frozen' | 'cancelled'
  monthlyQuantity?: number
  recurringSchedule?: { start: string; time: string; teacher: string; changes: { from: string; date: string; time: string; teacher: string }[] }
}
export type PreviewLesson = { id: string; enrollmentId: string; date: string; time: string; room: string; status: string; teacher?: string; originalDate?: string }
export type PreviewNote = { id: string; text: string; timestamp: string; actor_name: string; actor_id?: string; audience?: 'family' | 'internal'; edited_at?: string; links?: NoteAttachment[]; completed_at?: string | null; mentions?: string[] }
export type PreviewMessage = { id: string; channel: 'email' | 'sms'; direction: 'inbound' | 'outbound'; timestamp: string; subject?: string; text: string }
export type PreviewStudent = {
  id: string; firstName: string; lastName: string; email: string; phone: string; birthday?: string
  family: PreviewFamilyMember[]; communicationContactId: string
  enrollments: PreviewEnrollment[]; notes: PreviewNote[]; messages: PreviewMessage[]
}

export function previewStudentName(student: PreviewStudent) { return `${student.firstName} ${student.lastName}` }

/** Exact owner+ID lookup. No first-enrollment fallback for ambiguous selections. */
export function selectedPreviewEnrollment(student: PreviewStudent, id: string | null) {
  return student.enrollments.find(enrollment => enrollment.id === id && enrollment.studentId === student.id) || null
}

export function previewEnrollmentLessons(enrollment: PreviewEnrollment | null, lessons: PreviewLesson[]) {
  return enrollment ? lessons.filter(lesson => lesson.enrollmentId === enrollment.id).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) : []
}

export function previewPayer(student: PreviewStudent, enrollment: PreviewEnrollment) {
  if (enrollment.studentId !== student.id) return null
  if (enrollment.payerId === student.id) return { id: student.id, name: previewStudentName(student), email: student.email, phone: student.phone }
  return student.family.find(person => person.id === enrollment.payerId) || null
}

export function previewMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amountMinor / 100)
}

export function createStudentPreview(): { students: PreviewStudent[]; lessons: PreviewLesson[] } {
  const guardian: PreviewFamilyMember = { id: 'preview:sam-kim', name: 'Sam Kim', relationship: 'Parent / guardian', email: 'sam.kim@example.invalid', phone: '(202) 555-0142' }
  const coGuardian: PreviewFamilyMember = { id: 'preview:riley-kim', name: 'Riley Kim', relationship: 'Parent / guardian', email: 'riley.kim@example.invalid', phone: '' }
  const enrollment = (id: string, studentId: string, program: string, teacher: string, payerId: string, overrides: Partial<PreviewEnrollment> = {}): PreviewEnrollment => ({
    id: `preview:${id}`, studentId, program, service: 'Private', teacher, level: 1,
    day: 'Tuesday', time: '16:00', duration: 30, start: '2026-11-03', frequency: 'Weekly', amountMinor: 5000, currency: 'USD', priceUnit: 'per lesson', collection: 'Monthly · 1st of the month', payerId, paymentMethod: 'Not added', status: 'active', ...overrides,
  })
  const sophie: PreviewStudent = {
    id: 'preview:sophie', firstName: 'Sophie', lastName: 'Kim', email: '', phone: '', communicationContactId: guardian.id,
    family: [guardian, coGuardian, { id: 'preview:ethan', name: 'Ethan Kim', relationship: 'Sibling', studentId: 'preview:ethan' }],
    enrollments: [enrollment('sophie-piano', 'preview:sophie', 'Piano', 'Jordan Vale', guardian.id, { paymentMethod: 'Visa ···· 4242' })],
    notes: [
      { id: 'preview:sophie-note', text: 'Sophie is new to piano. Sam handles scheduling; keep Ethan’s lesson preferences separate.', timestamp: '2026-10-30T10:30:00Z', actor_name: 'Preview staff' },
      { id: 'preview:sophie-note-resources', audience: 'family', text: 'Shared practice resources: the C major warm-up video and the term curriculum PDF.', timestamp: '2026-10-31T09:15:00Z', actor_name: 'Preview staff', links: [{ url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', title: 'C major scale warm-up', kind: 'youtube' }, { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', title: 'Piano Foundations · Curriculum', kind: 'pdf' }] },
    ],
    messages: [
      { id: 'preview:sophie-followup', channel: 'sms', direction: 'outbound', timestamp: '2026-10-30T12:00:00Z', text: 'Hi Sam, Sophie’s first piano lesson is Tuesday at 4 pm. Let us know if you have any questions.' },
      { id: 'preview:sophie-inquiry', channel: 'email', direction: 'inbound', timestamp: '2026-10-28T09:00:00Z', subject: 'Piano lessons for Sophie', text: 'We’re interested in weekly piano lessons for Sophie. Tuesdays after school work best for her. Ethan is interested in guitar on Fridays.' },
    ],
  }
  const ethan: PreviewStudent = {
    id: 'preview:ethan', firstName: 'Ethan', lastName: 'Kim', email: '', phone: '', communicationContactId: guardian.id,
    family: [guardian, coGuardian, { id: sophie.id, name: previewStudentName(sophie), relationship: 'Sibling', studentId: sophie.id }],
    enrollments: [enrollment('ethan-guitar', 'preview:ethan', 'Guitar', 'Robin Ellis', coGuardian.id, { day: 'Friday', time: '17:00', start: '2026-11-06', paymentMethod: 'Visa ···· 1881' })],
    notes: [{ id: 'preview:ethan-practice', audience: 'family', text: 'Ethan is practising the G and C chord changes. Five minutes of slow changes each day will help before Friday’s lesson.', timestamp: '2026-11-02T15:00:00Z', actor_name: 'Robin Ellis' }, { id: 'preview:ethan-note', text: 'Ethan has a guitar at home. Friday is his preferred lesson day, not Sophie’s.', timestamp: '2026-10-29T14:00:00Z', actor_name: 'Preview staff' }],
    messages: [{ id: 'preview:ethan-inquiry', channel: 'email', direction: 'inbound', timestamp: '2026-10-29T09:00:00Z', subject: 'Guitar lesson for Ethan', text: 'Friday at 5 pm works for Ethan. Please keep Sophie’s Tuesday time.' }],
  }
  const alex: PreviewStudent = {
    id: 'preview:alex', firstName: 'Alex', lastName: 'Morgan', email: 'alex.morgan@example.invalid', phone: '', family: [], communicationContactId: 'preview:alex',
    enrollments: [
      enrollment('alex-guitar', 'preview:alex', 'Guitar', 'Robin Ellis', 'preview:alex', { level: 3, time: '17:00', duration: 60, amountMinor: 9000, paymentMethod: 'Visa ···· 4242' }),
      enrollment('alex-voice', 'preview:alex', 'Voice', 'Robin Ellis', 'preview:alex', { day: 'Thursday', time: '15:00', start: '2026-11-05', frequency: 'One-off', collection: 'One lesson · at confirmation', status: 'pending' }),
    ],
    notes: [{ id: 'preview:alex-note', text: 'Weekly guitar is established. The separate voice lesson still needs a payment method.', timestamp: '2026-10-30T11:00:00Z', actor_name: 'Preview staff' }],
    messages: [
      { id: 'preview:alex-reply', channel: 'email', direction: 'outbound', timestamp: '2026-10-30T11:15:00Z', subject: 'Your voice lesson', text: 'We have proposed Thursday at 3 pm for voice. Your weekly guitar lesson remains unchanged.' },
      { id: 'preview:alex-inquiry', channel: 'email', direction: 'inbound', timestamp: '2026-10-25T08:00:00Z', subject: 'Guitar and voice lessons', text: 'I’d like weekly guitar and a separate one-off voice lesson. I’ll be paying for both myself.' },
    ],
  }
  const mia: PreviewStudent = { id: 'preview:mia', firstName: 'Mia', lastName: 'Chen', email: 'mia.chen@example.invalid', phone: '', family: [], communicationContactId: 'preview:mia', enrollments: [], notes: [], messages: [] }
  const lessons: PreviewLesson[] = []
  for (const student of [sophie, ethan, alex]) {
    for (const item of student.enrollments) {
      // Fixed fictional occurrences, not generated real availability or reservations.
      const dates = item.id.endsWith('voice') ? ['2026-11-05'] : item.day === 'Friday' ? ['2026-11-06', '2026-11-13'] : ['2026-11-03', '2026-11-10']
      dates.forEach((date, index) => lessons.push({ id: `${item.id}:lesson:${index}`, enrollmentId: item.id, date, time: item.time, room: item.program === 'Guitar' ? 'Studio 2' : 'Studio 1', status: item.status === 'pending' ? 'Proposed' : 'Scheduled' }))
    }
  }
  return { students: [sophie, alex, ethan, mia], lessons }
}

export type WorkspaceSection = 'profile' | 'enrollments' | 'scheduling' | 'billing' | 'funding' | 'communication' | 'notes' | 'makeups' | 'payment-methods'
export type WorkspaceLocation = { view: 'contacts' | 'quick' | 'staff' | 'parent'; accountId: string; studentId: string; section: WorkspaceSection; enrollmentId: string; enrollmentSection: 'details' | 'scheduling' | 'payment'; teacher: string; calendar: 'agenda' | 'week'; week: number }
export const workspaceInitial: WorkspaceLocation = { view: 'contacts', accountId: '', studentId: '', section: 'profile', enrollmentId: '', enrollmentSection: 'details', teacher: '', calendar: 'agenda', week: 0 }
export const familyStudentIds = ['preview:sophie', 'preview:ethan']

/** Presentation simulation only. Real portal authorization must be server-enforced. */
export function workspaceStudents(students: PreviewStudent[], view: WorkspaceLocation['view'], studentId = '') {
  return students.filter(student => (view !== 'parent' || familyStudentIds.includes(student.id)) && (!studentId || student.id === studentId))
}

export function workspaceOccurrences(data: ReturnType<typeof createStudentPreview>, location: WorkspaceLocation) {
  const students = workspaceStudents(data.students, ('demoSchool' in data && data.demoSchool) ? 'staff' : location.view, location.studentId)
  return data.lessons.flatMap(lesson => {
    const student = students.find(person => person.enrollments.some(enrollment => enrollment.id === lesson.enrollmentId && enrollment.studentId === person.id))
    const enrollment = student?.enrollments.find(item => item.id === lesson.enrollmentId)
    if (!student || !enrollment || (location.enrollmentId && enrollment.id !== location.enrollmentId)) return []
    const teacher = lesson.teacher || enrollment.teacher
    if (location.teacher && teacher !== location.teacher) return []
    return [{ ...lesson, teacher, student, enrollment }]
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
}

export type LessonRequest = { lessonId: string; kind: 'Reschedule' | 'Cancel'; reason: string }
export function addPreviewRequest(requests: LessonRequest[], lessonIds: string[], request: LessonRequest): LessonRequest[] {
  if (!lessonIds.includes(request.lessonId) || !request.reason.trim() || !['Reschedule', 'Cancel'].includes(request.kind)) throw new Error('Invalid lesson request')
  if (requests.some(item => item.lessonId === request.lessonId)) throw new Error('A request already exists for this lesson')
  return [...requests, { ...request, reason: request.reason.trim() }]
}

export function workspaceLocationFromSearch(search: string): WorkspaceLocation {
  const params = new URLSearchParams(search)
  const view = params.get('view'), section = params.get('section')
  return {
    ...workspaceInitial,
    view: view === 'quick' || view === 'staff' || view === 'parent' ? view : 'contacts',
    accountId: params.get('account') || '', studentId: params.get('student') || '', enrollmentId: params.get('enrollment') || '', teacher: params.get('teacher') || '',
    section: section && ['profile', 'enrollments', 'scheduling', 'billing', 'funding', 'communication', 'notes', 'makeups', 'payment-methods'].includes(section) ? section as WorkspaceSection : 'profile',
    enrollmentSection: params.get('enrollmentSection') === 'scheduling' ? 'scheduling' : params.get('enrollmentSection') === 'payment' ? 'payment' : 'details',
    calendar: params.get('calendar') === 'week' ? 'week' : 'agenda', week: params.get('week') === '1' ? 1 : 0,
  }
}

export function workspaceLocationSearch(location: WorkspaceLocation, currentSearch = '') {
  const params = new URLSearchParams(currentSearch)
  params.delete('paymentReturnStudent')
  params.delete('paymentReturnView')
  for (const [key, value] of Object.entries({ view: location.view, account: location.accountId, student: location.studentId, section: location.section, enrollment: location.enrollmentId, enrollmentSection: location.enrollmentSection, teacher: location.teacher, calendar: location.calendar, week: String(location.week) })) {
    if (value) params.set(key, value); else params.delete(key)
  }
  return `?${params}`
}

export function createConnectedPreview() {
  const data = createStudentPreview()
  const sophie = data.students.find(student => student.id === 'preview:sophie')!
  const voice: PreviewEnrollment = { ...sophie.enrollments[0], level: 2, id: 'preview:sophie-voice', program: 'Voice', teacher: 'Robin Ellis', day: 'Thursday', time: '17:00', start: '2026-11-05', amountMinor: 6000 }
  sophie.enrollments.push(voice)
  for (const [index, date] of ['2026-11-05', '2026-11-12'].entries()) data.lessons.push({ id: `${voice.id}:lesson:${index}`, enrollmentId: voice.id, date, time: voice.time, room: 'Studio 3', status: 'Scheduled' })
  // One occurrence has a substitute, without changing the recurring agreement.
  data.lessons.find(lesson => lesson.id === 'preview:sophie-piano:lesson:1')!.teacher = 'Casey Reed'
  return data
}
/** Stable local identity; never use display names to authorize note edits. */
export const previewNoteActorId = 'preview:staff:current'
export function editPreviewNote(note: PreviewNote, actorId: string, text: string): PreviewNote {
  if (!note.actor_id || note.actor_id !== actorId) throw new Error('Only the author can edit this note.')
  if (!text.trim()) throw new Error('Enter a note.')
  return { ...note, text: text.trim(), edited_at: new Date().toISOString() }
}
