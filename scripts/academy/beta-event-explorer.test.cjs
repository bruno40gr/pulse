/* eslint-disable @typescript-eslint/no-require-imports -- Existing local TypeScript test pattern. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const file = path.resolve(__dirname, '../../beta-source/lib/event-explorer.ts')
const output = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, output)
const model = output.exports

test('working views overlap students, booking contacts and participants without duplicate identities', () => {
  const state = model.createExplorerState()
  assert.equal(model.peopleInView(state.people, state.registrations, 'students').length, 3)
  assert.equal(model.peopleInView(state.people, state.registrations, 'customers').length, 6)
  assert.equal(model.peopleInView(state.people, state.registrations, 'participants').length, 3)
  assert.equal(new Set(state.people.map(person => person.id)).size, state.people.length)
  assert.equal(model.peopleInView(state.people, state.registrations, 'students', 'recording').length, 0)
})
test('new registration does not enroll an event participant as a student', () => {
  const state = model.createExplorerState()
  const registrations = model.registerExplorerPerson(state.events[0], state.registrations, 'alex', 'young')
  assert.equal(registrations.at(-1).status, 'Awaiting payment')
  assert.equal(model.peopleInView(state.people, registrations, 'students').length, 3)
  assert.equal(model.peopleInView(state.people, registrations, 'participants').length, 4)
  assert.equal(state.registrations.length, 3)
})
test('approval and payment reserve spaces but waitlisted and cancelled records do not', () => {
  const state = model.createExplorerState(), event = state.events[0]
  assert.equal(model.activitySpace(event, 'young', state.registrations), 11)
  assert.equal(model.activitySpace(event, 'band', state.registrations), 7)
  event.activities[0].capacity = 1
  assert.equal(model.registerExplorerPerson(event, state.registrations, 'alex', 'young').at(-1).status, 'Waitlisted')
  const cancelled = state.registrations.map(item => ({ ...item, status: 'Cancelled' }))
  assert.equal(model.activitySpace(event, 'young', cancelled), 1)
})
test('free registration confirms while approval takes precedence over free or paid collection', () => {
  const state = model.createExplorerState(), event = { ...state.events[0], payment: 'Free' }
  assert.equal(model.registerExplorerPerson(event, [], 'alex', 'young').at(-1).status, 'Confirmed')
  assert.equal(model.registerExplorerPerson({ ...event, approval: true }, [], 'alex', 'young').at(-1).status, 'Awaiting approval')
})
test('duplicate registrations and missing activities are rejected', () => {
  const state = model.createExplorerState()
  assert.throws(() => model.registerExplorerPerson(state.events[0], state.registrations, 'sophie', 'young'), /already/)
  assert.throws(() => model.registerExplorerPerson(state.events[0], [], 'alex', 'missing'), /Choose an activity/)
})
test('publication validation checks dates, activities, capacity, holds and deposit', () => {
  assert.ok(model.eventErrors(model.newExplorerEvent('new')).length >= 3)
  const event = model.createExplorerState().events[0]
  assert.equal(model.eventErrors(event).length, 0)
  assert.ok(model.eventErrors({ ...event, end: '2020-01-01' }).some(error => error.includes('date')))
  assert.ok(model.eventErrors({ ...event, hold: '-1' }).some(error => error.includes('hold')))
  assert.ok(model.eventErrors({ ...event, activities: [{ ...event.activities[0], capacity: 1.5 }] }).some(error => error.includes('capacity')))
  assert.ok(model.eventErrors({ ...event, payment: 'Deposit', deposit: '999' }).some(error => error.includes('Deposit')))
})
test('existing lead tab labels and inquiry history remain separate from enrollment membership', () => {
  const state = model.createExplorerState()
  const sophie = state.people.find(person => person.id === 'sophie')
  assert.ok(sophie.enrolled)
  assert.ok(model.explorerInquiries.some(item => item.personId === sophie.id && item.stage === 'Contacted'))
  assert.ok(model.explorerInquiries.some(item => item.personId === sophie.id && item.category === 'Enrolled'))
})
test('Leads is a deduplicated contact view with overlapping student and customer membership', () => {
  const state = model.createExplorerState()
  const inquiries = [...model.explorerInquiries, { ...model.explorerInquiries[0], id: 'second-camp-request' }]
  const leads = model.peopleInView(state.people, state.registrations, 'leads', '', inquiries)
  assert.equal(leads.filter(person => person.id === 'sophie').length, 1)
  assert.ok(leads.some(person => person.id === 'sophie' && person.enrolled))
  assert.ok(leads.some(person => person.id === 'mia' && person.customer))
  assert.ok(!leads.some(person => person.id === 'ethan'))
  assert.equal(model.peopleInView(state.people, state.registrations, 'leads', 'mia', inquiries).length, 1)
})
test('closing inquiries changes lead membership, not contact identity or enrollment', () => {
  const state = model.createExplorerState()
  const closed = model.explorerInquiries.map(inquiry => inquiry.personId === 'sophie' ? { ...inquiry, stage: 'Lost' } : inquiry)
  assert.ok(!model.peopleInView(state.people, state.registrations, 'leads', '', closed).some(person => person.id === 'sophie'))
  assert.ok(model.peopleInView(state.people, state.registrations, 'all', '', closed).some(person => person.id === 'sophie'))
  assert.ok(model.peopleInView(state.people, state.registrations, 'students', '', closed).some(person => person.id === 'sophie'))
  assert.equal(model.inquiriesForView(closed, 'Lost').filter(inquiry => inquiry.personId === 'sophie').length, 2)
  assert.equal(model.inquiriesForView(model.explorerInquiries, 'Enrolled').length, 1)
  assert.equal(model.inquiriesForView(model.explorerInquiries, 'Active inquiries').length, 3)
  assert.equal(model.inquiriesForView(model.explorerInquiries, 'Service inquiries').length, 1)
  assert.equal(model.inquiriesForView(model.explorerInquiries, 'All inquiries').length, 6)
})

test('contact relationships overlap and Clients includes students and event participants', () => {
  const state = model.createExplorerState()
  const sophie = state.people.find(person => person.id === 'sophie')
  assert.deepEqual(Array.from(model.contactRelationships(sophie, state.registrations, model.explorerInquiries)), ['Lead', 'Student', 'Client', 'Event participant'])
  const parent = state.people.find(person => person.id === 'sam')
  assert.deepEqual(Array.from(model.contactRelationships(parent, state.registrations, model.explorerInquiries)), [])
  const student = { ...parent, id: 'student-only', enrolled: true }
  assert.equal(model.peopleInView([student], [], 'customers', '', []).length, 1)
  assert.equal(model.peopleInView(state.people, state.registrations, 'customers').some(person => person.id === 'leo'), true)
  assert.equal(sophie.source, undefined, 'current relationships must not fabricate acquisition source')
})
test('closed inquiries and cancelled registrations do not create current relationships', () => {
  const person = { ...model.explorerPeople[0], enrolled: false, roles: [], customer: false }
  const inquiries = [{ ...model.explorerInquiries[0], stage: 'Lost' }]
  const registrations = [{ id: 'cancelled', personId: person.id, status: 'Cancelled' }]
  assert.deepEqual(Array.from(model.contactRelationships(person, registrations, inquiries)), [])
  assert.equal(model.peopleInView([person], registrations, 'leads', '', inquiries).length, 0)
  assert.equal(model.peopleInView([person], registrations, 'customers', '', inquiries).length, 0)
})

 test('client types overlap without making service-only clients students', () => {
  const person = { ...model.explorerPeople.find(person => person.id === 'alex'), clientTypes: ['Studio recording', 'Birthday party'] }
  assert.deepEqual(Array.from(model.clientTypesForPerson(person, [])), ['Studio recording', 'Birthday party'])
  assert.equal(model.isExplorerStudent(person), false)
  assert.equal(model.isExplorerStudent({ ...person, clientTypes: ['Lessons', 'Studio recording'] }), true)
  assert.equal(model.isExplorerStudent(model.explorerPeople.find(person => person.id === 'mia')), true)
})

test('payment uses derived session totals and ignores stale saved amounts', () => {
  const event = model.createExplorerState().events[0]
  event.sessionPrice = '999'; event.payment = 'Deposit'; event.deposit = '50'
  assert.equal(model.eventSessionPrice(event), '50.00')
  assert.equal(model.eventErrors(event).length, 0)
  event.deposit = '51'
  assert.ok(model.eventErrors(event).some(error => error.includes('Deposit')))
  event.signup = 'Whole event'
  assert.equal(model.eventErrors(event).length, 0)
  event.price = '0'; event.deposit = '-1'; event.paymentMethods = []
  assert.equal(model.eventErrors(event).length, 0)
  assert.equal(model.eventIsPaid(event), false)
  assert.equal(model.registerExplorerPerson(event, [], 'alex', 'young')[0].status, 'Confirmed')
  event.approval = true
  assert.equal(model.registerExplorerPerson(event, [], 'alex', 'young')[0].status, 'Awaiting approval')
  assert.match(model.eventPaymentTiming(event), /no payment is due/)
})

test('offered dates count selected weekdays over the inclusive event period', () => {
  const event = model.createExplorerState().events[0]
  event.dailySchedule = { days: ['Monday', 'Wednesday', 'Friday'], from: '09:00', to: '12:00' }
  assert.equal(model.eventOfferedDays(event), 3)
  assert.equal(model.eventSessionPrice(event), '83.33')
  event.end = '2027-07-23'
  assert.equal(model.eventOfferedDays(event), 6)
  event.price = '300'
  assert.equal(model.eventSessionPrice(event), '50.00')
  event.start = '2027-07-17'; event.end = '2027-07-18'
  assert.equal(model.eventOfferedDays(event), 0)
  assert.equal(model.eventSessionPrice(event), '')
  assert.ok(model.eventErrors(event).some(error => error.includes('session price')))
  event.start = '2028-02-28'; event.end = '2028-03-01'
  delete event.dailySchedule
  assert.equal(model.eventOfferedDays(event), 3)
  event.start = '2027-03-12'; event.end = '2027-03-16'
  assert.equal(model.eventOfferedDays(event), 5)
  event.end = event.start
  assert.equal(model.eventOfferedDays(event), 1)
  event.end = ''
  assert.equal(model.eventOfferedDays(event), 0)
})

test('age bounds round-trip ranges, one-sided limits and unrestricted ages', () => {
  for (const [minimum, maximum, expected] of [['6', '12', '6–12'], ['18', '', '18+'], ['', '12', 'Up to 12'], ['', '', '']]) {
    assert.equal(model.eventAges(minimum, maximum), expected)
    const bounds = model.eventAgeBounds(expected)
    assert.equal(bounds.minimum, minimum); assert.equal(bounds.maximum, maximum)
  }
  assert.equal(model.eventAgeBounds('6-12').maximum, '12')
  assert.equal(model.eventAgeBounds('All ages').minimum, '')
  const event = model.createExplorerState().events[0]
  event.activities[0].ages = '12–6'
  assert.ok(model.eventErrors(event).some(error => error.includes('Minimum age')))
})

test('approval precedes payment requests and payment confirmation comes from school configuration', () => {
  const event = model.createExplorerState().events[0]
  event.approval = true
  assert.match(model.eventPaymentTiming(event), /only after staff approval/)
  assert.equal(model.registerExplorerPerson(event, [], 'alex', 'young')[0].status, 'Awaiting approval')
  assert.equal(model.eventPaymentHandling(event, 'Cash'), 'manual')
  assert.equal(model.eventPaymentHandling(event, 'Zelle'), 'manual')
  assert.equal(model.eventPaymentHandling(event, 'Card'), 'online')
  event.paymentHandling = { Card: 'manual' }
  assert.equal(model.eventPaymentHandling(event, 'Card'), 'manual')
  event.paymentMethods = []
  assert.ok(model.eventErrors(event).some(error => error.includes('payment method')))
})


test('one-day scheduling synchronizes dates, weekdays and derived price', () => {
  const event = model.createExplorerState().events[0]
  assert.equal(model.eventTypeScheduleMode('Performance'), 'single')
  assert.equal(model.eventTypeScheduleMode('Workshop'), 'single')
  assert.equal(model.eventTypeScheduleMode('Camp'), 'multiple')
  const single = model.updateEventSchedule(event, { scheduleMode: 'single', start: '2027-07-18', dailySchedule: { days: ['Monday'], from: '17:00', to: '19:00' } })
  assert.equal(single.end, '2027-07-18')
  assert.equal(single.dailySchedule.days[0], 'Sunday')
  assert.equal(single.schedule, 'Sunday · 17:00–19:00')
  assert.equal(model.eventSessionPrice(single), '250.00')
  assert.equal(model.eventErrors(single).length, 0)
  const moved = model.updateEventSchedule(single, { start: '2027-07-19' })
  assert.equal(moved.end, moved.start)
  assert.equal(moved.dailySchedule.days[0], 'Monday')
  assert.equal(event.end, '2027-07-16')
  assert.equal(model.eventScheduleMode(event), 'multiple', 'legacy multi-day events are not truncated on resume')
})
