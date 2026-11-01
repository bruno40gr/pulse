/* eslint-disable @typescript-eslint/no-require-imports -- Fictional policy tests; no database or provider calls. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const policy = createHarness().load('lib/contact-family-integration.ts')
const id = value => `preview:${value}`
function fixture() {
  const person = (name, patch = {}) => ({ id: id(name), tenantId: id('tenant'), name, email: `${name}@example.invalid`, phone: '', isStudent: false, isMinor: false, optedOut: false, routing: 'direct', ...patch })
  return { source: 'fictional', tenantId: id('tenant'),
    people: [person('Sam'), person('Sophie', { isStudent: true, isMinor: true, routing: 'authorised_contact' }), person('Ethan', { isStudent: true, isMinor: true, routing: 'authorised_contact' }), person('Alex', { isStudent: true }), person('Payer'), person('Guardian'), person('Unlinked')],
    accounts: [{ id: id('family'), tenantId: id('tenant'), name: 'Kim family' }, { id: id('adult'), tenantId: id('tenant'), name: 'Alex' }],
    memberships: [{ accountId: id('family'), personId: id('Sam'), role: 'account_holder' }, ...['Sophie', 'Ethan'].map(name => ({ accountId: id('family'), personId: id(name), role: 'student' })), { accountId: id('family'), personId: id('Payer'), role: 'payer' }, { accountId: id('family'), personId: id('Guardian'), role: 'guardian' }, { accountId: id('adult'), personId: id('Alex'), role: 'account_holder' }, { accountId: id('adult'), personId: id('Alex'), role: 'student' }],
    messagingGrants: ['Sophie', 'Ethan'].map(name => ({ studentId: id(name), recipientId: id('Sam'), channel: 'email', active: true })),
  }
}
const resolve = (data, names, channel = 'email') => policy.proposeFamilyRecipients(data, names.map(id), channel)

test('production routing is hard-disabled and live-shaped input is rejected', () => {
  assert.equal(policy.FAMILY_PRODUCTION_ROUTING_ENABLED, false)
  assert.equal(resolve(fixture(), ['Sophie']).deliveryEnabled, false)
  for (const patch of [{ source: 'production' }, { tenantId: 'real-tenant' }]) assert.throws(() => policy.buildContactFamilyTree({ ...fixture(), ...patch }))
})
test('tree preserves explicit sibling links, combined adult row and unlinked contacts', () => {
  const groups = policy.buildContactFamilyTree(fixture())
  const family = groups.find(group => group.id === id('family'))
  assert.deepEqual(Array.from(family.students, person => person.name), ['Ethan', 'Sophie'])
  assert.equal(family.holders[0].name, 'Sam')
  const adult = groups.find(group => group.id === id('adult'))
  assert.equal(adult.students[0].id, adult.holders[0].id)
  assert.ok(groups.some(group => group.standalone?.id === id('Unlinked')))
  assert.ok(groups.some(group => group.standalone?.id === id('Payer')))
  assert.equal(policy.buildContactFamilyTree(fixture(), 'sophie').length, 1)
})
test('same names and shared addresses do not manufacture family membership', () => {
  const data = fixture(); data.people.find(person => person.name === 'Unlinked').name = 'Sam'
  data.people.find(person => person.id === id('Unlinked')).email = data.people[0].email
  assert.ok(policy.buildContactFamilyTree(data).some(group => group.standalone?.id === id('Unlinked')))
})
test('cross-tenant, duplicate and dangling identities or memberships fail closed', () => {
  for (const mutate of [data => { data.people[0].tenantId = id('foreign') }, data => data.people.push(data.people[0]), data => { data.memberships[0].personId = id('missing') }, data => { data.accounts[0].tenantId = id('foreign') }, data => { data.messagingGrants[0].recipientId = id('missing') }, data => data.memberships.push(data.memberships[0])]) {
    const data = fixture(); mutate(data); assert.throws(() => policy.buildContactFamilyTree(data))
  }
})
test('sibling selections resolve to one named adult while preserving student context', () => {
  const result = resolve(fixture(), ['Sophie', 'Ethan', 'Sophie'])
  assert.equal(result.selectedCount, 2); assert.equal(result.recipients.length, 1)
  assert.equal(result.recipients[0].name, 'Sam'); assert.equal(result.recipients[0].destination, 'sam@example.invalid')
  assert.deepEqual(Array.from(result.recipients[0].studentNames), ['Ethan', 'Sophie'])
})
test('account holder, payer and guardian membership alone never authorises messaging a student', () => {
  const data = fixture(); data.messagingGrants = []
  const result = resolve(data, ['Sophie'])
  assert.equal(result.recipients.length, 0); assert.match(result.excluded[0].reason, /No verified/)
})
test('multiple adults require explicit choice; inactive and other-channel grants are ignored', () => {
  const data = fixture(); data.messagingGrants.push({ studentId: id('Sophie'), recipientId: id('Guardian'), channel: 'email', active: true })
  assert.match(resolve(data, ['Sophie']).excluded[0].reason, /Multiple authorised/)
  data.messagingGrants[2].active = false
  assert.equal(resolve(data, ['Sophie']).recipients.length, 1)
  assert.equal(resolve(data, ['Sophie'], 'sms').recipients.length, 0)
})
test('minors and unverified ages never use direct contact details as fallback', () => {
  for (const age of [true, null]) {
    const data = fixture(), person = data.people.find(person => person.name === 'Sophie'); person.routing = 'direct'; person.isMinor = age
    assert.equal(resolve(data, ['Sophie']).recipients.length, 0)
  }
  const data = fixture(); data.people[0].email = ''
  assert.equal(resolve(data, ['Sophie']).recipients.length, 0)
  data.messagingGrants[0].recipientId = id('Ethan')
  assert.match(resolve(data, ['Sophie']).excluded[0].reason, /Adult messaging recipient/)
})
test('adult students route directly; unknown selections fail instead of shrinking the audience', () => {
  assert.equal(resolve(fixture(), ['Alex']).recipients[0].name, 'Alex')
  assert.throws(() => resolve(fixture(), ['foreign']))
})
test('opt-outs suppress selected students, adult recipients and shared destinations', () => {
  for (const name of ['Sophie', 'Sam']) {
    const data = fixture(); data.people.find(person => person.name === name).optedOut = true
    assert.equal(resolve(data, ['Sophie']).recipients.length, 0)
  }
  const data = fixture(); const unlinked = data.people.find(person => person.name === 'Unlinked'); unlinked.email = data.people[0].email; unlinked.optedOut = true
  assert.equal(resolve(data, ['Sophie']).recipients.length, 0)
  const sibling = fixture(); sibling.people.find(person => person.name === 'Ethan').optedOut = true
  assert.equal(resolve(sibling, ['Sophie']).recipients.length, 0)
})
test('shared destination with different adult identities is blocked rather than mislabelled', () => {
  const data = fixture(); data.people.find(person => person.name === 'Alex').email = data.people[0].email
  const result = resolve(data, ['Sophie', 'Alex'])
  assert.equal(result.recipients.length, 0); assert.equal(result.excluded.length, 2)
})
test('SMS proposals require channel-specific grants and normalize the adult destination', () => {
  const data = fixture(); data.people[0].phone = '(202) 555-0101'
  data.messagingGrants.push({ studentId: id('Sophie'), recipientId: id('Sam'), channel: 'sms', active: true })
  assert.equal(resolve(data, ['Sophie'], 'sms').recipients[0].destination, '+12025550101')
})

module.exports = { fixture }