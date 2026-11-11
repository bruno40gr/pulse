/* eslint-disable @typescript-eslint/no-require-imports -- Test pure TypeScript fixtures without a build. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
function load(file) {
  const filename = path.resolve(__dirname, '../../', file)
  const output = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: output.exports, module: output, require: spec => load(path.relative(path.resolve(__dirname, '../..'), path.resolve(path.dirname(filename), `${spec}.ts`))) })
  return output.exports
}
const domain = load('lib/odeon-demo.ts')
const setupDomain = load('lib/odeon-demo-setup.ts')
const discounts = load('app/content-studio-prototype/school-setup/setup-content.ts')
test('fictional school has stable shared identities and the agreed scale', () => {
  const data = domain.createOdeonDemo(), other = domain.createOdeonDemo()
  assert.equal(JSON.stringify(data), JSON.stringify(other))
  assert.equal(data.teachers.length, 10)
  assert.equal(data.families.length, 15)
  assert.equal(data.students.length, 26)
  assert.equal(data.invoices.length, 30)
  for (const teacher of data.teachers) assert.ok(data.sessions.some(session => session.teacherId === teacher.id))
  for (const service of domain.demoServices.filter(item => item.format === 'private')) {
    assert.equal(new Set(data.enrollments.filter(enrollment => data.sessions.find(session => session.id === enrollment.sessionId).serviceId === service.id).map(item => item.level)).size, 3)
    assert.equal(service.unitMinor, 4000)
    assert.equal(service.minutes, 30)
  }
})
test('all weekly sessions fit hours, capacities, teacher skills and ages without conflicts', () => {
  const data = domain.createOdeonDemo()
  const overlaps = (a, b) => domain.demoMinutes(a.time) < domain.demoMinutes(b.time) + domain.demoServices.find(service => service.id === b.serviceId).minutes && domain.demoMinutes(b.time) < domain.demoMinutes(a.time) + domain.demoServices.find(service => service.id === a.serviceId).minutes
  for (const session of data.sessions) {
    const hours = domain.demoHours.find(item => item.day === session.day), service = domain.demoServices.find(item => item.id === session.serviceId), teacher = data.teachers.find(item => item.id === session.teacherId)
    assert.ok(hours)
    assert.ok(teacher.days.includes(session.day))
    assert.ok(teacher.serviceIds.includes(service.id))
    assert.ok(domain.demoMinutes(session.time) >= domain.demoMinutes(hours.from))
    assert.ok(domain.demoMinutes(session.time) + service.minutes <= domain.demoMinutes(hours.to))
    const roster = data.enrollments.filter(item => item.sessionId === session.id)
    assert.ok(roster.length <= session.capacity)
    for (const enrollment of roster) {
      const student = data.students.find(item => item.id === enrollment.studentId)
      if (service.minAge) for (const date of ['2026-09-01', '2026-10-31']) assert.ok(domain.demoAge(student.birthday, date) >= service.minAge && domain.demoAge(student.birthday, date) <= service.maxAge)
    }
    for (const other of data.sessions.filter(item => item.id !== session.id && item.day === session.day)) {
      const sharedStudent = roster.some(enrollment => data.enrollments.some(item => item.sessionId === other.id && item.studentId === enrollment.studentId))
      if (session.teacherId === other.teacherId || session.room === other.room || sharedStudent) assert.equal(overlaps(session, other), false, `${session.id} / ${other.id}`)
    }
  }
})
test('billing counts actual occurrences, applies best single discount and reconciles', () => {
  const data = domain.createOdeonDemo(), quantities = new Set()
  for (const invoice of data.invoices) {
    assert.ok(invoice.date.endsWith('-01'))
    assert.equal(invoice.status, 'Paid')
    const family = data.families.find(item => item.id === invoice.familyId), discount = domain.demoDiscount(data, family)
    for (const line of invoice.lines) {
      const enrollment = data.enrollments.find(item => item.id === line.enrollmentId), session = data.sessions.find(item => item.id === enrollment.sessionId)
      assert.equal(data.students.find(item => item.id === line.studentId).familyId, invoice.familyId)
      assert.equal(line.quantity, domain.demoDates(session.day, invoice.date.slice(0, 7)).length)
      quantities.add(line.quantity)
      assert.equal(line.discountPercent, discount.percent)
      assert.equal(line.discountMinor, Math.round(line.grossMinor * discount.percent / 100))
      assert.equal(line.totalMinor, line.quantity * line.unitMinor - line.discountMinor)
    }
    assert.equal(invoice.totalMinor, invoice.lines.reduce((sum, line) => sum + line.totalMinor, 0))
    assert.equal(invoice.totalMinor, invoice.grossMinor - invoice.discountMinor)
  }
  assert.ok(quantities.has(4) && quantities.has(5))
  assert.equal(domain.demoDiscount(data, data.families[12]).percent, 50)
  assert.equal(domain.demoDiscount(data, data.families[7]).percent, 10)
  assert.equal(domain.demoDiscount(data, data.families[0]).percent, 0)
})
test('makeups reference paid original lessons, book without rebilling and reject conflicts', () => {
  const data = domain.createOdeonDemo(), invoices = JSON.stringify(data.invoices)
  assert.equal(data.makeups.length, 6)
  for (const credit of data.makeups) {
    const enrollment = data.enrollments.find(item => item.id === credit.enrollmentId), original = data.lessons.find(item => item.id === credit.originalLessonId)
    assert.equal(original.sessionId, enrollment.sessionId)
    assert.equal(credit.studentId, enrollment.studentId)
    assert.ok(data.invoices.some(invoice => invoice.lines.some(line => line.enrollmentId === enrollment.id && line.dates.includes(original.date))))
  }
  const credit = data.makeups[0]
  const booked = domain.bookDemoMakeup(data, credit.id, '2026-11-16', '12:00')
  assert.equal(booked.makeups[0].status, 'Booked')
  assert.equal(data.makeups[0].status, 'Available')
  assert.equal(JSON.stringify(booked.invoices), invoices)
  assert.throws(() => domain.bookDemoMakeup(booked, credit.id, '2026-11-17', '12:00'))
  for (const [date, time] of [['2026-11-15', '12:00'], ['2026-11-16', '11:30'], ['2026-11-16', '20:45'], ['2026-10-01', '12:00'], ['2027-04-02', '12:00'], ['2026-11-31', '12:00']]) assert.throws(() => domain.bookDemoMakeup(data, credit.id, date, time))
  const enrollment = data.enrollments.find(item => item.id === credit.enrollmentId), session = data.sessions.find(item => item.id === enrollment.sessionId)
  assert.throws(() => domain.bookDemoMakeup(data, credit.id, '2026-11-16', session.time))
})
test('onboarding matches shared teachers, services, prices and discount rules', () => {
  const setup = setupDomain.createDemoSetup(), data = domain.createOdeonDemo()
  assert.equal(setup.teachers.length, data.teachers.length)
  assert.equal(setup.services.length, domain.demoServices.length)
  for (const teacher of data.teachers) assert.equal(setup.teachers.find(item => item.id === teacher.id).values.name, teacher.name)
  assert.equal(setup.plans[0].values.price, '40')
  assert.equal(setup.plans[1].values.price, '35')
  const staff = discounts.createDiscounts('configured').find(item => item.id === 'staff-discount')
  assert.equal(discounts.validateDiscount(staff), null)
  assert.equal(discounts.evaluateDiscount(staff, { staffMember: 'Yes' }), 'eligible')
  assert.equal(discounts.evaluateDiscount(staff, { staffMember: 'No' }), 'not-eligible')
  assert.equal(discounts.evaluateDiscount(staff, {}), 'missing-data')
})
test('beta sandbox routes require the existing account-administrator gate', () => {
  const middleware = fs.readFileSync(path.resolve(__dirname, '../../middleware.ts'), 'utf8')
  assert.match(middleware, /const isBetaPath/)
  assert.match(middleware, /if \(isBetaPath \|\|/)
  assert.match(middleware, /await requireAccountAdministrator\(request, tenantId\)/)
  assert.match(middleware, /Pulse access required/)
})
test('app adapter supplies real workspaces with all families, billing and original makeup lessons', () => {
  const { data, makeups } = load('lib/odeon-demo-workspace.ts').createDemoWorkspace()
  const { parentPortalProjection } = load('lib/academy-parent-portal.ts')
  const { expandPreviewCalendar, makeupSlots, bookPreviewMakeup } = load('lib/academy-makeup-preview.ts')
  assert.equal(data.students.length, 26)
  assert.equal(data.accounts.length, 15)
  assert.equal(data.invoices.length, 30)
  assert.equal(makeups.items.length, 6)
  for (const invoice of data.invoices) {
    const source = domain.createOdeonDemo().invoices.find(item => item.id === invoice.id)
    assert.equal(invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0), source.totalMinor)
  }
  for (const account of data.accounts) {
    const visible = parentPortalProjection(data, account)
    assert.equal(visible.students.length, account.studentIds.length)
    assert.ok(visible.students.every(student => account.studentIds.includes(student.id)))
    assert.ok(visible.invoices.every(invoice => invoice.accountId === account.id))
    assert.ok(visible.students.every(student => student.notes.every(note => note.audience === 'family')))
  }
  for (const credit of makeups.items) assert.ok(data.lessons.some(lesson => lesson.id === credit.lessonId && lesson.status === 'Absent'))
  const expanded = expandPreviewCalendar(data, '2027-02-03'), credit = makeups.items[0]
  const slots = makeupSlots(expanded, makeups, credit, '2026-11-16', credit.program, true)
  assert.ok(slots.length)
  assert.ok(slots.every(slot => slot.teacher === credit.teacher && slot.time >= '12:00'))
  const booked = bookPreviewMakeup(expanded, makeups, data.accounts[0].id, credit.id, slots[0])
  assert.ok(booked.items[0].booking)
  assert.equal(makeupSlots(expanded, makeups, credit, '2026-11-15', credit.program, true).length, 0)
})
test('public preview composes the existing app UI instead of replacement cards', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../app/odeon-demo/DemoWorkspace.tsx'), 'utf8')
  for (const component of ['DashboardLayout', 'ContactsPage', 'StaffPage', 'StaffSlidePanel', 'StudentWorkspaceV3', 'SchoolSetup']) assert.ok(source.includes(`<${component}`))
  assert.doesNotMatch(source, /DenseSectionPanel|demo\.module\.css|Explore your sample school/)
})