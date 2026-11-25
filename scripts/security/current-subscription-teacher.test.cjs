/* eslint-disable @typescript-eslint/no-require-imports -- Offline teacher assignment regression. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const { currentSubscriptionTeacher } = createHarness().load('lib/current-subscription-teacher.ts')

test('former staff never resolve as current teachers; missing records do not fall back to historical names', () => {
  for (const staff_status of ['sunset', ' Sunset ', 'inactive', 'ended', 'archived']) {
    assert.equal(currentSubscriptionTeacher({ first_name: 'Former', custom_fields: { staff_status } }), null)
  }
  assert.equal(currentSubscriptionTeacher(null), null)
  assert.equal(currentSubscriptionTeacher({ first_name: 'Current', last_name: 'Teacher' }), 'Current Teacher')
})

test('Contacts preserves every current enrollment teacher and rejects sunset fallback', async () => {
  const h = createHarness()
  const enrollment = (id, teacher) => ({ id, instrument: 'Piano', instructor_person_id: teacher, custom_fields: { instructor: 'Historical Name' } })
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [
      { id: 'student', tenant_id: HEAD, students: [{ id: 'student-role', enrollments: [enrollment('one', 'first'), enrollment('two', 'second'), enrollment('old', 'former')] }] },
      { id: 'first', tenant_id: HEAD, first_name: 'First', last_name: 'Teacher' },
      { id: 'second', tenant_id: HEAD, first_name: 'Second', last_name: 'Teacher' },
      { id: 'former', tenant_id: HEAD, first_name: 'Former', custom_fields: { staff_status: 'sunset' } },
    ],
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  const student = (await response.json()).find(row => row.id === 'student')
  assert.deepEqual(student.profile_enrollments.map(row => row.instructor), ['First Teacher', 'Second Teacher', null])
  assert.equal(student.profile_enrollments[2].teacher_assignment_needs_review, true)
  assert.equal(h.getWrites().length, 0)
})

test('Contacts summary uses the replacement teacher when ended former-teacher history comes first', async () => {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [
      { id: 'student', tenant_id: HEAD, students: [{ id: 'student-role', enrollments: [
        { id: 'historical', status: 'active', instrument: 'Piano', instructor_person_id: 'former', custom_fields: { status: 'ended', instructor: 'Former Teacher' } },
        { id: 'replacement', status: 'active', instrument: 'Piano', instructor_person_id: 'current', custom_fields: { status: 'active', level: 2, duration: 30 } },
      ] }] },
      { id: 'former', tenant_id: HEAD, first_name: 'Former', last_name: 'Teacher', custom_fields: { staff_status: 'sunset' } },
      { id: 'current', tenant_id: HEAD, first_name: 'Replacement', last_name: 'Teacher' },
    ],
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  const student = (await response.json()).find(row => row.id === 'student')
  assert.equal(student.instructor.name, 'Replacement Teacher')
  assert.equal(student.instructor.person_id, 'current')
  assert.equal(student.custom_fields.instructor, 'Replacement Teacher')
  assert.deepEqual(student.profile_enrollments.map(row => row.id), ['replacement'])
  assert.equal(h.getWrites().length, 0)
})

test('Contacts carries explicit subscription duration and level without requiring plan wording', async () => {
  const h = createHarness()
  const { lessonSummary } = h.load('lib/lesson-summary.ts')
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [{id:'student',tenant_id:HEAD,students:[{id:'student-role',enrollments:[
      {id:'known',instrument:'Voice',service_type:'private',plan_name:'Monthly',custom_fields:{status:'active',duration:45,level:2}},
      {id:'unknown',instrument:'Piano',custom_fields:{status:'pending',duration:30}},
      {id:'ended',custom_fields:{status:'ended',duration:60}},
    ]}]}],
  } })
  const response=await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  const [student]=await response.json()
  assert.deepEqual(student.profile_enrollments.map(row=>row.id),['known','unknown'])
  const [known,unknown]=student.profile_enrollments
  assert.equal(lessonSummary({part:'identity',instrument:known.instrument,level:known.level}),'Voice • Level 2')
  assert.equal(lessonSummary({part:'details',format:known.service_type,duration:known.duration,plan:known.plan_name}),'Private • 45 min')
  assert.equal(unknown.level,null)
  assert.equal(lessonSummary({part:'identity',instrument:unknown.instrument,level:unknown.level}),'Piano')
  assert.equal(h.getWrites().length,0)
})