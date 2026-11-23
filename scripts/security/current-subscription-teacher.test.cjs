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