/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain verification. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file) {
  const exports = {}
  const requireLocal = name => {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: requireLocal, Response, URL, crypto: require('node:crypto').webcrypto })
  return exports
}
const { projectBetaEnrollment, projectBetaBandMembership, betaAccountForStudent } = load(path.join(root, 'beta-source/lib/beta-workflow-projection.ts'))
const { createDemoWorkspace } = load(path.join(root, 'beta-source/lib/odeon-demo-workspace.ts'))
const plain = value => JSON.parse(JSON.stringify(value))

test('band lengths persist in half-hour increments without opening arbitrary private lesson lengths', () => {
  const data = createDemoWorkspace().data
  const band = duration => booking({ lessons: [{ service: 'Group', instrument: 'Band Program', teacher: 'Jordan Vale', time: '14:30', start: '2026-11-02', duration, frequency: 'One-off' }] })
  for (const duration of [30, 60, 90, 120, 180]) {
    const next = projectBetaEnrollment(data, band(duration))
    assert.equal(next.students.find(student => student.id === 'demo:student-8-1').enrollments.at(-1).duration, duration)
  }
  for (const duration of [0, 45, 75, -30, 750]) assert.throws(() => projectBetaEnrollment(data, band(duration)), /length/)
  assert.throws(() => projectBetaEnrollment(data, booking({ lessons: [{ ...band(90).lessons[0], service: 'Private', instrument: 'Piano' }] })), /length/)
})

const booking = (overrides = {}) => ({
  enrollmentId: 'beta:draft-1', studentId: 'demo:student-8-1', payerId: 'demo:family-8:holder',
  paymentMethod: 'Demo Visa ···· 4242', amountMinor: 5000, paid: true,
  lessons: [{ service: 'Private', instrument: 'Piano', teacher: 'Jordan Vale', time: '14:30', start: '2026-11-02', duration: 30, frequency: 'Weekly' }],
  ...overrides,
})

test('a completed booking is recorded on the booked student with its dated lessons', () => {
  const data = createDemoWorkspace().data
  const next = projectBetaEnrollment(data, booking())
  const student = next.students.find(item => item.id === 'demo:student-8-1')
  const enrollment = student.enrollments.find(item => item.id.startsWith('beta:'))
  assert.ok(enrollment)
  assert.equal(enrollment.program, 'Piano')
  assert.equal(enrollment.teacher, 'Jordan Vale')
  assert.equal(enrollment.time, '14:30')
  assert.equal(enrollment.duration, 30)
  assert.equal(enrollment.frequency, 'Weekly')
  assert.equal(enrollment.status, 'active')
  assert.equal(enrollment.payerId, 'demo:family-8:holder')
  assert.equal(enrollment.currency, 'USD')
  const lessons = next.lessons.filter(item => item.enrollmentId === enrollment.id)
  assert.equal(lessons.length, 6)
  assert.equal(lessons[0].date, '2026-11-02')
  assert.equal(lessons[5].date, '2026-12-07')
  assert.ok(lessons.every(item => item.status === 'Scheduled' && item.time === '14:30'))
})

test('a booking for one student never touches a sibling or another family', () => {
  const data = createDemoWorkspace().data
  const next = projectBetaEnrollment(data, booking())
  const sibling = next.students.find(item => item.id === 'demo:student-8-2')
  assert.deepEqual(plain(sibling.enrollments), plain(data.students.find(item => item.id === 'demo:student-8-2').enrollments))
  const others = next.students.filter(item => item.id !== 'demo:student-8-1')
  assert.ok(others.every(item => item.enrollments.every(enrollment => !enrollment.id.startsWith('beta:'))))
  const otherLessons = next.lessons.filter(item => !item.enrollmentId.startsWith('beta:'))
  assert.deepEqual(plain(otherLessons), plain(data.lessons))
})

test('an unpaid confirmed booking stays active with independent payment state', () => {
  const data = createDemoWorkspace().data
  const next = projectBetaEnrollment(data, booking({ paid: false, paymentMethod: 'Add payment later' }))
  const enrollment = next.students.find(item => item.id === 'demo:student-8-1').enrollments.find(item => item.id.startsWith('beta:'))
  assert.equal(enrollment.status, 'active')
  assert.equal(enrollment.initialPaymentStatus, 'unpaid')
  assert.equal(enrollment.paymentMethod, 'Add payment later')
  assert.equal(enrollment.payerId, 'demo:family-8:holder')
})

test('a confirmed band membership is recorded as the student program', () => {
  const data = createDemoWorkspace().data
  const next = projectBetaBandMembership(data, { enrollmentId: 'beta:band-1', studentId: 'demo:student-8-1', payerId: 'demo:family-8:holder', paymentMethod: 'Demo Visa ···· 4242', amountMinor: 3500, paid: true, bandName: 'Beta projection band' })
  const enrollment = next.students.find(item => item.id === 'demo:student-8-1').enrollments.find(item => item.id === 'beta:band-1')
  assert.equal(enrollment.program, 'Beta projection band')
  assert.equal(enrollment.service, 'Band')
  assert.equal(enrollment.status, 'active')
  assert.equal(enrollment.amountMinor, 3500)
  assert.equal(next.lessons.length, data.lessons.length, 'A membership adds no dated lesson')
})

test('invalid or duplicate projections are rejected instead of written', () => {
  const data = createDemoWorkspace().data
  assert.throws(() => projectBetaEnrollment(data, booking({ studentId: 'demo:student-missing' })), /family account/)
  assert.throws(() => projectBetaEnrollment(data, booking({ payerId: 'demo:family-9:holder' })), /payer/)
  assert.throws(() => projectBetaEnrollment(data, booking({ lessons: [{ ...booking().lessons[0], duration: 40 }] })), /lesson length/)
  const next = projectBetaEnrollment(data, booking())
  assert.throws(() => projectBetaEnrollment(next, booking()), /already recorded/)
  const withBand = projectBetaBandMembership(next, { enrollmentId: 'beta:band-1', studentId: 'demo:student-8-1', payerId: 'demo:family-8:holder', paymentMethod: 'Demo Visa ···· 4242', amountMinor: 3500, paid: true, bandName: 'Beta projection band' })
  assert.throws(() => projectBetaBandMembership(withBand, { enrollmentId: 'beta:band-1', studentId: 'demo:student-8-1', payerId: 'demo:family-8:holder', paymentMethod: 'Demo Visa ···· 4242', amountMinor: 3500, paid: true, bandName: 'Beta projection band' }), /already recorded/)
})

test('the family that owns a student comes from the account relationship', () => {
  const data = createDemoWorkspace().data
  assert.equal(betaAccountForStudent(data, 'demo:student-8-1')?.id, 'demo:family-8')
  assert.equal(betaAccountForStudent(data, 'demo:student-missing'), undefined)
})
