/* eslint-disable @typescript-eslint/no-require-imports -- Offline TypeScript VM harness. */
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

const { createPortalQueue: createBetaPortalQueue, familyQueue, withQueueAccounts } = load(path.join(root, 'beta-source/lib/academy-portal-queue.ts'))
const { createDemoWorkspace } = load(path.join(root, 'beta-source/lib/odeon-demo-workspace.ts'))
// Legacy lifecycle scenarios explicitly inject their tiny fixtures; runtime uses Beta.
function createPortalQueue() {
  const queue = createBetaPortalQueue()
  queue.state = load(path.join(root, 'beta-source/lib/event-explorer.ts')).createExplorerState()
  queue.academy = load(path.join(root, 'beta-source/lib/academy-explorer.ts')).academySettings('music')
  return queue
}
test('runtime queue reuses Beta identities and seeds no prototype contacts or memberships', () => {
  const data = createDemoWorkspace().data
  const queue = createBetaPortalQueue(data)
  const allowed = new Set([...data.accounts.map(account => account.holderId), ...data.students.map(student => student.id)])
  assert.ok(queue.state.people.length > 10)
  assert.ok(queue.state.people.every(person => allowed.has(person.id)))
  assert.ok(!queue.state.people.some(person => ['sophie', 'ethan', 'mia', 'leo', 'alex', 'jules'].includes(person.id)))
  assert.equal(queue.state.registrations.length, 0)
  assert.ok(queue.academy.groups.length > 0)
  assert.ok(queue.academy.groups.every(group => group.memberIds.every(id => allowed.has(id))))
  assert.equal(queue.inquiries.length, 0)
})

test('queue scopes by explicit account and student IDs, never name or email', () => {
  const queue = createPortalQueue()
  queue.state.people = [
    { id: 'holder-a', accountId: 'a', name: 'Same Name', email: 'same@example.test', family: 'Family A', roles: ['Account holder'] },
    { id: 'student-a', accountId: 'a', name: 'Child A', email: '', family: 'Family A', roles: ['Student'] },
    { id: 'student-b', accountId: 'b', name: 'Same Name', email: 'same@example.test', family: 'Family B', roles: ['Student'] },
  ]
  queue.inquiries = [{ id: 'ia', personId: 'student-a', stage: 'New' }, { id: 'ib', personId: 'student-b', stage: 'New' }, { id: 'done', personId: 'student-a', stage: 'Enrolled' }]
  queue.requests = [{ id: 'ra', studentId: 'student-a', accountId: 'a' }, { id: 'bad', studentId: 'student-b', accountId: 'a' }, { id: 'done', studentId: 'student-a', accountId: 'a', completedAt: '2026-11-13' }]
  queue.tasks = [{ id: 'ta', studentId: 'student-a' }, { id: 'tb', studentId: 'student-b' }]
  const visible = familyQueue(queue, 'a')
  assert.equal(visible.inquiries.map(item => item.id).join(','), 'ia')
  assert.equal(visible.requests.map(item => item.id).join(','), 'ra')
  assert.equal(visible.tasks.map(item => item.id).join(','), 'ta')
  assert.equal(familyQueue(queue, 'unknown').people.length, 0)
  const data = withQueueAccounts(createDemoWorkspace().data, queue)
  assert.equal(data.accounts.find(item => item.id === 'a').holderId, 'holder-a')
  assert.equal(data.accounts.find(item => item.id === 'a').studentIds.join(','), 'student-a')
  assert.equal(withQueueAccounts(data, queue).accounts.length, data.accounts.length)
})

const { createPortalStore } = load(path.join(root, 'beta-source/lib/academy-portal-store.ts'))
const { readPortalQueue } = load(path.join(root, 'beta-source/lib/academy-portal-queue.ts'))
const actions = load(path.join(root, 'beta-source/lib/academy-portal-actions.ts'))
function lessonQueue() {
  const queue = createPortalQueue()
  queue.inquiries = [{ id: 'lesson', personId: 'sophie', accountId: 'kim', interest: 'Private · Guitar', category: 'Lesson requests', stage: 'Contacted' }]
  return queue
}
test('lesson send is explicit, idempotent and rejects unsupported flows', () => {
  const queue = lessonQueue()
  assert.throws(() => actions.openFamilyLesson(queue, 'kim', 'lesson'), /unavailable/)
  const sent = actions.sendLessonEnrollment(queue, 'lesson')
  assert.ok(sent.inquiries[0].enrollmentSentAt)
  assert.equal(actions.sendLessonEnrollment(sent, 'lesson'), sent)
  assert.throws(() => actions.openFamilyLesson(sent, 'other', 'lesson'), /unavailable/)
  assert.throws(() => actions.sendLessonEnrollment({ ...queue, inquiries: [{ ...queue.inquiries[0], serviceType: 'band' }] }, 'lesson'), /does not support/)
})
test('lesson continuation reuses one draft and rejects changed source or foreign family', () => {
  const sent = actions.sendLessonEnrollment(lessonQueue(), 'lesson')
  const opened = actions.openFamilyLesson(sent, 'kim', 'lesson')
  const again = actions.openFamilyLesson(opened.queue, 'kim', 'lesson')
  assert.equal(again.record.id, opened.record.id)
  assert.equal(again.queue, opened.queue)
  assert.equal(opened.record.draft.additionalStudents.length, 0)
  assert.throws(() => actions.saveFamilyLesson(opened.queue, 'other', opened.record), /unavailable/)
  assert.throws(() => actions.saveFamilyLesson(opened.queue, 'kim', { ...opened.record, sourceLeadId: 'changed' }), /unavailable/)
  const foreign = { ...opened.record, draft: { ...opened.record.draft, manager: { ...opened.record.draft.manager, id: 'foreign' } } }
  assert.throws(() => actions.saveFamilyLesson(opened.queue, 'kim', foreign), /does not match/)
  const saved = actions.saveFamilyLesson(opened.queue, 'kim', opened.record)
  assert.equal(saved.drafts.length, 1)
  assert.throws(() => actions.saveFamilyLesson({ ...saved, drafts: saved.drafts.map(item => ({ ...item, data: { ...item.data, updatedAt: 'changed' } })) }, 'kim', opened.record), /changed/)
  const closed = { ...saved, inquiries: [{ ...saved.inquiries[0], stage: 'Lost' }] }
  assert.throws(() => actions.saveFamilyLesson(closed, 'kim', opened.record), /unavailable/)
})
function bandQueue() {
  const queue = createPortalQueue()
  queue.academy.groups[0] = { ...queue.academy.groups[0], memberIds: [], pendingMemberIds: ['sophie', 'ethan'] }
  queue.requests = [{ id: 'request', accountId: 'kim', studentId: 'sophie', bandId: queue.academy.groups[0].id, bandName: 'Band', recipientName: 'Sam Kim', recipientEmail: 'sam@example.test', monthlyPrice: '40.00', policies: [], sentAt: '2026-11-13' }]
  return queue
}
test('Band commits are atomic, family-scoped and cannot replay completion', () => {
  const opened = actions.openFamilyBand(bandQueue(), 'kim', 'request')
  assert.throws(() => actions.openFamilyBand(opened.queue, 'other', 'request'), /unavailable/)
  assert.equal(actions.openFamilyBand(opened.queue, 'kim', 'request').draft.id, opened.draft.id)
  const draft = { ...opened.draft, instrument: 'Guitar', policyAccepted: true, subscriptionAccepted: true, paymentMethod: 'demo_card' }
  const complete = actions.saveFamilyBand(opened.queue, 'kim', draft, true)
  assert.ok(complete.requests[0].completedAt)
  assert.ok(complete.academy.groups[0].memberIds.includes('sophie'))
  assert.ok(!complete.academy.groups[0].memberIds.includes('ethan'))
  assert.ok(!opened.queue.requests[0].completedAt, 'Original snapshot is immutable')
  assert.throws(() => actions.saveFamilyBand(complete, 'kim', draft, true), /unavailable/)
  assert.throws(() => actions.saveFamilyBand(opened.queue, 'kim', { ...draft, monthlyPrice: '1.00' }, true), /does not match/)
  assert.throws(() => actions.saveFamilyBand(opened.queue, 'kim', { ...draft, pricing: { recurring: false } }, true), /does not match/)
})
test('Band completion rechecks paid coverage and placement against current state', () => {
  const opened = actions.openFamilyBand(bandQueue(), 'kim', 'request')
  const draft = { ...opened.draft, instrument: 'Guitar', policyAccepted: true, subscriptionAccepted: true, paymentMethod: 'demo_card' }
  const paid = { ...opened.queue, enrollments: [...opened.queue.enrollments, { ...draft, id: 'paid', bandId: '', completedAt: '2026-11-13', subscriptionStatus: 'active', paymentStatus: 'succeeded' }] }
  assert.throws(() => actions.saveFamilyBand(paid, 'kim', draft, true), /instead of charging/)
  const removed = { ...opened.queue, academy: { ...opened.queue.academy, groups: [] } }
  assert.throws(() => actions.saveFamilyBand(removed, 'kim', draft, true), /no longer available/)
})
test('store reads once, writes once per transaction and shares one snapshot across listeners', () => {
  let reads = 0, writes = 0, notices = 0
  const storage = { getItem: () => { reads++; return JSON.stringify(createPortalQueue()) }, setItem: () => { writes++ } }
  const store = createPortalStore(() => storage)
  const one = store.getSnapshot()
  assert.equal(store.getSnapshot(), one)
  const unsubscribe = store.subscribe(() => notices++)
  store.subscribe(() => notices++)
  store.update(current => ({ ...current, tasks: [] }))
  assert.equal(reads, 1)
  assert.equal(writes, 1)
  assert.equal(notices, 2)
  store.update(current => current)
  assert.equal(writes, 1)
  assert.throws(() => store.update(() => { throw new Error('invalid') }), /invalid/)
  assert.equal(writes, 1)
  unsubscribe()
  store.update(current => ({ ...current, tasks: [] }))
  assert.equal(notices, 3)
})
test('storage failure preserves shared in-memory edits instead of reverting subscribers', () => {
  let notices = 0
  const store = createPortalStore(() => ({ getItem: () => null, setItem: () => { throw new Error('quota') } }))
  store.subscribe(() => notices++)
  store.update(current => ({ ...current, inquiries: [] }))
  store.update(current => ({ ...current, tasks: [{ id: 'kept' }] }))
  assert.equal(store.getSnapshot().inquiries.length, 0)
  assert.equal(store.getSnapshot().tasks[0].id, 'kept')
  assert.equal(notices, 2)
})
test('malformed storage envelopes recover safely and valid snapshots restore', () => {
  for (const saved of ['null', '{}', '[]', '{', JSON.stringify({ ...createPortalQueue(), requests: null }), JSON.stringify({ ...createPortalQueue(), state: { people: null } })]) {
    assert.ok(Array.isArray(readPortalQueue(saved).requests))
    assert.ok(Array.isArray(readPortalQueue(saved).state.people))
  }
  const queue = createPortalQueue()
  queue.inquiries = []
  assert.equal(readPortalQueue(JSON.stringify(queue)).inquiries.length, 0)
})
test('account projection adds later children without duplicating existing students', () => {
  const queue = lessonQueue()
  const first = withQueueAccounts(createDemoWorkspace().data, queue)
  const account = first.accounts.find(item => item.id === 'kim')
  queue.state.people.push({ id: 'new-child', accountId: 'kim', name: 'New Child', email: '', family: 'Kim', roles: ['Student'] })
  const next = withQueueAccounts(first, queue)
  assert.ok(next.accounts.find(item => item.id === 'kim').studentIds.includes('new-child'))
  assert.ok(next.students.some(item => item.id === 'new-child'))
  assert.equal(next.accounts.find(item => item.id === 'kim').holderId, account.holderId)
  assert.equal(withQueueAccounts(next, queue).students.length, next.students.length)
})


test('unnamed enrollments stay live in memory but never enter session backup or reload', () => {
  const model = load(path.join(root, 'beta-source/lib/academy-workflow-drafts.ts'))
  const bands = load(path.join(root, 'beta-source/lib/academy-band-enrollment.ts'))
  let saved
  const store = createPortalStore(() => ({ getItem: () => null, setItem: (_, value) => { saved = value } }))
  const queue = store.getSnapshot()
  const blank = model.newWorkflowDraft('enrollment', queue.academy)
  const named = model.newWorkflowDraft('enrollment', queue.academy)
  named.data.draft.contact = { id: 'manual', firstName: 'Robin', lastName: 'Test', email: '', phone: '', activeTeacher: false }
  const band = bands.newBandEnrollment(queue.state.people[0].id)
  store.update(current => ({ ...current, drafts: [blank, named], enrollments: [bands.newBandEnrollment(), band] }))
  assert.equal(store.getSnapshot().drafts.length, 2)
  assert.equal(JSON.parse(saved).drafts.map(record => record.id).join(','), named.id)
  assert.equal(JSON.parse(saved).enrollments.map(record => record.id).join(','), band.id)
  const legacy = readPortalQueue(JSON.stringify({ ...store.getSnapshot() }))
  assert.equal(legacy.drafts.map(record => record.id).join(','), named.id)
  assert.equal(legacy.enrollments.length, 1)
})
