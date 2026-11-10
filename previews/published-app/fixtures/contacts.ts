import { createOdeonDemo } from './odeon-demo'

const seed = createOdeonDemo()
const tenant = '00000000-0000-0000-0000-000000000001'
const name = (value: string) => {
  const [first_name, ...last] = value.split(' ')
  return { first_name, last_name: last.join(' ') }
}

// API records only. No table, toolbar, styles or event handlers are replaced.
export const contacts = seed.families.flatMap((family, index) => {
  const holder = `${family.id}:holder`
  const phone = `202555${String(1000 + index).padStart(4, '0')}`
  const base = {
    tenant_id: tenant, account_id: family.id, phone: null, email: null,
    client_status: 'member', status_class: 'active', opted_out: false,
    last_attended: '2026-11-07', notes: null, family_name: family.name,
    account_holder_person_id: holder, account_holder_name: family.guardian,
    account_holder_phone: phone, account_holder_email: family.email,
    custom_fields: {}, funded: false,
  }
  return [
    { ...base, id: holder, ...name(family.guardian), is_student: false, is_minor: false, phone, email: family.email },
    ...seed.students.filter(student => student.familyId === family.id).map(student => {
      const enrollment = seed.enrollments.find(item => item.studentId === student.id)
      const session = seed.sessions.find(item => item.id === enrollment?.sessionId)
      const teacher = seed.teachers.find(item => item.id === session?.teacherId)
      return {
        ...base, id: student.id, ...name(student.name), student_id: student.id,
        is_student: true, is_minor: true, message_routing: 'account_holder',
        instructor: teacher ? { staff_id: teacher.id, person_id: teacher.id, name: teacher.name, phone: null, email: teacher.email } : null,
      }
    }),
  ]
})