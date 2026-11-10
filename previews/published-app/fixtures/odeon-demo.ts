/** Deterministic fictional sandbox. No database, auth, messaging or payment clients. */
export const demoMonths = ['2026-09', '2026-10'] as const
export const demoToday = '2026-11-09'
export const demoHours = [
  { day: 1, label: 'Monday', from: '12:00', to: '21:00' },
  { day: 2, label: 'Tuesday', from: '12:00', to: '21:00' },
  { day: 3, label: 'Wednesday', from: '12:00', to: '21:00' },
  { day: 4, label: 'Thursday', from: '12:00', to: '21:00' },
  { day: 5, label: 'Friday', from: '12:00', to: '21:00' },
  { day: 6, label: 'Saturday', from: '09:00', to: '15:00' },
]
export const demoServices = [
  { id: 'piano', name: 'Piano', format: 'private', minutes: 30, unitMinor: 4000 },
  { id: 'guitar', name: 'Guitar', format: 'private', minutes: 30, unitMinor: 4000 },
  { id: 'voice', name: 'Voice & Vocals', format: 'private', minutes: 30, unitMinor: 4000 },
  { id: 'drums', name: 'Drums', format: 'private', minutes: 30, unitMinor: 4000 },
  { id: 'bass', name: 'Bass', format: 'private', minutes: 30, unitMinor: 4000 },
  { id: 'tiny', name: 'Tiny Keys', format: 'group', minutes: 45, unitMinor: 3500, minAge: 5, maxAge: 7 },
  { id: 'rockers', name: 'Little Rockers', format: 'group', minutes: 30, unitMinor: 3500, minAge: 3, maxAge: 5 },
  { id: 'band', name: 'Band', format: 'group', minutes: 60, unitMinor: 3500 },
] as const
export type DemoServiceId = typeof demoServices[number]['id']
export type DemoTeacher = { id: string; name: string; email: string; serviceIds: DemoServiceId[]; days: number[] }
export type DemoStudent = { id: string; familyId: string; name: string; birthday: string }
export type DemoFamily = { id: string; name: string; guardian: string; email: string; otherGuardian?: string; staffTeacherId?: string; scenario: string }
export type DemoSession = { id: string; serviceId: DemoServiceId; teacherId: string; day: number; time: string; room: string; capacity: number }
export type DemoEnrollment = { id: string; studentId: string; sessionId: string; level: 1 | 2 | 3 }
export type DemoLesson = { id: string; sessionId: string; date: string }
export type DemoInvoiceLine = { enrollmentId: string; studentId: string; serviceId: DemoServiceId; dates: string[]; quantity: number; unitMinor: number; grossMinor: number; discountPercent: number; discountLabel: string; discountMinor: number; totalMinor: number }
export type DemoInvoice = { id: string; familyId: string; date: string; status: 'Paid'; lines: DemoInvoiceLine[]; grossMinor: number; discountMinor: number; totalMinor: number; paymentReference: string }
export type DemoMakeup = { id: string; studentId: string; enrollmentId: string; originalLessonId: string; reason: string; expires: string; status: 'Available' | 'Booked'; booking?: { date: string; time: string } }
export type OdeonDemo = { teachers: DemoTeacher[]; families: DemoFamily[]; students: DemoStudent[]; sessions: DemoSession[]; enrollments: DemoEnrollment[]; lessons: DemoLesson[]; invoices: DemoInvoice[]; makeups: DemoMakeup[] }
export const demoMoney = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100)
export const demoMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export function demoAge(birthday: string, date = demoToday) {
  return Number(date.slice(0, 4)) - Number(birthday.slice(0, 4)) - (date.slice(5) < birthday.slice(5) ? 1 : 0)
}
export function demoDates(day: number, month: string) {
  const date = new Date(`${month}-01T12:00:00Z`), result: string[] = []
  while (date.toISOString().startsWith(month)) {
    if (date.getUTCDay() === day) result.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return result
}
export function demoDiscount(data: Pick<OdeonDemo, 'students' | 'enrollments'>, family: DemoFamily) {
  if (family.staffTeacherId) return { percent: 50, label: 'Staff discount' }
  const active = data.students.filter(student => student.familyId === family.id && data.enrollments.some(item => item.studentId === student.id))
  return active.length >= 2 ? { percent: 10, label: 'Sibling discount' } : { percent: 0, label: 'No discount' }
}
export function createOdeonDemo(): OdeonDemo {
  const teacherSpecs: [string, DemoServiceId[], number[]][] = [
    ['Maya Chen', ['piano', 'tiny'], [1, 2, 3, 4, 5, 6]], ['Theo Brooks', ['piano'], [1, 2, 3, 4, 5]],
    ['Isabel Rivera', ['guitar', 'band'], [1, 2, 3, 4, 5, 6]], ['Owen Patel', ['guitar', 'bass'], [1, 2, 3, 4, 5]],
    ['Ava Bennett', ['voice'], [1, 2, 3, 4, 5]], ['Noah Ellis', ['voice', 'rockers'], [1, 2, 3, 4, 5, 6]],
    ['Zoe Morgan', ['drums'], [1, 2, 3, 4, 5]], ['Leo Carter', ['drums', 'band'], [1, 2, 3, 4, 5, 6]],
    ['Nina Shah', ['bass', 'band'], [1, 2, 3, 4, 5]], ['Eli Foster', ['piano', 'tiny', 'rockers'], [1, 2, 3, 4, 5, 6]],
  ]
  const teachers = teacherSpecs.map(([name, serviceIds, days], index) => ({ id: `demo:teacher-${index + 1}`, name, email: `${name.toLowerCase().replaceAll(' ', '.')}@example.invalid`, serviceIds, days }))
  const specs: [string, string, string[], number[], string][] = [
    ['Adams', 'Alex Adams', ['Emma'], [9], 'One child, weekly piano'],
    ['Baker', 'Jamie Baker', ['Lucas'], [12], 'Guitar, level 2'],
    ['Chen', 'Maya Chen', ['Lily'], [10], 'Staff household; voice and piano'],
    ['Diaz', 'Morgan Diaz', ['Mateo'], [11], 'Drums, level 3'],
    ['Evans', 'Taylor Evans', ['Sophie'], [14], 'Bass and band'],
    ['Foster', 'Eli Foster', ['Theo'], [6], 'Staff household; Tiny Keys'],
    ['Green', 'Jordan Green', ['Avery'], [32], 'Adult learner; self-managed account'],
    ['Hughes', 'Casey Hughes', ['Oliver', 'Amelia'], [8, 6], 'Private piano and Tiny Keys siblings'],
    ['Ibrahim', 'Sam Ibrahim', ['Adam', 'Sara'], [11, 9], 'Guitar and voice; two guardians'],
    ['Jones', 'Riley Jones', ['Henry', 'Ella'], [12, 10], 'Drums and bass; shared band'],
    ['Khan', 'Devon Khan', ['Aisha', 'Zain'], [5, 4], 'Tiny Keys and Little Rockers'],
    ['Lee', 'Cameron Lee', ['Grace', 'Ethan'], [13, 10], 'Piano and guitar; makeup credits'],
    ['Morgan', 'Zoe Morgan', ['Ruby', 'Max', 'Isla'], [9, 6, 4], 'Staff household with three siblings'],
    ['Novak', 'Parker Novak', ['Mila', 'Leo', 'Eva'], [12, 10, 7], 'Three siblings, multiple instruments and group'],
    ['Owens', 'Drew Owens', ['Jack', 'Chloe', 'Finn'], [14, 9, 3], 'Older band student, private voice and preschool group'],
  ]
  const families: DemoFamily[] = specs.map(([name, guardian, , , scenario], index) => ({ id: `demo:family-${index + 1}`, name: `${name} family`, guardian, email: `${guardian.toLowerCase().replaceAll(' ', '.')}@example.invalid`, scenario, ...(index === 8 ? { otherGuardian: 'Robin Ibrahim' } : {}), ...([2, 5, 12].includes(index) ? { staffTeacherId: teachers[index === 2 ? 0 : index === 5 ? 9 : 6].id } : {}) }))
  const students: DemoStudent[] = specs.flatMap(([last, , names, ages], index) => names.map((first, child) => ({ id: `demo:student-${index + 1}-${child + 1}`, familyId: families[index].id, name: `${first} ${last}`, birthday: `${2026 - ages[child]}-02-15` })))
  const sessions: DemoSession[] = [
    { id: 'demo:tiny-sat', serviceId: 'tiny', teacherId: teachers[0].id, day: 6, time: '10:00', room: 'Keys classroom', capacity: 8 },
    { id: 'demo:rockers-sat', serviceId: 'rockers', teacherId: teachers[5].id, day: 6, time: '09:00', room: 'Early years room', capacity: 8 },
    { id: 'demo:band-sat', serviceId: 'band', teacherId: teachers[7].id, day: 6, time: '12:00', room: 'Band room', capacity: 8 },
  ]
  const enrollments: DemoEnrollment[] = []
  const privateIds: DemoServiceId[] = ['piano', 'guitar', 'voice', 'drums', 'bass']
  const teacherUse = new Map<string, number>()
  function enroll(student: DemoStudent, serviceId: DemoServiceId, level: 1 | 2 | 3) {
    const service = demoServices.find(item => item.id === serviceId)!
    let session = sessions.find(item => item.serviceId === serviceId && service.format === 'group')
    if (!session) {
      const eligible = teachers.filter(item => item.serviceIds.includes(serviceId))
      const teacher = eligible.reduce((a, b) => (teacherUse.get(a.id) || 0) <= (teacherUse.get(b.id) || 0) ? a : b)
      const slot = teacherUse.get(teacher.id) || 0
      teacherUse.set(teacher.id, slot + 1)
      // Unique weekday per student prevents multiple-instrument overlaps.
      const day = 1 + privateIds.indexOf(serviceId)
      const minute = 15 * 60 + slot * 30
      session = { id: `demo:private-${sessions.length}`, serviceId, teacherId: teacher.id, day, time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, room: `Studio ${teachers.indexOf(teacher) + 1}`, capacity: 1 }
      sessions.push(session)
    }
    const serviceCount = enrollments.filter(item => sessions.find(assigned => assigned.id === item.sessionId)?.serviceId === serviceId).length
    enrollments.push({ id: `demo:enrollment-${enrollments.length + 1}`, studentId: student.id, sessionId: session.id, level: service.format === 'private' ? (1 + serviceCount % 3) as 1 | 2 | 3 : level })
  }
  const primaryServices: DemoServiceId[] = ['piano', 'guitar', 'voice', 'drums', 'bass', 'tiny', 'piano', 'piano', 'tiny', 'guitar', 'voice', 'drums', 'bass', 'tiny', 'rockers', 'piano', 'guitar', 'drums', 'tiny', 'rockers', 'guitar', 'bass', 'tiny', 'bass', 'voice', 'rockers']
  students.forEach((student, index) => {
    const age = demoAge(student.birthday)
    enroll(student, age <= 4 ? 'rockers' : age <= 7 ? 'tiny' : primaryServices[index], (1 + index % 3) as 1 | 2 | 3)
  })
  for (const [studentId, service] of [['demo:student-3-1', 'piano'], ['demo:student-5-1', 'band'], ['demo:student-10-1', 'band'], ['demo:student-10-2', 'band'], ['demo:student-14-1', 'band'], ['demo:student-15-1', 'band']] as [string, DemoServiceId][]) {
    const student = students.find(item => item.id === studentId)!
    if (!enrollments.some(item => item.studentId === studentId && sessions.find(session => session.id === item.sessionId)?.serviceId === service)) enroll(student, service, 2)
  }
  const lessons = sessions.flatMap(session => demoMonths.flatMap(month => demoDates(session.day, month).map(date => ({ id: `${session.id}:${date}`, sessionId: session.id, date }))))
  const data: OdeonDemo = { teachers, families, students, sessions, enrollments, lessons, invoices: [], makeups: [] }
  data.invoices = families.flatMap(family => demoMonths.map(month => {
    const discount = demoDiscount(data, family)
    const lines = enrollments.filter(item => students.find(student => student.id === item.studentId)?.familyId === family.id).map(enrollment => {
      const session = sessions.find(item => item.id === enrollment.sessionId)!, service = demoServices.find(item => item.id === session.serviceId)!
      const dates = lessons.filter(item => item.sessionId === session.id && item.date.startsWith(month)).map(item => item.date)
      const grossMinor = dates.length * service.unitMinor, discountMinor = Math.round(grossMinor * discount.percent / 100)
      return { enrollmentId: enrollment.id, studentId: enrollment.studentId, serviceId: service.id, dates, quantity: dates.length, unitMinor: service.unitMinor, grossMinor, discountPercent: discount.percent, discountLabel: discount.label, discountMinor, totalMinor: grossMinor - discountMinor }
    })
    return { id: `DEMO-${month}-${family.id.split('-').at(-1)}`, familyId: family.id, date: `${month}-01`, status: 'Paid' as const, lines, grossMinor: lines.reduce((sum, line) => sum + line.grossMinor, 0), discountMinor: lines.reduce((sum, line) => sum + line.discountMinor, 0), totalMinor: lines.reduce((sum, line) => sum + line.totalMinor, 0), paymentReference: `SIMULATED-${month}-${family.id}` }
  }))
  for (const studentId of ['demo:student-1-1', 'demo:student-6-1', 'demo:student-9-2', 'demo:student-12-1', 'demo:student-13-1', 'demo:student-15-3']) {
    const enrollment = enrollments.find(item => item.studentId === studentId)!
    const original = lessons.find(item => item.sessionId === enrollment.sessionId && item.date.startsWith('2026-10'))!
    data.makeups.push({ id: `demo:makeup-${data.makeups.length + 1}`, studentId, enrollmentId: enrollment.id, originalLessonId: original.id, reason: 'Family absence · more than 24 hours notice', expires: '2027-04-01', status: 'Available' })
  }
  return data
}

/** A credit replaces a paid occurrence. It never creates an invoice line. */
export function bookDemoMakeup(data: OdeonDemo, id: string, date: string, time: string): OdeonDemo {
  const credit = data.makeups.find(item => item.id === id)
  if (!credit || credit.status !== 'Available') throw new Error('This makeup is not available.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || date <= demoToday || date > credit.expires) throw new Error('Choose a future date before the credit expires.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid time.')
  const enrollment = data.enrollments.find(item => item.id === credit.enrollmentId)!, session = data.sessions.find(item => item.id === enrollment.sessionId)!
  const service = demoServices.find(item => item.id === session.serviceId)!, teacher = data.teachers.find(item => item.id === session.teacherId)!
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(), hours = demoHours.find(item => item.day === day), start = demoMinutes(time), end = start + service.minutes
  if (!hours || !teacher.days.includes(day) || start < demoMinutes(hours.from) || end > demoMinutes(hours.to)) throw new Error('Choose a time within school and teacher working hours.')
  const overlaps = (otherTime: string, duration: number) => start < demoMinutes(otherTime) + duration && demoMinutes(otherTime) < end
  const regularConflict = data.sessions.some(other => {
    if (other.day !== day) return false
    const otherService = demoServices.find(item => item.id === other.serviceId)!
    const sameStudent = data.enrollments.some(item => item.sessionId === other.id && item.studentId === credit.studentId)
    return (sameStudent || other.teacherId === teacher.id || other.room === session.room) && overlaps(other.time, otherService.minutes)
  })
  const makeupConflict = data.makeups.some(other => {
    if (!other.booking || other.booking.date !== date) return false
    const otherEnrollment = data.enrollments.find(item => item.id === other.enrollmentId)!, otherSession = data.sessions.find(item => item.id === otherEnrollment.sessionId)!
    return (other.studentId === credit.studentId || otherSession.teacherId === teacher.id || otherSession.room === session.room) && overlaps(other.booking.time, demoServices.find(item => item.id === otherSession.serviceId)!.minutes)
  })
  if (regularConflict || makeupConflict) throw new Error('That time conflicts with a student, teacher or room booking.')
  return { ...data, makeups: data.makeups.map(item => item.id === id ? { ...item, status: 'Booked', booking: { date, time } } : item) }
}