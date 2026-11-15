import type { OdeonDemo, DemoServiceId } from './odeon-demo'

/** Fictional aggregate-scale scenarios, not identities or timetables from exports.
 * Append-only IDs preserve the original tester scenarios. */
export function addDemoDensity(data: Pick<OdeonDemo, 'teachers' | 'families' | 'students' | 'sessions' | 'enrollments'>) {
  const services: { id: DemoServiceId; minutes: number }[] = [
    { id: 'piano', minutes: 30 }, { id: 'guitar', minutes: 30 }, { id: 'voice', minutes: 30 }, { id: 'drums', minutes: 30 }, { id: 'bass', minutes: 30 },
  ]
  const extraTeachers: [string, DemoServiceId[]][] = [
    ['Rowan Bell', ['piano', 'voice']], ['Sage Monroe', ['guitar', 'bass']], ['Arden Wells', ['drums', 'band']], ['Quinn Avery', ['piano', 'tiny']], ['Reese Lane', ['voice', 'rockers']],
  ]
  extraTeachers.forEach(([name, serviceIds], index) => data.teachers.push({ id: `demo:teacher-${index + 11}`, name, email: `sample.staff.${index + 11}@example.invalid`, serviceIds, days: [1, 2, 3, 4, 5, 6] }))
  const names = ['Harper', 'Milo', 'Willow', 'Jasper', 'Hazel', 'Felix', 'Ivy', 'Oscar', 'Juniper', 'Silas', 'Cora', 'Finn', 'Wren', 'August', 'Nora', 'Ellis', 'Mae', 'Remy', 'Ada', 'Luca']
  const surnames = ['Ashford', 'Brookfield', 'Cedar', 'Dunhill', 'Elmwood', 'Fairhaven', 'Glenwood', 'Hawthorn', 'Iverson', 'Kestrel', 'Linden', 'Meadow', 'Northwood', 'Oakley', 'Pemberton', 'Redfern', 'Stonewell', 'Thorne', 'Vale', 'Westbrook']
  const added = [] as OdeonDemo['students']
  for (let index = 0; index < 100; index++) {
    const familyId = `demo:dense-family-${index + 1}`, surname = surnames[index % surnames.length]
    const count = index < 41 ? 2 : 1
    data.families.push({ id: familyId, name: `${surname} ${index + 1} family`, guardian: `Casey ${surname} ${index + 1}`, email: `sample.family.${index + 1}@example.invalid`, scenario: count === 2 ? 'Two siblings, connected tuition and weekly schedules' : 'Weekly student with family billing' })
    for (let child = 0; child < count; child++) {
      const student = { id: `demo:dense-student-${added.length + 1}`, familyId, name: `${names[added.length % names.length]} ${surname} ${index + 1}`, birthday: `${2010 + added.length % 9}-03-12` }
      data.students.push(student); added.push(student)
    }
  }
  const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const duration = (id: DemoServiceId) => id === 'tiny' ? 45 : id === 'band' ? 60 : 30
  const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const dayCycle = [1, 3, 2, 1, 3, 4, 5, 6, 1, 2, 3, 6]
  function book(student: OdeonDemo['students'][number], serviceId: DemoServiceId, index: number, group = false) {
    const length = duration(serviceId)
    const busy = (day: number, start: number, teacherId: string, room: string) => data.sessions.some(session => {
      if (session.day !== day || start >= minute(session.time) + duration(session.serviceId) || minute(session.time) >= start + length) return false
      return session.teacherId === teacherId || session.room === room || data.enrollments.some(enrollment => enrollment.sessionId === session.id && enrollment.studentId === student.id)
    })
    const eligible = data.teachers.filter(teacher => teacher.serviceIds.includes(serviceId))
    const rooms = group ? [serviceId === 'band' ? 'Band room' : 'Keys classroom'] : Array.from({ length: 10 }, (_, i) => `Studio ${i + 1}`)
    for (let attempt = 0; attempt < 6; attempt++) {
      const day = dayCycle[(index + attempt) % dayCycle.length]
      const opening = day === 6 ? 9 * 60 : 15 * 60
      const slots = Math.floor(((day === 6 ? 15 : 21) * 60 - opening - length) / 30) + 1
      for (let slot = 0; slot < slots; slot++) {
        const start = opening + ((index * 5 + slot) % slots) * 30
        for (let offset = 0; offset < eligible.length; offset++) {
          const teacher = eligible[(index + offset) % eligible.length]
          if (!teacher.days.includes(day)) continue
          const room = rooms.find(candidate => !busy(day, start, teacher.id, candidate))
          if (!room) continue
          const session = { id: `demo:dense-session-${data.sessions.length + 1}`, serviceId, teacherId: teacher.id, day, time: clock(start), room, capacity: group ? 8 : 1 }
          data.sessions.push(session)
          data.enrollments.push({ id: `demo:dense-enrollment-${data.enrollments.length + 1}`, studentId: student.id, sessionId: session.id, level: (1 + index % 3) as 1 | 2 | 3 })
          return session
        }
      }
    }
    throw new Error(`Fictional scheduling capacity exhausted for ${serviceId}.`)
  }
  added.forEach((student, index) => book(student, services[index % services.length].id, index))
  // Seventeen extra subscriptions: nine additional instruments and two four-person bands.
  added.slice(0, 9).forEach((student, index) => book(student, services[(index + 1) % services.length].id, index + 5))
  for (let group = 0; group < 2; group++) {
    const members = added.slice(20 + group * 4, 24 + group * 4)
    const session = book(members[0], 'band', 7 + group, true)
    for (const [index, student] of members.slice(1).entries()) {
      const clash = data.enrollments.some(enrollment => enrollment.studentId === student.id && data.sessions.some(other => other.id === enrollment.sessionId && other.day === session.day && minute(other.time) < minute(session.time) + 60 && minute(session.time) < minute(other.time) + duration(other.serviceId)))
      if (clash) throw new Error('Fictional band member has a timetable conflict.')
      data.enrollments.push({ id: `demo:dense-enrollment-${data.enrollments.length + 1}`, studentId: student.id, sessionId: session.id, level: (index + 1) as 1 | 2 | 3 })
    }
  }
}