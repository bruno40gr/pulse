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
const model = load(path.join(root, 'beta-source/lib/academy-program-proposals.ts'))
const events = load(path.join(root, 'beta-source/lib/event-explorer.ts'))
const workflow = load(path.join(root, 'beta-source/lib/academy-workflow-drafts.ts'))
const academy = load(path.join(root, 'beta-source/lib/academy-explorer.ts')).academySettings('music')
const plain = value => JSON.parse(JSON.stringify(value))
const plan = () => ({ ...model.newProgramPlan(), name: 'Band proposal', memberIds: ['sophie'], leader: 'teacher', date: '2026-11-16', time: '16:00' })
const blocks = [{ id: 'block', date: '2026-11-16', from: '15:00', to: '18:00' }]
test('a student has independent tasks for multiple proposals and other families cannot respond', () => {
  let tasks = model.requestProgramAvailability([], 'a', 'music', plan())
  tasks = model.requestProgramAvailability(tasks, 'b', 'music', plan())
  assert.equal(tasks.length, 2)
  assert.throws(() => model.submitProgramAvailability(tasks, tasks[0].id, ['ethan'], blocks), /unavailable/)
  tasks = model.submitProgramAvailability(tasks, tasks[0].id, ['sophie'], blocks)
  assert.equal(tasks[0].submitted, true)
  assert.equal(tasks[1].submitted, false)
  assert.equal(model.requestProgramAvailability(tasks, 'a', 'music', plan()).find(task => task.proposalId === 'a').submitted, true)
  assert.equal(model.requestProgramAvailability(tasks, 'a', 'music', { ...plan(), week: '2026-11-23' }).find(task => task.proposalId === 'a').submitted, false)
})
test('calendar validation rejects overlaps, invalid ranges and dates outside the requested week', () => {
  assert.match(model.availabilityError([], '2026-11-16'), /at least/)
  assert.match(model.availabilityError([...blocks, { ...blocks[0], id: 'second' }], '2026-11-16'), /overlap/)
  assert.match(model.availabilityError([{ ...blocks[0], date: '2026-11-30' }], '2026-11-16'), /requested week/)
  assert.equal(model.availabilityError(blocks, '2026-11-16'), '')
})
test('schedule must fit everyone and confirmations are bound to the exact schedule', () => {
  const p = plan()
  let tasks = model.requestProgramAvailability([], 'a', 'music', p)
  tasks = model.submitProgramAvailability(tasks, tasks[0].id, ['sophie'], blocks)
  assert.equal(model.programScheduleError(p, tasks), '')
  tasks[0].schedule = model.scheduleSignature(p)
  tasks = model.confirmProgramSchedule(tasks, tasks[0].id, ['sophie'], p)
  assert.equal(tasks[0].confirmedSchedule, model.scheduleSignature(p))
  assert.throws(() => model.confirmProgramSchedule(tasks, tasks[0].id, ['sophie'], { ...p, time: '17:00' }), /changed/)
  assert.match(model.programScheduleError({ ...p, time: '18:00' }, tasks), /every participant/)
})
test('trial is ordinary one-session discount pricing and program leads do not alter student enrollment', () => {
  const p = { ...plan(), discount: 100 }
  assert.equal(model.programTotal(p), 0)
  assert.throws(() => model.programTotal({ ...p, discount: 101 }), /valid/)
  const people = events.createExplorerState().people
  const before = plain(people)
  let leads = model.syncProgramLeads([], 'a', p)
  assert.equal(leads[0].stage, 'New')
  assert.deepEqual(plain(people), before)
  leads = model.syncProgramLeads(leads, 'b', { ...p, leadProposalId: 'a', mode: 'ongoing' })
  assert.equal(leads.length, 1)
})
test('new students can be created in context, join an existing family and are deduplicated', () => {
  const people = events.createExplorerState().people
  const input = { name: 'New Student', email: 'family@example.invalid', guardian: 'Kim family', accountId: 'kim', instruments: 'Bass, Voice' }
  const person = model.createProgramStudent(people, input)
  assert.equal(person.accountId, 'kim')
  assert.deepEqual(plain(person.instruments), ['Bass', 'Voice'])
  assert.equal(person.enrolled, false)
  assert.ok(person.roles.includes('Student'))
  assert.throws(() => model.createProgramStudent([...people, person], input), /already exists/)
})
test('workflow progress rechecks live task responses and final schedule confirmations', () => {
  const draft = workflow.newWorkflowDraft('program', academy)
  draft.data = plan(); draft.reviewedSteps = [0, 1, 2]; draft.step = 3
  let tasks = model.requestProgramAvailability([], draft.id, 'music', draft.data)
  const context = { academy, people: events.createExplorerState().people, staffIds: ['teacher'], events: [], tasks }
  assert.equal(workflow.workflowProgress(draft, context).current, 1)
  tasks = model.submitProgramAvailability(tasks, tasks[0].id, ['sophie'], blocks)
  tasks[0].schedule = model.scheduleSignature(draft.data)
  tasks = model.confirmProgramSchedule(tasks, tasks[0].id, ['sophie'], draft.data)
  context.tasks = tasks
  assert.equal(workflow.workflowProgress(draft, context).current, 3)
  draft.data.time = '17:00'
  assert.equal(workflow.resumableWorkflowStep(draft, context), 2)
})

const contacts = load(path.join(root, 'beta-source/lib/academy-explorer-contacts.ts'))
test('directory uses explicit family groups, preserves holders and does not merge by email', () => {
  const people = events.createExplorerState().people
  const directory = contacts.explorerContactDirectory(people, ['ethan'])
  const kim = directory.views.families.find(family => family.contactId === 'sam')
  assert.deepEqual(plain(kim.studentIds), ['sophie', 'ethan'])
  assert.deepEqual(plain(directory.views.matchingIds), ['ethan'])
  assert.equal(directory.contacts.filter(person => person.id === 'sam').length, 1)
  assert.equal(directory.contacts.find(person => person.id === 'holder:chen').first_name, 'Lee')
  const unrelated = { ...people[0], id: 'unrelated', accountId: 'separate', family: 'Self' }
  const separate = contacts.explorerContactDirectory([...people, unrelated], people.map(person => person.id))
  assert.ok(separate.views.families.some(family => family.contactId === unrelated.id))
  assert.ok(!separate.views.families.find(family => family.contactId === 'sam').studentIds.includes(unrelated.id))
})
test('lead lifecycle keeps new program leads, won, lost and disenrolled visible independently', () => {
  const inquiries = [...events.explorerInquiries, { ...events.explorerInquiries[0], id: 'band', category: 'Program inquiries', stage: 'New' }, { ...events.explorerInquiries[0], id: 'won', stage: 'Won' }]
  assert.equal(contacts.inquiryStatus(inquiries.find(inquiry => inquiry.id === 'inq-4')), 'won')
  assert.ok(contacts.inquiriesInWorklist(inquiries, 'Lesson requests').some(inquiry => inquiry.id === 'band'))
  assert.ok(contacts.inquiriesInWorklist(inquiries, 'Enrolled').some(inquiry => inquiry.id === 'won'))
  assert.ok(contacts.inquiriesInWorklist(inquiries, 'Disenrolled').some(inquiry => inquiry.personId === 'alex'))
  assert.ok(contacts.inquiriesInWorklist(inquiries, 'Lost').some(inquiry => inquiry.personId === 'leo'))
  assert.ok(!contacts.inquiriesInWorklist(inquiries, 'Lesson requests').some(inquiry => inquiry.stage === 'Enrolled'))
})
