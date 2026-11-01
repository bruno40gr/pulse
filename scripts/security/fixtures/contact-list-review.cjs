/* Fictional UI-review data only. Never imported by production application code. */
const person = (id, first_name, last_name, patch = {}) => ({
  id, tenant_id: 'review', first_name, last_name, phone: null, email: null,
  is_student: false, student_id: null, is_minor: false, client_status: 'active',
  opted_out: false, notes: null, last_attended: null, family_name: null,
  custom_fields: {}, ...patch,
})
const kimHolders = [
  { person_id: 'mock-sam', name: 'Sam Kim', phone: '(202) 555-0102', email: 'sam@example.invalid', is_primary: true },
  { person_id: 'mock-jamie', name: 'Jamie Kim', phone: '(202) 555-0106', email: 'jamie@example.invalid', is_primary: false },
]
const family = (account_id, name, person_id, phone, email, holders) => ({
  account_id, family_name: name, account_holder_person_id: person_id,
  account_holder_name: name, account_holder_phone: phone, account_holder_email: email,
  account_holders: holders,
})
const kim = family('kim', 'Sam Kim', 'mock-sam', '(202) 555-0102', 'sam@example.invalid', kimHolders)
const smith = family('smith', 'Jane Smith', 'mock-jane', '(202) 555-0110', 'jane@example.invalid', [
  { person_id: 'mock-jane', name: 'Jane Smith', phone: '(202) 555-0110', email: 'jane@example.invalid', is_primary: true },
])
const instructor = { staff_id: 'staff-casey', person_id: 'mock-casey', name: 'Casey Rivera', phone: '(202) 555-0130', email: 'casey@example.invalid' }
const jules = { staff_id: 'staff-jules', person_id: 'mock-jules', name: 'Jules Bennett', phone: '(202) 555-0131', email: 'jules@example.invalid' }
const morgan = { staff_id: 'staff-morgan', person_id: 'mock-morgan', name: 'Morgan Reed', phone: '(202) 555-0121', email: 'morgan@example.invalid' }
module.exports = [
  person('mock-sam', 'Sam', 'Kim', { ...kim, phone: kim.account_holder_phone, email: kim.account_holder_email }),
  person('mock-jamie', 'Jamie', 'Kim', { ...kim, instructor: jules, phone: '(202) 555-0106', email: 'jamie@example.invalid', is_student: true, student_id: 'student-jamie', custom_fields: { instrument: 'Piano' } }),
  person('mock-ethan', 'Ethan', 'Kim', { ...kim, instructor, is_student: true, student_id: 'student-ethan', is_minor: true, custom_fields: { instrument: 'Drums' } }),
  person('mock-sophie', 'Sophie', 'Kim', { ...kim, instructor: morgan, is_student: true, student_id: 'student-sophie', is_minor: true, custom_fields: { instrument: 'Guitar' } }),
  person('mock-jane', 'Jane', 'Smith', { ...smith, phone: smith.account_holder_phone, email: smith.account_holder_email }),
  person('mock-emma', 'Emma', 'Smith', { ...smith, instructor: jules, is_student: true, student_id: 'student-emma', is_minor: true, custom_fields: { instrument: 'Violin' } }),
  person('mock-avery', 'Avery', 'Patel', { instructor, phone: '(202) 555-0120', email: 'avery@example.invalid', is_student: true, student_id: 'student-avery', custom_fields: { instrument: 'Voice' } }),
  person('mock-morgan', 'Morgan', 'Reed', { instructor: jules, phone: '(202) 555-0121', email: 'morgan@example.invalid', is_student: true, student_id: 'student-morgan', staff_id: 'staff-morgan', custom_fields: { contact_kind: 'instructor', instrument: 'Guitar' } }),
  person('mock-robin', 'Robin', 'Chen', { instructor: jules, phone: '(202) 555-0122', email: 'robin@example.invalid', is_student: true, student_id: 'student-robin', client_status: 'inactive', custom_fields: { instrument: 'Piano' } }),
  person('mock-drew', 'Drew', 'Brooks', { phone: '(202) 555-0123', email: 'drew@example.invalid', custom_fields: { contact_kind: 'booking' } }),
  person('mock-casey', 'Casey', 'Rivera', { staff_id: 'staff-casey', phone: instructor.phone, email: instructor.email, custom_fields: { contact_kind: 'instructor' } }),
  person('mock-jules', 'Jules', 'Bennett', { staff_id: 'staff-jules', phone: '(202) 555-0131', email: 'jules@example.invalid', custom_fields: { contact_kind: 'instructor' } }),
]