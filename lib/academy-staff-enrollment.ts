/** Local enrollment design data. No identity verification, scheduling or billing. */
export type EnrollmentPerson = {
  id: string; firstName: string; lastName: string; email: string; phone: string; activeTeacher: boolean
}
export const enrollmentServices = ['Private', 'Semi-private', 'Group'] as const
export const enrollmentInstruments = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet'] as const
export const enrollmentGroupPrograms = ['Tiny Keys', 'Little Rockers', 'Band Program'] as const
export type LessonChoice = {
  service: typeof enrollmentServices[number]
  addedLesson?: boolean
  studentId?: string
  id: string; instrument: string; teacher: string; day: string; time: string
  start: string; duration: string; frequency: string
}
export type StaffEnrollment = {
  contact: EnrollmentPerson | null
  contactIsStudent: boolean
  studentRelationships: Record<string, string>
  otherPayer?: { name: string; email: string; phone: string } | null
  additionalStudents: (EnrollmentPerson | null)[]
  student: EnrollmentPerson | null
  manager: EnrollmentPerson | null
  payer: 'student' | 'manager' | 'other'
  lessons: LessonChoice[]
  payment: 'later' | 'demo_card'
  consent: { termsAccepted: boolean; serviceSms: boolean }
}
export const enrollmentPeople: readonly EnrollmentPerson[] = [
  { id: 'demo-avery', firstName: 'Avery', lastName: 'Lane', email: 'avery@example.test', phone: '', activeTeacher: true },
  { id: 'demo-jamie', firstName: 'Jamie', lastName: 'Park', email: 'jamie@example.test', phone: '', activeTeacher: false },
  { id: 'demo-riley', firstName: 'Riley', lastName: 'Park', email: '', phone: '', activeTeacher: false },
]
export const enrollmentTeachers = ['Jordan Vale', 'Robin Ellis'] as const
export function newLesson(id: string): LessonChoice {
  return { id, service: 'Private', instrument: 'Piano', teacher: '', day: 'Tuesday', time: '', start: '', duration: '30', frequency: 'Monthly subscription' }
}
export function ensureStudentLessons(draft: StaffEnrollment): LessonChoice[] {
  const lessons = draft.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId ?? draft.student?.id }))
  for (const person of enrollmentStudents(draft)) {
    if (!lessons.some(lesson => lesson.studentId === person.id)) lessons.push({ ...newLesson(`lesson-${person.id}`), studentId: person.id })
  }
  return lessons
}
export function newStaffEnrollment(): StaffEnrollment {
  return { contact: null, contactIsStudent: true, studentRelationships: {}, student: null, additionalStudents: [], manager: null, payer: 'student', lessons: [], payment: 'demo_card', consent: { termsAccepted: false, serviceSms: false } }
}
export function enrollmentStudents(draft: StaffEnrollment): EnrollmentPerson[] {
  const contactLearner = draft.contact && draft.lessons.some(lesson => lesson.studentId === draft.contact?.id) ? draft.contact : null
  return [...new Map([draft.student, ...draft.additionalStudents, contactLearner].filter((person): person is EnrollmentPerson => Boolean(person)).map(person => [person.id, person])).values()]
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
    if (personDetailsError(draft.contact)) return 'Enter the contact’s first and last name and check their email.'
    if (!draft.contact?.email.trim() && !draft.contact?.phone.trim()) return 'Enter an email or phone number for the contact.'
    if (!draft.student?.firstName.trim() || !draft.student.lastName.trim()) return 'Choose a student or enter their first and last name.'
    if (personDetailsError(draft.student)) return personDetailsError(draft.student)
    if (draft.additionalStudents.some(person => !person || personDetailsError(person))) return 'Enter each student’s first and last name and check their email.'
    const students = enrollmentStudents(draft)
    if (new Set(students.map(person => person.id)).size !== students.length) return 'Choose each student once.'
    if (draft.manager && (!draft.manager.firstName.trim() || !draft.manager.lastName.trim())) return 'Enter the parent or guardian’s first and last name.'
    if (draft.manager && personDetailsError(draft.manager)) return personDetailsError(draft.manager)
    if ([draft.student, ...draft.additionalStudents].some(person => person && person.id === draft.manager?.id)) return 'Choose another person as the contact, or select classes for this person.'
    if (draft.payer === 'manager' && !draft.manager) return 'Choose a parent or guardian to pay.'
  }
  if (step === 1 || step === 2) {
    if (!draft.lessons.length) return 'Add a lesson.'
    if (draft.lessons.some(lesson => !lessonStudent(draft, lesson))) return 'Choose a student for each lesson.'
    if (enrollmentStudents(draft).some(person => !draft.lessons.some(lesson => lessonStudent(draft, lesson)?.id === person.id))) return 'Add a lesson for each student.'
    if (draft.lessons.some(lesson => !lesson.instrument.trim() || !['30', '60'].includes(lesson.duration) || !['Monthly subscription', 'À-la-carte'].includes(lesson.frequency))) return 'Choose an instrument, cadence and length for each lesson.'
    if (draft.lessons.some(lesson => !enrollmentServices.includes(lesson.service) || !(lesson.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).some(program => program === lesson.instrument))) return 'Choose a service and program for each lesson.'
    if (step === 2 && draft.lessons.some(lesson => lesson.service !== 'Private')) return 'Group sessions and semi-private matching are not available in this scheduling preview.'
    if (step === 2 && draft.lessons.some(lesson => !enrollmentTeachers.some(teacher => teacher === lesson.teacher) || !lesson.time || !lesson.start)) return 'Choose a teacher, start date and time for each lesson.'
  }
  if (step === 4 && draft.payer === 'other') {
    if (!draft.otherPayer?.name.trim()) return 'Enter the payer’s name.'
    if (draft.otherPayer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.otherPayer.email.trim())) return 'Enter a valid payer email address.'
  }
  if (step === 3) {
    if (!draft.consent.termsAccepted) return 'Accept the terms and conditions to continue.'
  }
  return null
}
export function saveLocalEnrollment(draft: StaffEnrollment): StaffEnrollment {
  for (const step of [0, 1, 2, 3, 4]) {
    const error = enrollmentStepError(draft, step)
    if (error) throw new Error(error)
  }
  return {
    ...draft, contact: draft.contact && { ...draft.contact }, studentRelationships: { ...draft.studentRelationships }, consent: { ...draft.consent }, otherPayer: draft.otherPayer && { ...draft.otherPayer }, student: draft.student && { ...draft.student }, manager: draft.manager && { ...draft.manager },
    additionalStudents: draft.additionalStudents.map(person => person && { ...person }),
    lessons: draft.lessons.map(lesson => ({ ...lesson })),
  }
}