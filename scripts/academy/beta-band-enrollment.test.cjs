/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain and local adapter verification. */
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
const model = load(path.join(root, 'beta-source/lib/academy-band-enrollment.ts'))
const { createOpportunityAdapter } = load(path.join(root, 'beta-source/lib/academy-opportunity-adapter.ts'))
const { academySettings } = load(path.join(root, 'beta-source/lib/academy-explorer.ts'))
const { explorerPeople, explorerInquiries } = load(path.join(root, 'beta-source/lib/event-explorer.ts'))
const plain = value => JSON.parse(JSON.stringify(value))
const band = () => ({ ...academySettings('music').groups[0], id: 'comets', memberIds: [], schedule: '', formation: true })
const ready = () => ({ ...model.newBandEnrollment('sophie', 'comets'), policyAccepted: true, subscriptionAccepted: true, payerName: 'Sam Kim', payerEmail: 'sam@example.invalid', monthlyPrice: '150', paymentMethod: 'demo_card' })
test('fictional adapter supports main summary and records contracts without operational fallback', async () => {
  const state = { people: structuredClone(explorerPeople), inquiries: structuredClone(explorerInquiries) }
  const adapter = createOpportunityAdapter({ getState: () => state, onChange: () => {}, getCreationIds: () => null })
  const summary = await adapter.request('/api/leads?summary_only=1')
  assert.equal(summary.status, 200)
  const totals = await summary.json()
  assert.ok(totals.counts)
  assert.equal(totals.pipelineValue, 0)
  const records = await (await adapter.request('/api/leads?include_counts=0')).json()
  assert.ok(Array.isArray(records))
  const counted = await (await adapter.request('/api/leads?include_counts=1')).json()
  assert.ok(Array.isArray(counted.leads))
  assert.ok(counted.counts)
  assert.equal((await adapter.request('/api/campaigns', { method: 'POST', body: '{}' })).status, 422)
})
test('formation creates pending candidates and independent band opportunities, without enrollment', () => {
  const group = band(), inquiries = structuredClone(explorerInquiries)
  const result = model.addBandCandidates(group, ['sophie', 'ethan', 'sophie'], explorerPeople, inquiries)
  assert.deepEqual(plain(result.group.memberIds), [])
  assert.deepEqual(plain(result.group.pendingMemberIds), ['sophie', 'ethan'])
  const leads = result.inquiries.filter(inquiry => inquiry.bandId === group.id)
  assert.equal(leads.length, 2)
  assert.ok(leads.every(inquiry => inquiry.stage === 'New' && inquiry.accountId === 'kim'))
  assert.deepEqual(plain(result.inquiries.filter(inquiry => !inquiry.bandId)), inquiries)
  assert.equal(model.addBandCandidates(result.group, ['sophie'], explorerPeople, result.inquiries).inquiries.length, result.inquiries.length)
  assert.throws(() => model.addBandCandidates(group, ['unknown'], explorerPeople, []), /existing student/)
})
test('policies, payer, payment and subscription authorization are all required; schedule is not', () => {
  for (const change of [{ policyAccepted: false }, { subscriptionAccepted: false }, { payerName: '' }, { payerEmail: 'bad' }, { monthlyPrice: '' }, { monthlyPrice: '-1' }, { monthlyPrice: 'Infinity' }, { paymentMethod: '' }]) {
    const draft = { ...ready(), ...change }
    assert.throws(() => model.completeBandEnrollment(draft, [band()], explorerPeople, []))
  }
  assert.equal(model.bandEnrollmentError(ready(), 3, explorerPeople, [band()]), '')
})
test('successful checkout confirms only the selected band membership and linked opportunity', () => {
  const pending = model.addBandCandidates(band(), ['sophie', 'ethan'], explorerPeople, explorerInquiries)
  const otherBand = { ...band(), id: 'other-band' }
  const otherPending = model.addBandCandidates(otherBand, ['sophie'], explorerPeople, pending.inquiries)
  const result = model.completeBandEnrollment(ready(), [pending.group, otherPending.group], explorerPeople, otherPending.inquiries)
  assert.deepEqual(plain(result.groups[0].memberIds), ['sophie'])
  assert.deepEqual(plain(result.groups[0].pendingMemberIds), ['ethan'])
  assert.deepEqual(plain(result.groups[1]), plain(otherPending.group))
  assert.equal(result.inquiries.find(inquiry => inquiry.bandId === 'comets' && inquiry.personId === 'sophie').stage, 'Enrolled')
  assert.equal(result.inquiries.find(inquiry => inquiry.bandId === 'comets' && inquiry.personId === 'ethan').stage, 'New')
  assert.equal(result.inquiries.find(inquiry => inquiry.bandId === 'other-band').stage, 'New')
  assert.deepEqual(plain(result.inquiries.filter(inquiry => !inquiry.bandId)), plain(explorerInquiries))
  assert.equal(result.receipt.paymentStatus, 'succeeded')
  assert.equal(result.receipt.subscriptionStatus, 'active')
  assert.ok(result.receipt.completedAt)
  assert.ok(!JSON.stringify(result.receipt).includes('4242424242424242'))
  assert.throws(() => model.completeBandEnrollment(result.receipt, result.groups, result.people, result.inquiries), /already/)
  assert.throws(() => model.completeBandEnrollment(ready(), result.groups, result.people, result.inquiries), /already/)
})
test('lost historical candidates stay closed when a new enrollment is completed', () => {
  const lost = { id: 'old', bandId: 'comets', personId: 'sophie', stage: 'Lost', category: 'Program inquiries', interest: 'Old', followUp: '', note: '' }
  const result = model.completeBandEnrollment(ready(), [band()], explorerPeople, [lost])
  assert.equal(result.inquiries.find(inquiry => inquiry.id === 'old').stage, 'Lost')
  assert.equal(result.inquiries.filter(inquiry => inquiry.stage === 'Enrolled').length, 1)
})
test('Won and Enrolled actions launch enrollment without mutating opportunity or sibling state', async () => {
  for (const status of ['won', 'enrolled']) {
    const pending = model.addBandCandidates(band(), ['sophie', 'ethan'], explorerPeople, explorerInquiries)
    let state = { people: explorerPeople, inquiries: pending.inquiries }
    const before = plain(state), started = []
    const adapter = createOpportunityAdapter({ getState: () => state, onChange: next => { state = next }, getCreationIds: () => null, onBandEnrollment: (...args) => started.push(args) })
    const id = state.inquiries.find(inquiry => inquiry.bandId === 'comets' && inquiry.personId === 'sophie').id
    const response = await adapter.request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    assert.equal(response.status, 200)
    assert.deepEqual(started, [['sophie', 'comets']])
    assert.deepEqual(plain(state), before)
    const blocked = createOpportunityAdapter({ getState: () => state, onChange: next => { state = next }, getCreationIds: () => null })
    assert.equal((await blocked.request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })).status, 409)
  }
})
test('shared availability requires every participant and does not change membership', () => {
  const tasks = [
    { studentId: 'sophie', submitted: true, blocks: [{ id: 'a', date: '2026-11-16', from: '16:00', to: '18:00' }] },
    { studentId: 'ethan', submitted: true, blocks: [{ id: 'b', date: '2026-11-16', from: '17:00', to: '19:00' }] },
  ]
  assert.deepEqual(plain(model.bandAvailabilityOverlap(tasks, ['sophie', 'ethan'])).map(({ date, from, to }) => ({ date, from, to })), [{ date: '2026-11-16', from: '17:00', to: '18:00' }])
  assert.equal(model.bandAvailabilityOverlap(tasks, ['sophie', 'ethan', 'leo']).length, 0)
  assert.equal(model.bandAvailabilityOverlap([], []).length, 0)
})

test('paid band-program subscriptions can await placement and cover exactly one band', () => {
  const groups = [band(), { ...band(), id: 'second' }]
  const paid = model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true }, groups, explorerPeople, explorerInquiries)
  assert.deepEqual(plain(paid.groups), plain(groups))
  assert.deepEqual(plain(paid.inquiries.slice(0, explorerInquiries.length)), plain(explorerInquiries))
  const matching = paid.inquiries.find(inquiry => inquiry.serviceType === 'band' && !inquiry.bandId)
  assert.equal(matching.personId, 'sophie')
  assert.equal(matching.stage, 'New')
  assert.equal(matching.interest, 'Band program')
  assert.equal(model.availableBandSubscriptions([paid.receipt], 'sophie').length, 1)
  assert.equal(model.availableBandSubscriptions([paid.receipt], 'ethan').length, 0)
  const result = model.assignBandSubscription(paid.receipt.id, 'sophie', 'comets', [paid.receipt], groups, paid.people, paid.inquiries)
  assert.deepEqual(plain(result.groups[0].memberIds), ['sophie'])
  assert.deepEqual(plain(result.groups[1]), plain(groups[1]))
  assert.equal(result.enrollments[0].id, paid.receipt.id)
  assert.equal(result.enrollments[0].completedAt, paid.receipt.completedAt)
  assert.equal(model.availableBandSubscriptions(result.enrollments, 'sophie').length, 0)
  assert.throws(() => model.assignBandSubscription(paid.receipt.id, 'sophie', 'second', result.enrollments, result.groups, result.people, result.inquiries), /available subscription/)
  assert.throws(() => model.assignBandSubscription(paid.receipt.id, 'ethan', 'second', [paid.receipt], groups, paid.people, paid.inquiries), /available subscription/)
  const unpaid = model.addBandCandidates(result.groups[1], ['sophie'], result.people, result.inquiries)
  assert.deepEqual(plain(unpaid.group.memberIds), [])
  assert.deepEqual(plain(unpaid.group.pendingMemberIds), ['sophie'])
  assert.equal(unpaid.inquiries.find(record => record.bandId === 'second').stage, 'New')
  assert.equal(unpaid.inquiries.find(record => record.bandId === 'comets').stage, 'Enrolled')
})

test('unassigned checkout still requires payment, policies and explicit selection', () => {
  for (const change of [{ chooseBandLater: false }, { policyAccepted: false }, { subscriptionAccepted: false }, { paymentMethod: '' }]) {
    assert.throws(() => model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true, ...change }, [band()], explorerPeople, []))
  }
  for (const change of [{ paymentStatus: 'pending' }, { subscriptionStatus: 'pending' }, { completedAt: undefined }, { policyAccepted: false }]) {
    const receipt = { ...ready(), bandId: '', completedAt: '2026-11-12', paymentStatus: 'succeeded', subscriptionStatus: 'active', ...change }
    assert.equal(model.availableBandSubscriptions([receipt], 'sophie').length, 0)
  }
})

test('a pending placement can use existing coverage and a second band requires a second subscription', () => {
  const pending = model.addBandCandidates(band(), ['sophie', 'ethan'], explorerPeople, explorerInquiries)
  const groups = [pending.group, { ...band(), id: 'second' }]
  const first = model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true }, groups, explorerPeople, pending.inquiries).receipt
  const second = model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true }, groups, explorerPeople, pending.inquiries).receipt
  const assigned = model.assignBandSubscription(first.id, 'sophie', 'comets', [first, second], groups, explorerPeople, pending.inquiries)
  assert.deepEqual(plain(assigned.groups[0].pendingMemberIds), ['ethan'])
  assert.equal(assigned.inquiries.filter(record => record.bandId === 'comets' && record.personId === 'sophie').length, 1)
  const both = model.assignBandSubscription(second.id, 'sophie', 'second', assigned.enrollments, assigned.groups, assigned.people, assigned.inquiries)
  assert.ok(both.groups.every(group => group.memberIds.includes('sophie')))
  assert.deepEqual(plain(both.enrollments.map(record => record.bandId)), ['comets', 'second'])
  assert.equal(model.availableBandSubscriptions(both.enrollments, 'sophie').length, 0)
  assert.equal(both.inquiries.find(record => record.bandId === 'comets' && record.personId === 'ethan').stage, 'New')
})

test('auditions and recurring rehearsals include unpaid students without confirming them', () => {
  const group = { ...band(), memberIds: ['sophie'], pendingMemberIds: ['ethan'] }
  for (const schedule of ['2026-11-16 · 16:00 · Audition', '2026-11-16 · 16:00 · Weekly']) {
    const result = model.scheduleBandParticipants(group, ['sophie', 'ethan', 'leo'], schedule, explorerPeople, explorerInquiries)
    assert.deepEqual(plain(result.group.memberIds), ['sophie'])
    assert.deepEqual(plain(result.group.pendingMemberIds), ['ethan', 'leo'])
    assert.equal(result.group.schedule, schedule)
    assert.ok(result.inquiries.filter(record => record.bandId === group.id).every(record => record.stage === 'New'))
    assert.deepEqual(plain(group.pendingMemberIds), ['ethan'])
  }
})
const requestModel = load(path.join(root, 'beta-source/lib/academy-band-requests.ts'))
test('enrollment requests are explicit, deduplicated, recipient scoped and do not activate membership', () => {
  const pending = model.addBandCandidates(band(), ['sophie', 'ethan'], explorerPeople, [])
  const before = plain(pending)
  const policies = [{ id: 'policy', values: { name: 'Band policies', cancellation: '30 days' } }]
  const requests = requestModel.sendBandEnrollmentRequests([], pending.group, ['sophie', 'ethan'], explorerPeople, [], '125', policies)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].accountId, 'kim')
  assert.equal(requests[0].recipientEmail, 'sam.kim@example.invalid')
  policies[0].values.cancellation = 'changed'
  assert.equal(requests[0].policies[0].values.cancellation, '30 days')
  assert.deepEqual(plain(pending), before)
  assert.equal(requestModel.sendBandEnrollmentRequests(requests, pending.group, ['sophie'], explorerPeople, [], '125', []).length, 2)
  assert.throws(() => requestModel.openBandEnrollmentRequest(requests, requests[0].id, 'chen', [pending.group]), /family/)
  assert.equal(requestModel.openBandEnrollmentRequest(requests, requests[0].id, 'kim', [pending.group]).studentId, 'sophie')
  const other = requestModel.sendBandEnrollmentRequests(requests, { ...pending.group, id: 'second' }, ['sophie'], explorerPeople, [], '150', [])
  const resolved = requestModel.resolveBandEnrollmentRequests(other, 'sophie', 'comets')
  assert.ok(resolved[0].completedAt)
  assert.ok(!resolved[1].completedAt)
  assert.ok(!resolved[2].completedAt)
  assert.throws(() => requestModel.openBandEnrollmentRequest(resolved, requests[0].id, 'kim', [pending.group]), /unavailable/)
  const email = requestModel.bandEnrollmentRequestEmail(requests[0], 'Sophie Kim')
  assert.ok(email.href.includes(requests[0].id))
  assert.match(email.body, /125.00/)
  assert.throws(() => requestModel.sendBandEnrollmentRequests([], pending.group, ['leo'], explorerPeople, [], '125', []), /pending/)
  assert.throws(() => requestModel.sendBandEnrollmentRequests([], pending.group, ['sophie'], explorerPeople, [], '0', []), /price/)
  const paid = model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true }, [pending.group], explorerPeople, [])
  assert.throws(() => requestModel.sendBandEnrollmentRequests([], pending.group, ['sophie'], explorerPeople, [paid.receipt], '125', []), /paid subscription/)
  assert.throws(() => requestModel.openBandEnrollmentRequest(requests, requests[0].id, 'kim', [{ ...pending.group, pendingMemberIds: ['ethan'] }]), /no longer/)
})

test('eligible paid coverage resolves only its placement request without another payment', () => {
  const pending = model.addBandCandidates(band(), ['sophie', 'ethan'], explorerPeople, [])
  const requests = requestModel.sendBandEnrollmentRequests([], pending.group, ['sophie', 'ethan'], explorerPeople, [], '125', [])
  const paid = model.completeBandEnrollment({ ...ready(), bandId: '', chooseBandLater: true }, [pending.group], explorerPeople, pending.inquiries)
  const assigned = model.assignBandSubscription(paid.receipt.id, 'sophie', 'comets', [paid.receipt], paid.groups, paid.people, paid.inquiries)
  const resolved = requestModel.resolveBandEnrollmentRequests(requests, 'sophie', 'comets')
  assert.equal(assigned.enrollments.length, 1)
  assert.equal(assigned.enrollments[0].completedAt, paid.receipt.completedAt)
  assert.equal(assigned.enrollments[0].id, paid.receipt.id)
  assert.deepEqual(plain(assigned.groups[0].memberIds), ['sophie'])
  assert.deepEqual(plain(assigned.groups[0].pendingMemberIds), ['ethan'])
  assert.ok(resolved[0].completedAt)
  assert.ok(!resolved[1].completedAt)
  assert.throws(() => requestModel.openBandEnrollmentRequest(resolved, requests[0].id, 'kim', assigned.groups), /unavailable/)
})

test('bulk enrollment requests validate every recipient before creating any request', () => {
  const pending = model.addBandCandidates(band(), ['sophie', 'leo'], explorerPeople, [])
  const people = explorerPeople.map(person => person.accountId === 'patel' ? { ...person, email: '' } : person)
  const requests = []
  assert.throws(() => requestModel.sendBandEnrollmentRequests(requests, pending.group, ['sophie', 'leo'], people, [], '125', []), /email/)
  assert.equal(requests.length, 0)
  assert.equal(pending.group.memberIds.length, 0)
})


test('band instrument defaults use only the selected student’s active recurring subscriptions', () => {
  assert.equal(model.defaultBandInstrument(explorerPeople.find(person => person.id === 'sophie')), 'Guitar')
  assert.equal(model.defaultBandInstrument(explorerPeople.find(person => person.id === 'ethan')), 'Drums')
  assert.equal(model.defaultBandInstrument(explorerPeople.find(person => person.id === 'mia')), '')
  assert.equal(model.defaultBandInstrument({ subscriptions: [{ instrument: 'Bass', status: 'cancelled', recurring: true }, { instrument: 'Piano', status: 'active', recurring: false }] }), '')
  assert.equal(model.defaultBandInstrument(undefined), '')
})
test('placement instrument overrides preserve lesson subscriptions and other bands', () => {
  const other = { ...band(), id: 'other', memberInstruments: { sophie: 'Guitar' } }
  const before = plain(explorerPeople)
  const result = model.completeBandEnrollment({ ...ready(), instrument: 'Voice' }, [band(), other], explorerPeople, explorerInquiries)
  assert.equal(result.receipt.instrument, 'Voice')
  assert.equal(result.groups[0].memberInstruments.sophie, 'Voice')
  assert.deepEqual(plain(result.groups[1]), plain(other))
  assert.deepEqual(plain(explorerPeople), before)
  assert.match(model.bandEnrollmentError({ ...ready(), instrument: '' }, 1, explorerPeople, [band()]), /instrument/)
})
test('custom enrollment request message is snapshotted independently of policy configuration', () => {
  const { group } = model.addBandCandidates(band(), ['sophie'], explorerPeople, explorerInquiries)
  const message = { subject: 'Join our band', html: '<p>Welcome to the band.</p>' }
  const [request] = requestModel.sendBandEnrollmentRequests([], group, ['sophie'], explorerPeople, [], '125', [], message)
  message.subject = 'Changed later'
  assert.equal(request.message.subject, 'Join our band')
  assert.equal(requestModel.bandEnrollmentRequestEmail(request, 'Sophie').subject, 'Join our band')
  assert.throws(() => requestModel.sendBandEnrollmentRequests([], group, ['sophie'], explorerPeople, [], '125', [], { subject: '', html: '' }), /subject/)
})


const pricingModel = load(path.join(root, 'beta-source/lib/academy-band-pricing.ts'))
test('band pricing follows linked service plans, never inventing a missing plan', () => {
  const service = { id: 'band', values: { name: 'Band', planIds: '["group"]' } }
  const plan = { id: 'group', values: { kind: 'Subscription', basis: 'Per scheduled lesson', cadence: 'Monthly', durationPrices: '[{"minutes":60,"price":"35"}]' } }
  assert.equal(pricingModel.bandPricingPlans([service], [plan]).length, 1)
  assert.equal(pricingModel.bandPricingPlans([service], []).length, 0)
  assert.equal(pricingModel.bandPricingPlans([{ ...service, values: { ...service.values, planIds: '{}' } }], [plan]).length, 0)
  assert.equal(pricingModel.bandPlanRates(plan)[0].price, '35')
  const price = pricingModel.quoteBandPrice(service, plan, '35', [], { combination: 'best', order: 'percentage-first' })
  assert.equal(price.amount, '35.00')
  assert.equal(price.unit, 'per session · billed monthly')
  assert.equal(price.recurring, true)
  const flat = pricingModel.quoteBandPrice(service, { ...plan, values: { kind: 'Subscription', basis: 'Flat fee', cadence: 'Monthly' } }, '125', [], { combination: 'best', order: 'percentage-first' })
  assert.equal(flat.unit, 'flat fee · billed monthly')
  const once = pricingModel.quoteBandPrice(service, { ...plan, values: { kind: 'Single lesson' } }, '25', [], { combination: 'best', order: 'percentage-first' })
  assert.equal(once.recurring, false)
  const pending = model.addBandCandidates(band(), ['sophie'], explorerPeople, [])
  assert.equal(model.completeBandEnrollment({ ...ready(), pricing: once }, [pending.group], explorerPeople, pending.inquiries).receipt.subscriptionStatus, 'not_applicable')
})
test('configured discounts use eligibility and the existing best/combine ordering rules', () => {
  const percent = { id: 'percent', name: 'Ten percent', amount: '10', unit: '%', match: 'all', conditions: [{ id: 'pending', field: 'status', comparison: 'eq', value: 'pending' }] }
  const fixed = { ...percent, id: 'fixed', name: 'Five dollars', amount: '5', unit: '$' }
  const service = { id: 'band', values: { name: 'Band' } }, plan = { id: 'monthly', values: { kind: 'Subscription', basis: 'Flat fee', cadence: 'Monthly' } }
  assert.equal(pricingModel.quoteBandPrice(service, plan, '100', [percent, fixed], { combination: 'best', order: 'percentage-first' }).amount, '90.00')
  assert.equal(pricingModel.quoteBandPrice(service, plan, '100', [percent, fixed], { combination: 'combine', order: 'percentage-first' }).amount, '85.00')
  assert.equal(pricingModel.quoteBandPrice(service, plan, '100', [percent, fixed], { combination: 'combine', order: 'fixed-first' }).amount, '85.50')
  const unknown = { ...percent, id: 'unknown', conditions: [{ id: 'level', field: 'level', comparison: 'gte', value: '2' }] }
  const expired = { ...percent, id: 'expired', endsOn: '2026-01-01' }
  const students = explorerPeople.filter(person => ['sophie', 'ethan'].includes(person.id))
  assert.deepEqual(plain(pricingModel.eligibleBandDiscounts([percent, unknown, expired], students, explorerPeople, '2026-11-13')).map(discount => discount.id), ['percent'])
})
test('request pricing snapshot preserves unit and discounts through email and completion', () => {
  const pending = model.addBandCandidates(band(), ['sophie'], explorerPeople, [])
  const price = { serviceId: 'band', planId: 'group', label: 'Band subscription', unit: 'per session · billed monthly', recurring: true, baseAmount: '35.00', amount: '31.50', discountIds: ['ten-percent'] }
  const [request] = requestModel.sendBandEnrollmentRequests([], pending.group, ['sophie'], explorerPeople, [], price.amount, [], undefined, price)
  assert.match(requestModel.bandEnrollmentRequestEmail(request, 'Sophie Kim').body, /per session · billed monthly/)
  assert.deepEqual(plain(request.pricing.discountIds), ['ten-percent'])
  price.discountIds.push('not-part-of-request')
  assert.deepEqual(plain(request.pricing.discountIds), ['ten-percent'])
  const result = model.completeBandEnrollment({ ...ready(), monthlyPrice: request.monthlyPrice, pricing: request.pricing }, [pending.group], explorerPeople, pending.inquiries)
  assert.equal(result.receipt.pricing.unit, 'per session · billed monthly')
  assert.equal(result.receipt.monthlyPrice, '31.50')
})
