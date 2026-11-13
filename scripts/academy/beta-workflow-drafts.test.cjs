/* eslint-disable @typescript-eslint/no-require-imports -- Offline TypeScript/React harness. */
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
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: requireLocal, crypto: require('node:crypto').webcrypto })
  return exports
}
const model = load(path.join(root, 'beta-source/lib/academy-workflow-drafts.ts'))
const academyModel = load(path.join(root, 'beta-source/lib/academy-explorer.ts'))
const eventModel = load(path.join(root, 'beta-source/lib/event-explorer.ts'))
const academy = academyModel.academySettings('music')
const state = eventModel.createExplorerState()
const context = { academy, ...state, staffIds: ['teacher'] }
test('only reviewed, validated sequential steps count and resume rechecks prerequisites', () => {
  const record = model.newWorkflowDraft('group', academy)
  record.data.formation = false
  record.reviewedSteps = [0, 1, 2]
  record.step = 3
  assert.equal(model.workflowProgress(record, context).current, 0)
  record.data = { ...record.data, name: 'Band', leader: 'teacher', schedule: 'Tuesday', dailySchedule: { days: ['Tuesday'], from: '16:00', to: '17:00' } }
  assert.equal(model.workflowProgress(record, context).current, 3)
  assert.equal(model.workflowProgress(record, context).steps.filter(step => step.complete).length, 3)
  record.data.capacity = 0
  assert.equal(model.workflowProgress(record, context).current, 2)
  assert.equal(model.resumableWorkflowStep(record, context), 2)
})
test('membership requires enrolled identities, real capacity and explicit billing limitation', () => {
  const record = model.newWorkflowDraft('membership', academy)
  record.data.memberIds = ['alex']
  assert.match(model.workflowStepError(record, 0, context), /enrolled/)
  record.data.memberIds = ['sophie']
  record.data.groupId = academy.groups[0].id
  assert.equal(model.workflowStepError(record, 1, context), '')
  assert.match(model.workflowStepError(record, 2, context), /prototype roster/)
  record.data.billingReviewed = true
  assert.equal(model.workflowStepError(record, 3, context), '')
  academy.groups[0].capacity = 1
  assert.match(model.workflowStepError(record, 1, context), /capacity/)
  academy.groups[0].capacity = 12
})
test('event steps validate their own fields, and review revalidates everything', () => {
  const record = model.newWorkflowDraft('event', academy)
  assert.match(model.workflowStepError(record, 0, context), /event name/)
  record.data.typeId = 'event-type-1'; record.data.name = 'Workshop'; record.data.start = '2027-01-02'; record.data.end = '2027-01-02'
  assert.equal(model.workflowStepError(record, 0, context), '')
  assert.equal(model.workflowStepError(record, 1, context), '')
  record.data.activities = []
  assert.match(model.workflowStepError(record, 1, context), /activity/)
  record.data.activities = [{ id: 'a', name: 'Session', capacity: 5 }]
  record.data.price = '-1'
  assert.match(model.workflowStepError(record, 2, context), /price/)
  record.data.price = '10'
  assert.equal(model.workflowStepError(record, 3, context), '')
  record.data.name = ''
  assert.match(model.workflowStepError(record, 4, context), /event name/)
})
test('draft serialization retains current step, reviewed steps and shortcut parent', () => {
  const record = model.newWorkflowDraft('event', academy, 'hub', 'parent-booking')
  record.step = 2; record.reviewedSteps = [0, 1]; record.data.name = 'Saved fields'
  const restored = JSON.parse(JSON.stringify(record))
  assert.equal(restored.parentId, 'parent-booking')
  assert.equal(restored.step, 2)
  assert.equal(restored.data.name, 'Saved fields')
  assert.deepEqual(restored.reviewedSteps, [0, 1])
})

test('registration chooses an event before a participant and blocks full activities before intake and review', () => {
  const record = model.newWorkflowDraft('registration', academy)
  assert.deepEqual(Array.from(model.workflowSteps(record)), ['Event', 'Participant', 'Policies & forms', 'Review'])
  assert.equal(model.workflowStepError(record, 0, context), 'Choose an event and session.')
  record.data.eventId = state.events[0].id
  record.data.activityId = 'young'
  assert.equal(model.workflowStepError(record, 0, context), '')
  assert.equal(model.workflowStepError(record, 1, context), 'Choose a participant.')
  const full = { ...context, events: context.events.map(event => ({ ...event, activities: event.activities.map(activity => ({ ...activity, capacity: 1 })) })) }
  assert.equal(model.workflowStepError(record, 0, full), 'This event or session is full. Choose another.')
  record.data.personId = 'alex'
  record.data.agreed = true
  record.data.responses = { 'Emergency contact': 'Alex · 202-555-0100', 'Accessibility or support needs': 'None' }
  assert.equal(model.workflowStepError(record, 3, full), 'This event or session is full. Choose another.')
  assert.equal(model.workflowStepError(record, 3, context), '')
})


test('events retain five steps, bands use formation steps, and school defaults are copied', () => {
  const local = academyModel.academySettings('music')
  local.eventDefaults = { access: 'Members only', hold: '15', allocation: 'All selected sessions must have space', cancellation: 'Use academy default', waiver: 'School agreement', questions: 'Emergency contact', paymentMethods: ['Cash', 'Zelle'] }
  const event = model.newWorkflowDraft('event', local)
  assert.equal(model.workflowSteps(event).length, 5)
  assert.equal(model.workflowSteps(model.newWorkflowDraft('group', local)).length, 2)
  assert.equal(event.data.activities.length, 1)
  assert.equal(event.data.activities[0].capacity, 12)
  assert.equal(event.data.access, 'Members only')
  assert.equal(event.data.waiver, 'School agreement')
  assert.deepEqual(Array.from(event.data.paymentMethods), ['Cash', 'Zelle'])
  event.data.dailySchedule.to = '08:00'
  assert.match(model.workflowStepError(event, 0, context), /end time/)
  const restored = JSON.parse(JSON.stringify(event))
  assert.equal(restored.data.dailySchedule.to, '08:00')
  assert.equal(local.eventDefaults.hold, '15')
})


test('pricing derives session prices and catches missing payment methods before review', () => {
  const record = model.newWorkflowDraft('event', academy)
  record.data.signup = 'Sessions'; record.data.sessionPrice = ''
  record.data.start = '2027-07-12'; record.data.end = '2027-07-16'
  assert.equal(model.workflowStepError(record, 2, context), '')
  record.data.paymentMethods = []
  assert.match(model.workflowStepError(record, 2, context), /payment method/)
  record.data.price = '0'
  assert.equal(model.workflowStepError(record, 2, context), '')
})


test('new events require an explicit type before continuing', () => {
  const record = model.newWorkflowDraft('event', academy)
  assert.equal(record.data.typeId, undefined)
  assert.match(model.workflowStepError(record, 0, context), /event type/)
})

test('legacy group schedule and trials still validate and survive draft restoration', () => {
  const record = model.newWorkflowDraft('group', academy)
  record.data.formation = false
  assert.equal(record.data.trialMax, 0)
  assert.match(model.workflowStepError(record, 1, context), /rehearsal days/)
  record.data.dailySchedule = { days: ['Tuesday'], from: '17:00', to: '16:00' }
  assert.match(model.workflowStepError(record, 1, context), /end time/)
  record.data.dailySchedule.to = '18:00'
  record.data.schedule = 'Tuesday · 17:00–18:00'
  assert.equal(model.workflowStepError(record, 1, context), '')
  record.data.trialMax = 13
  assert.match(model.workflowStepError(record, 2, context), /Trial limit/)
  record.data.trialMax = 0
  assert.equal(model.workflowStepError(record, 2, context), '')
  assert.equal(JSON.parse(JSON.stringify(record)).data.dailySchedule.days[0], 'Tuesday')
  delete record.data.dailySchedule
  record.data.schedule = 'Legacy Thursday rehearsal'
  assert.equal(model.workflowStepError(record, 1, context), '')
})


test('band formation saves empty scaffolds without schedule, capacity, trials or staff', () => {
  const record = model.newWorkflowDraft('group', academy)
  assert.deepEqual(Array.from(model.workflowSteps(record)), ['Band details', 'Review'])
  record.data.name = 'Songwriters'
  record.data.capacity = 0
  assert.equal(model.workflowStepError(record, 0, context), '')
  assert.equal(model.workflowStepError(record, 1, context), '')
  assert.equal(model.workflowStepError(record, 2, context), '')
  const external = { ...state.people[0], id: 'external', name: 'External student', enrolled: false, roles: ['Student'] }
  record.data.memberIds = ['sophie', 'external']
  assert.equal(model.workflowStepError(record, 2, { ...context, people: [...context.people, external] }), '')
  const saved = academyModel.assembleGroup(record.data, [...context.people, external], context.staffIds)
  assert.equal(saved.memberIds.length, 2)
  assert.equal(external.enrolled, false)
  record.data.memberIds.push('unknown')
  assert.ok(model.workflowStepError(record, 2, context))
})


test('single-session registration auto-resolves capacity identity and rejects duplicate students at selection', () => {
  const event = { ...state.events[1], multipleSessions: false, questionChoices: [] }
  const ctx = { ...context, events: [event], registrations: [{ id: 'existing', eventId: event.id, activityId: event.activities[0].id, personId: 'sophie', status: 'Confirmed' }] }
  const record = model.newWorkflowDraft('registration', academy)
  record.data = { ...record.data, eventId: event.id, activityId: '', personId: 'sophie' }
  assert.equal(model.workflowStepError(record, 0, ctx), '')
  assert.match(model.workflowStepError(record, 1, ctx), /already registered/)
  record.data.personId = 'alex'
  assert.equal(model.workflowStepError(record, 1, ctx), '')
})
test('configured policy questions require answers; only staff may override', () => {
  const event = { ...state.events[1], questionChoices: ['Authorized pickup person', 'Participation disclaimer'] }
  const ctx = { ...context, events: [event] }
  const record = model.newWorkflowDraft('registration', academy)
  record.data = { ...record.data, eventId: event.id, personId: 'alex', activityId: event.activities[0].id, agreed: true, responses: { 'Authorized pickup person': 'Jo' }, policyOverrides: ['Participation disclaimer'] }
  assert.equal(model.workflowStepError(record, 2, ctx), '')
  assert.match(model.workflowStepError(record, 2, { ...ctx, registrationAudience: 'family' }), /Participation disclaimer/)
  record.data.responses['Participation disclaimer'] = 'Acknowledged'
  assert.equal(model.workflowStepError(record, 2, { ...ctx, registrationAudience: 'family' }), '')
})


test('event policies validate their own step rather than the generic three-step review', () => {
  const record = model.newWorkflowDraft('event', academy)
  record.data = { ...record.data, typeId: 'event-type-1', name: 'Policy validation', start: '2027-08-02', end: '2027-08-02', hold: '-1' }
  assert.match(model.workflowStepError(record, 3, context), /hold/i)
})
