/* eslint-disable @typescript-eslint/no-require-imports -- Offline fictional fixture tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const file = path.resolve(__dirname, '../../lib/academy-student-preview.ts')
const domain = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: domain, URLSearchParams })

test('preview has sibling, self-paying multiple enrollment and empty scenarios with fresh state', () => {
  const data = domain.createStudentPreview()
  assert.deepEqual(Array.from(data.students, item => item.enrollments.length), [1, 2, 1, 0])
  data.students[0].notes.push({ text: 'local' })
  assert.equal(domain.createStudentPreview().students[0].notes.length, 2)
})
test('every preview subscription has a concrete level from 1 through 3', () => {
  const enrollments = domain.createConnectedPreview().students.flatMap(student => student.enrollments)
  assert.ok(enrollments.every(enrollment => [1, 2, 3].includes(enrollment.level)))
  assert.deepEqual([...new Set(enrollments.map(enrollment => enrollment.level))].sort(), [1, 2, 3])
})
test('enrollment selection requires exact owner and ID, never first-row authority', () => {
  const { students } = domain.createStudentPreview()
  const alex = students.find(item => item.id === 'preview:alex')
  assert.equal(domain.selectedPreviewEnrollment(alex, null), null)
  assert.equal(domain.selectedPreviewEnrollment(alex, 'preview:sophie-piano'), null)
  assert.equal(domain.selectedPreviewEnrollment(alex, 'preview:alex-voice').program, 'Voice')
  alex.enrollments.push({ ...students[0].enrollments[0] })
  assert.equal(domain.selectedPreviewEnrollment(alex, 'preview:sophie-piano'), null)
})
test('selected terms and occurrences are independent for concurrent enrollments', () => {
  const { students, lessons } = domain.createStudentPreview()
  const alex = students.find(item => item.id === 'preview:alex')
  const guitar = domain.selectedPreviewEnrollment(alex, 'preview:alex-guitar')
  const voice = domain.selectedPreviewEnrollment(alex, 'preview:alex-voice')
  assert.equal(guitar.amountMinor, 9000)
  assert.equal(voice.amountMinor, 5000)
  assert.equal(domain.previewEnrollmentLessons(guitar, lessons).length, 2)
  assert.equal(domain.previewEnrollmentLessons(voice, lessons).length, 1)
  assert.equal(domain.previewEnrollmentLessons(null, lessons).length, 0)
  assert.ok(domain.previewEnrollmentLessons(voice, lessons).every(item => item.enrollmentId === voice.id))
})
test('payer resolves per enrollment without assuming every family member can pay', () => {
  const { students } = domain.createStudentPreview()
  const sophie = students[0], alex = students[1]
  assert.equal(domain.previewPayer(sophie, sophie.enrollments[0]).name, 'Sam Kim')
  assert.equal(domain.previewPayer(alex, alex.enrollments[0]).name, 'Alex Morgan')
  assert.equal(domain.previewPayer(alex, sophie.enrollments[0]), null)
  assert.equal(domain.previewPayer(sophie, { ...sophie.enrollments[0], payerId: 'unknown' }), null)
})
test('siblings share guardian but not schedule, notes or communication history', () => {
  const { students } = domain.createStudentPreview()
  const sophie = students[0], ethan = students[2]
  assert.equal(sophie.communicationContactId, ethan.communicationContactId)
  assert.notEqual(sophie.enrollments[0].day, ethan.enrollments[0].day)
  assert.notEqual(sophie.notes[0].id, ethan.notes[0].id)
  assert.notEqual(sophie.messages[0].id, ethan.messages[0].id)
  assert.equal(domain.previewMoney(9000, 'USD'), '$90.00')
})

test('connected scenario has concurrent teachers and occurrence substitution without changing agreement', () => {
  const data = domain.createConnectedPreview()
  const sophie = data.students[0]
  assert.equal(sophie.enrollments.length, 2)
  assert.notEqual(sophie.enrollments[0].teacher, sophie.enrollments[1].teacher)
  const occurrences = domain.workspaceOccurrences(data, { ...domain.workspaceInitial, view: 'staff', studentId: sophie.id })
  assert.equal(occurrences.length, 4)
  const substitute = occurrences.find(item => item.teacher === 'Casey Reed')
  assert.equal(substitute.enrollment.teacher, 'Jordan Vale')
  assert.equal(domain.workspaceOccurrences(data, { ...domain.workspaceInitial, view: 'staff', studentId: sophie.id, teacher: 'Casey Reed' }).length, 1)
})
test('parent projection excludes unrelated adults even with forged student or enrollment filter', () => {
  const data = domain.createConnectedPreview()
  assert.equal(domain.workspaceStudents(data.students, 'parent').length, 2)
  assert.equal(domain.workspaceStudents(data.students, 'parent', 'preview:alex').length, 0)
  assert.equal(domain.workspaceOccurrences(data, { ...domain.workspaceInitial, view: 'parent' }).length, 6)
  assert.equal(domain.workspaceOccurrences(data, { ...domain.workspaceInitial, view: 'parent', enrollmentId: 'preview:alex-guitar' }).length, 0)
})
test('requests validate exact occurrence, reject duplicates and do not mutate lessons or terms', () => {
  const data = domain.createConnectedPreview(), before = JSON.stringify(data)
  const lessonId = data.lessons[0].id
  const requests = domain.addPreviewRequest([], [lessonId], { lessonId, kind: 'Reschedule', reason: '  After school  ' })
  assert.equal(requests[0].reason, 'After school')
  assert.throws(() => domain.addPreviewRequest(requests, [lessonId], { lessonId, kind: 'Cancel', reason: 'Travel' }))
  assert.throws(() => domain.addPreviewRequest([], [lessonId], { lessonId: 'other', kind: 'Cancel', reason: 'Travel' }))
  assert.throws(() => domain.addPreviewRequest([], [lessonId], { lessonId, kind: 'Cancel', reason: '  ' }))
  assert.equal(JSON.stringify(data), before)
})
test('linkable workspace location preserves tenant and selection; unknown presentation fails to contacts', () => {
  const location = { ...domain.workspaceInitial, accountId: 'preview:kim', view: 'staff', studentId: 'preview:sophie', section: 'enrollments', enrollmentSection: 'payment', enrollmentId: 'preview:sophie-voice', calendar: 'week', teacher: 'Robin Ellis', week: 1 }
  const search = domain.workspaceLocationSearch(location, '?tenant=fictional&student=old')
  assert.equal(new URLSearchParams(search).get('tenant'), 'fictional')
  assert.equal(JSON.stringify(domain.workspaceLocationFromSearch(search)), JSON.stringify(location))
  assert.equal(domain.workspaceLocationFromSearch('?view=unknown&section=secret').view, 'contacts')
  assert.equal(domain.workspaceLocationFromSearch('?enrollmentSection=unknown').enrollmentSection, 'details')
  assert.equal(domain.workspaceLocationFromSearch('?section=notes').section, 'notes')
})

test('account payment-method routes discard obsolete student-return context', () => {
  const location = { ...domain.workspaceInitial, view: 'staff', accountId: 'preview:kim', section: 'payment-methods' }
  const search = domain.workspaceLocationSearch(location, '?prototype=v3&paymentReturnStudent=preview:sophie&paymentReturnView=quick')
  const restored = domain.workspaceLocationFromSearch(search)
  assert.equal(restored.section, 'payment-methods')
  assert.equal(restored.studentId, '')
  assert.equal(new URLSearchParams(search).get('prototype'), 'v3')
  assert.equal(new URLSearchParams(search).has('paymentReturnStudent'), false)
  assert.equal(new URLSearchParams(search).has('paymentReturnView'), false)
})
