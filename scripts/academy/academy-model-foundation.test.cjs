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
const lib = name => load(path.join(root, `beta-source/lib/${name}.ts`))
const { createDemoWorkspace } = lib('odeon-demo-workspace')
const { betaLessonOccurrences } = lib('beta-academy-calendar')
const { expandPreviewCalendar } = lib('academy-makeup-preview')
const { changeSessionOccurrence, markParticipantAttendance, detachParticipantOccurrence } = lib('academy-session')
const { reviseSubscription, subscriptionTermsOn, subscriptionScheduledOn } = lib('academy-subscription-history')
const { recordPaymentAttempt, recordPaymentRefund } = lib('academy-payment-ledger')
const { upgradeAcademyModel } = lib('academy-model-upgrade')
const { applyFamilyAction } = lib('academy-family-preview')
const plain = value => JSON.parse(JSON.stringify(value))
const shared = data => betaLessonOccurrences(data).find(item => item.studentIds.length > 1)
const context = (id, effectiveFrom) => ({ id, effectiveFrom, recordedAt: '2026-11-14T12:00:00Z', actor: 'staff:test', reason: 'Explicit test change' })

test('shared occurrence occupies one calendar block with a roster, including future recurrence', () => {
  const data = createDemoWorkspace().data
  const block = shared(data)
  assert.ok(block)
  assert.equal(block.studentIds.length, block.participantLessonIds.length)
  assert.equal(betaLessonOccurrences(data).length, new Set(data.lessons.map(item => item.occurrenceId)).size)
  assert.ok(shared(expandPreviewCalendar(data, '2026-11-21')))
  assert.ok(betaLessonOccurrences(expandPreviewCalendar(data, '2026-11-21')).some(item => item.date === '2026-11-21' && item.studentIds.length > 1))
})

test('whole-session move and cancellation reach all participants, preserving other bookings', () => {
  const data = createDemoWorkspace().data, block = shared(data)
  const next = changeSessionOccurrence(data, block.id, { date: '2026-11-21', time: '11:00', teacher: 'Substitute teacher' })
  const participants = next.lessons.filter(item => item.occurrenceId === block.id)
  assert.ok(participants.every(item => item.date === '2026-11-21' && item.time === '11:00'))
  assert.deepEqual(plain(next.lessons.filter(item => item.occurrenceId !== block.id)), plain(data.lessons.filter(item => item.occurrenceId !== block.id)))
  assert.ok(changeSessionOccurrence(next, block.id, { status: 'Cancelled' }).lessons.filter(item => item.occurrenceId === block.id).every(item => item.status === 'Cancelled'))
})

test('participant attendance does not alter session occupancy or grant makeup credits', () => {
  const data = createDemoWorkspace().data, block = shared(data), id = block.participantLessonIds[0]
  for (const outcome of ['Present', 'No-show', 'Excused absence']) {
    const next = markParticipantAttendance(data, id, outcome)
    assert.equal(next.lessons.find(item => item.id === id).attendance, outcome)
    assert.equal(next.lessons.find(item => item.id === block.participantLessonIds[1]).attendance, undefined)
    assert.equal(betaLessonOccurrences(next).find(item => item.id === block.id).status, 'Scheduled')
  }
  assert.throws(() => markParticipantAttendance(data, id, 'Absent'), /outcome/)
  const detached = detachParticipantOccurrence(data.lessons.find(item => item.id === id))
  assert.notEqual(detached.occurrenceId, block.id)
})

test('history retains terms across hold, resume and end dates independently of payment', () => {
  let enrollment = createDemoWorkspace().data.students[0].enrollments[0]
  const before = enrollment.amountMinor
  enrollment = reviseSubscription(enrollment, { amountMinor: 5100 }, context('price', '2026-11-01'))
  enrollment = reviseSubscription(enrollment, { lifecycle: 'frozen' }, context('hold', '2026-11-08'))
  enrollment = reviseSubscription(enrollment, { lifecycle: undefined, autopay: false }, context('resume', '2026-11-15'))
  enrollment = reviseSubscription(enrollment, { end: '2026-11-23' }, context('end', '2026-11-16'))
  assert.equal(subscriptionTermsOn(enrollment, '2026-10-01').amountMinor, before)
  assert.equal(subscriptionTermsOn(enrollment, '2026-11-02').amountMinor, 5100)
  assert.equal(subscriptionScheduledOn(enrollment, '2026-11-09'), false)
  assert.equal(subscriptionScheduledOn(enrollment, '2026-11-16'), true)
  assert.equal(subscriptionScheduledOn(enrollment, '2026-11-23'), false)
  assert.throws(() => reviseSubscription(enrollment, {}, context('backdate', '2026-11-01')), /backdated/)
})

function openInvoice() {
  const data = createDemoWorkspace().data
  const invoice = { ...data.invoices[0], id: 'test:open', status: 'Open', paidMinor: 0, lines: [{ ...data.invoices[0].lines[0], quantity: 1, unitMinor: 10000 }] }
  return { data: { ...data, invoices: [...data.invoices, invoice] }, invoice }
}
const attempt = (invoice, overrides = {}) => ({ id: 'attempt:1', invoiceId: invoice.id, accountId: invoice.accountId, payerId: invoice.payerId, amountMinor: 4000, outcome: 'succeeded', recordedAt: '2026-11-14T12:00:00Z', method: 'Simulated card', ...overrides })

test('failed attempts, partial settlement and retries never duplicate invoice obligations', () => {
  const { data, invoice } = openInvoice()
  const failed = recordPaymentAttempt(data, attempt(invoice, { outcome: 'failed', reason: 'Declined' }))
  assert.deepEqual(plain(failed.invoices), plain(data.invoices))
  assert.equal(failed.payments.length, 0)
  const partial = recordPaymentAttempt(failed, attempt(invoice, { id: 'attempt:2' }))
  assert.equal(partial.invoices.at(-1).paidMinor, 4000)
  assert.equal(recordPaymentAttempt(partial, attempt(invoice, { id: 'attempt:2' })), partial)
  const paid = recordPaymentAttempt(partial, attempt(invoice, { id: 'attempt:3', amountMinor: 6000 }))
  assert.equal(paid.invoices.at(-1).status, 'Paid')
  assert.equal(paid.invoices.length, data.invoices.length)
  assert.equal(paid.payments.length, 2)
  assert.throws(() => recordPaymentAttempt(partial, attempt(invoice, { id: 'attempt:2', amountMinor: 5000 })), /different/)
  assert.throws(() => recordPaymentAttempt(partial, attempt(invoice, { id: 'attempt:4', amountMinor: 7000 })), /amount/)
})

test('refunds reference successful allocations and cannot exceed them', () => {
  const { data, invoice } = openInvoice()
  const paid = recordPaymentAttempt(data, attempt(invoice))
  const refund = { id: 'refund:1', paymentId: paid.payments[0].id, invoiceId: invoice.id, amountMinor: 2000, reason: 'Approved refund', recordedAt: '2026-11-14T13:00:00Z' }
  const next = recordPaymentRefund(paid, refund)
  assert.equal(recordPaymentRefund(next, refund), next)
  assert.throws(() => recordPaymentRefund(next, { ...refund, id: 'refund:2', amountMinor: 3000 }), /allocation/)
})

test('existing family payment actions populate the ledger and preserve account boundaries', () => {
  const { data, invoice } = openInvoice()
  const card = data.cards.find(item => item.accountId === invoice.accountId)
  const next = applyFamilyAction(data, { kind: 'pay-invoice', accountId: invoice.accountId, invoiceId: invoice.id, payerId: card.payerId, cardId: card.id })
  assert.equal(next.payments.length, 1)
  assert.equal(next.invoices.at(-1).paidMinor, 10000)
  const refunded = applyFamilyAction(next, { kind: 'refund-invoice', accountId: invoice.accountId, invoiceId: invoice.id, reason: 'Approved' })
  assert.equal(refunded.paymentRefunds.length, 1)
  assert.throws(() => applyFamilyAction(data, { kind: 'payment-attempt', accountId: invoice.accountId, attempt: attempt(invoice, { accountId: 'wrong' }) }), /account payer/)
})

test('additive model migration preserves tester work and does not infer group identity', () => {
  const data = createDemoWorkspace().data
  const old = { ...data, modelVersion: undefined, lessons: data.lessons.map(item => { const lesson = { ...item }; delete lesson.occurrenceId; return lesson }) }
  const next = upgradeAcademyModel(old)
  assert.equal(next.modelVersion, 3)
  assert.deepEqual(plain(next.lessons), plain(old.lessons))
  assert.deepEqual(plain(next.invoices), plain(old.invoices))
  assert.equal(upgradeAcademyModel(next), next)
})

test('family participant-only projection detaches without changing classmates', () => {
  const data = createDemoWorkspace().data, block = shared(data), id = block.participantLessonIds[0]
  const { projectFamilyMoves } = lib('family-reschedule')
  const next = projectFamilyMoves(data, { items: [], absences: [] }, { [id]: { date: '2026-11-21', time: '13:00', teacher: 'Substitute', program: block.program } }).data
  assert.equal(next.lessons.find(item => item.id === block.participantLessonIds[1]).date, block.date)
  assert.notEqual(next.lessons.find(item => item.id === id).occurrenceId, block.id)
  assert.doesNotThrow(() => betaLessonOccurrences(next))
})
