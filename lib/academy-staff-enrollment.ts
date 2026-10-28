/** Local enrollment design data. No identity verification, scheduling or billing. */
export type EnrollmentPerson = {
  id: string; firstName: string; lastName: string; email: string; phone: string; activeTeacher: boolean
}
export type LessonChoice = {
  addedLesson?: boolean
  studentId?: string
  id: string; instrument: string; teacher: string; day: string; time: string
  start: string; duration: string; frequency: string
}
export type StaffEnrollment = {
  otherPayer?: { name: string; email: string; phone: string } | null
  additionalStudents: (EnrollmentPerson | null)[]
  student: EnrollmentPerson | null
  manager: EnrollmentPerson | null
  payer: 'student' | 'manager' | 'other'
  lessons: LessonChoice[]
  payment: 'later' | 'demo_card'
}
export const enrollmentPeople: readonly EnrollmentPerson[] = [
  { id: 'demo-avery', firstName: 'Avery', lastName: 'Lane', email: 'avery@example.test', phone: '', activeTeacher: true },
  { id: 'demo-jamie', firstName: 'Jamie', lastName: 'Park', email: 'jamie@example.test', phone: '', activeTeacher: false },
  { id: 'demo-riley', firstName: 'Riley', lastName: 'Park', email: '', phone: '', activeTeacher: false },
]
export const enrollmentTeachers = ['Jordan Vale', 'Robin Ellis'] as const
export function newLesson(id: string): LessonChoice {
  return { id, instrument: 'Piano', teacher: '', day: 'Tuesday', time: '', start: '', duration: '30', frequency: 'Monthly subscription' }
}
export function ensureStudentLessons(draft: StaffEnrollment): LessonChoice[] {
  const lessons = draft.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId ?? draft.student?.id }))
  for (const person of enrollmentStudents(draft)) {
    if (!lessons.some(lesson => lesson.studentId === person.id)) lessons.push({ ...newLesson(`lesson-${person.id}`), studentId: person.id })
  }
  return lessons
}
export function newStaffEnrollment(): StaffEnrollment {
  return { student: null, additionalStudents: [], manager: null, payer: 'student', lessons: [newLesson('lesson-1')], payment: 'later' }
}
export function enrollmentStudents(draft: StaffEnrollment): EnrollmentPerson[] {
  return [draft.student, ...draft.additionalStudents].filter((person): person is EnrollmentPerson => Boolean(person))
}
export function lessonStudent(draft: StaffEnrollment, lesson: LessonChoice) {
  return enrollmentStudents(draft).find(person => person.id === (lesson.studentId ?? draft.student?.id)) || null
}
export function searchEnrollmentPeople(query: string, people: readonly EnrollmentPerson[] = enrollmentPeople) {
  const text = query.trim().toLowerCase()
  if (!text) return []
  return people.filter(person => `${person.firstName} ${person.lastName} ${person.email} ${person.phone}`.toLowerCase().includes(text))
}
export function lessonPrice(lesson: LessonChoice, person: EnrollmentPerson | null) {
  const base = Number(lesson.duration) === 60 ? 10000 : 5000
  return { base, discount: person?.activeTeacher ? base / 2 : 0, total: person?.activeTeacher ? base / 2 : base }
}
export function personDetailsError(person: EnrollmentPerson | null): string | null {
  if (!person?.firstName.trim() || !person.lastName.trim()) return 'Enter a first and last name.'
  if (person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) return 'Enter a valid email address.'
  return null
}
export function enrollmentStepError(draft: StaffEnrollment, step: number): string | null {
  if (step === 0) {
    if (!draft.student?.firstName.trim() || !draft.student.lastName.trim()) return 'Choose a student or enter their first and last name.'
    if (personDetailsError(draft.student)) return personDetailsError(draft.student)
    if (draft.additionalStudents.some(person => !person || personDetailsError(person))) return 'Enter each student’s first and last name and check their email.'
    const students = enrollmentStudents(draft)
    if (new Set(students.map(person => person.id)).size !== students.length) return 'Choose each student once.'
    if (draft.manager && (!draft.manager.firstName.trim() || !draft.manager.lastName.trim())) return 'Enter the parent or guardian’s first and last name.'
    if (draft.manager && personDetailsError(draft.manager)) return personDetailsError(draft.manager)
    if (students.some(person => person.id === draft.manager?.id)) return 'Choose another person as the parent or guardian.'
    if (draft.payer === 'manager' && !draft.manager) return 'Choose a parent or guardian to pay.'
  }
  if (step === 1 || step === 2) {
    if (!draft.lessons.length) return 'Add a lesson.'
    if (draft.lessons.some(lesson => !lessonStudent(draft, lesson))) return 'Choose a student for each lesson.'
    if (enrollmentStudents(draft).some(person => !draft.lessons.some(lesson => lessonStudent(draft, lesson)?.id === person.id))) return 'Add a lesson for each student.'
    if (draft.lessons.some(lesson => !lesson.instrument.trim() || !['30', '60'].includes(lesson.duration) || !['Monthly subscription', 'À-la-carte'].includes(lesson.frequency))) return 'Choose an instrument, cadence and length for each lesson.'
    if (step === 2 && draft.lessons.some(lesson => !enrollmentTeachers.some(teacher => teacher === lesson.teacher) || !lesson.time || !lesson.start)) return 'Choose a teacher, start date and time for each lesson.'
  }
  if (step === 4 && draft.payer === 'other') {
    if (!draft.otherPayer?.name.trim()) return 'Enter the payer’s name.'
    if (draft.otherPayer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.otherPayer.email.trim())) return 'Enter a valid payer email address.'
  }
  return null
}
export function saveLocalEnrollment(draft: StaffEnrollment): StaffEnrollment {
  for (const step of [0, 1, 2, 4]) {
    const error = enrollmentStepError(draft, step)
    if (error) throw new Error(error)
  }
  return {
    ...draft, otherPayer: draft.otherPayer && { ...draft.otherPayer }, student: draft.student && { ...draft.student }, manager: draft.manager && { ...draft.manager },
    additionalStudents: draft.additionalStudents.map(person => person && { ...person }),
    lessons: draft.lessons.map(lesson => ({ ...lesson })),
  }
}