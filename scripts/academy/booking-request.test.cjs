/* eslint-disable @typescript-eslint/no-require-imports -- Pure TypeScript in the existing local VM harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const file = path.resolve(__dirname, '../../lib/academy-booking-request.ts')
const exported = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, { exports: exported }, { filename: file, timeout: 1000 })
const { newBookingRequest, transitionBookingRequest: step } = exported
const submit = () => step(newBookingRequest(), { type: 'submit', cardReady: true })
const approve = () => step(submit(), { type: 'approve' })
const processing = () => step(approve(), { type: 'start_payment', attemptId: 'attempt-1' })

test('no card means no request enters staff review', () => {
  const draft = newBookingRequest()
  assert.throws(() => step(draft, { type: 'submit', cardReady: false }), /card_required_before_review/)
  assert.equal(draft.status, 'draft')
})
test('card readiness submits a request without confirming or charging', () => {
  const result = submit()
  assert.equal(result.status, 'awaiting_confirmation')
  assert.equal(result.paymentAttemptId, null)
})
test('staff approval awaits payment instead of confirming a booking', () => {
  assert.equal(approve().status, 'pending_payment')
})
test('collection cannot start before approval', () => {
  for (const current of [newBookingRequest(), submit()]) {
    assert.throws(() => step(current, { type: 'start_payment', attemptId: 'attempt-1' }), /invalid_booking_transition/)
  }
})
test('successful matching payment evidence confirms the request', () => {
  const result = step(processing(), { type: 'payment_succeeded', attemptId: 'attempt-1' })
  assert.equal(result.status, 'confirmed')
  assert.equal(result.paymentAttemptId, 'attempt-1')
})
test('failed payment remains pending payment and can start a new attempt', () => {
  const failed = step(processing(), { type: 'payment_failed', attemptId: 'attempt-1' })
  assert.equal(failed.status, 'pending_payment')
  const retry = step(failed, { type: 'start_payment', attemptId: 'attempt-2' })
  assert.equal(retry.status, 'processing_payment')
  assert.equal(retry.paymentAttemptId, 'attempt-2')
})
test('stale payment result cannot complete a different current attempt', () => {
  const failed = step(processing(), { type: 'payment_failed', attemptId: 'attempt-1' })
  const retry = step(failed, { type: 'start_payment', attemptId: 'attempt-2' })
  for (const type of ['payment_succeeded', 'payment_failed']) {
    assert.throws(() => step(retry, { type, attemptId: 'attempt-1' }), /payment_attempt_mismatch/)
  }
})
test('provider result cannot bypass starting an approved attempt', () => {
  for (const current of [newBookingRequest(), submit(), approve()]) {
    assert.throws(() => step(current, { type: 'payment_succeeded', attemptId: 'attempt-1' }), /invalid_booking_transition/)
  }
})
test('rejected request cannot collect payment', () => {
  const rejected = step(submit(), { type: 'reject' })
  assert.equal(rejected.status, 'rejected')
  assert.throws(() => step(rejected, { type: 'start_payment', attemptId: 'attempt-1' }), /invalid_booking_transition/)
})
test('duplicate completion does not start another collection or silently reapply', () => {
  const confirmed = step(processing(), { type: 'payment_succeeded', attemptId: 'attempt-1' })
  assert.throws(() => step(confirmed, { type: 'payment_succeeded', attemptId: 'attempt-1' }), /invalid_booking_transition/)
  assert.throws(() => step(confirmed, { type: 'start_payment', attemptId: 'attempt-2' }), /invalid_booking_transition/)
})
test('malformed state, card evidence, attempt IDs and unexpected payment data reject', () => {
  for (const current of [{ status: 'invented', paymentAttemptId: null }, { status: 'confirmed', paymentAttemptId: null }]) {
    assert.throws(() => step(current, { type: 'approve' }), /invalid_booking_state/)
  }
  assert.throws(() => step(newBookingRequest(), { type: 'submit', cardReady: 'yes' }), /invalid_card_readiness/)
  assert.throws(() => step(approve(), { type: 'start_payment', attemptId: ' ' }), /invalid_payment_attempt/)
  assert.throws(() => step(newBookingRequest(), { type: 'submit', cardReady: true, cardNumber: 'not-accepted' }), /invalid_booking_event/)
})
test('transitions return frozen copies and never mutate earlier states', () => {
  const draft = newBookingRequest()
  const result = step(draft, { type: 'submit', cardReady: true })
  assert.notEqual(draft, result)
  assert.equal(draft.status, 'draft')
  assert.ok(Object.isFrozen(draft) && Object.isFrozen(result))
})