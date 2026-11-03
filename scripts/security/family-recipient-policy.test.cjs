/* eslint-disable @typescript-eslint/no-require-imports -- Node synthetic fixtures. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { classifyStudentDestinations } = require('./family-recipient-policy.cjs')
const root = path.join(__dirname, '..', '..')

const T = 'school'
const person = (id, extra) => ({ id, tenant_id: T, first_name: id, last_name: 'Test', ...extra })
const account = (id, extra) => ({ id, tenant_id: T, name: id, ...extra })
const student = (id, personId, accountId) => ({ id, tenant_id: T, person_id: personId, account_id: accountId, is_minor: true, message_routing: 'account_holder' })

function fixture() {
  return {
    tenantId: T, previewTenantId: T,
    people: [
      person('adult', { email: 'parent@example.invalid' }),
      person('kid', { phone: '+15105550101' }),
      person('sib', { phone: '+15105550102' }),
      person('coach', { phone: '+15105550103' }),
      person('plain', { email: 'plain@example.invalid' }),
      person('kid3'), person('kid4'), person('kid5'), person('kid6'),
    ],
    accounts: [
      account('a-parent', { email: 'parent@example.invalid' }),
      account('a-kid', { phone: '+15105550101' }),
      account('a-sib', { phone: '+15105550102' }),
      account('a-coach', { phone: '+15105550103' }),
      account('a-plain', { email: 'plain@example.invalid' }),
      account('a-none'),
    ],
    instructors: [{ id: 'i1', tenant_id: T, person_id: 'coach' }],
    students: [
      student('s-parent', 'kid5', 'a-parent'),
      student('s-kid', 'kid', 'a-kid'),
      student('s-sib', 'kid3', 'a-sib'),
      student('s-sibling-self', 'sib', 'a-sib'),
      student('s-coach', 'kid4', 'a-coach'),
      student('s-plain', 'kid6', 'a-plain'),
      student('s-none', 'kid5', 'a-none'),
    ],
    preview: {
      metadata: { tenantId: T },
      contacts: [
        { sourcePersonId: 'src-adult', studentIds: ['s-parent'] },
        { sourcePersonId: 'src-sibling-manager', studentIds: ['s-sib'] },
        { sourcePersonId: 'src-coach', studentIds: ['s-coach'] },
        { sourcePersonId: 'src-missing', studentIds: ['s-plain'] },
        { sourcePersonId: 'src-member', studentIds: ['s-kid'] },
      ],
      students: [{ sourceClientId: 'src-sibling-manager' }],
    },
    sourceClients: [
      { Id: 'src-adult', 'Full Name': 'Adult Person' },
      { Id: 'src-member', 'Full Name': 'Member Person', Status: 'Member' },
      { Id: 'src-coach', 'Full Name': 'Coach Person' },
      { Id: 'src-sibling-manager', 'Full Name': 'Sibling Manager' },
      { Id: 'src-other', 'Full Name': 'Someone Else', 'Staff 1 name': 'Coach Person' },
    ],
    ownerDecisions: [],
  }
}
const find = (result, id) => result.decisions.find(row => row.studentId === id)

test('a destination duplicated on the student record is flagged for review, not called unsafe', () => {
  const row = find(classifyStudentDestinations(fixture()), 's-kid')
  assert.equal(row.status, 'review_destination_duplicates_student_record')
  assert.ok(row.reasons.includes('account_destination_is_students_own_details'))
  assert.equal(row.messagingAuthorized, false)
})

test('a sibling student owning the account destination is blocked', () => {
  const row = find(classifyStudentDestinations(fixture()), 's-sib')
  assert.equal(row.status, 'blocked_destination_owned_by_another_student')
  assert.ok(row.reasons.includes('account_destination_owned_by_another_student'))
})

test('an instructor-only destination requires an owner decision instead of guessing', () => {
  const row = find(classifyStudentDestinations(fixture()), 's-coach')
  assert.equal(row.status, 'owner_decision_required')
  assert.ok(row.reasons.includes('account_destination_owned_by_instructor_only'))
  assert.equal(row.guardianshipInferred, false)
})

test('missing manager source rows and student managers require review, not a merge', () => {
  const result = classifyStudentDestinations(fixture())
  assert.equal(find(result, 's-plain').status, 'owner_decision_required')
  assert.ok(find(result, 's-plain').reasons.includes('manager:manager_source_row_missing'))
  const sibling = find(result, 's-sib')
  assert.ok(sibling.reasons.includes('account_destination_owned_by_another_student'))
  assert.equal(find(result, 's-kid').managerClasses[0], 'manager_has_member_status')
})

test('an adult-looking manager is reported without inferring guardianship', () => {
  const row = find(classifyStudentDestinations(fixture()), 's-parent')
  assert.equal(row.status, 'no_blocking_signal_found_guardianship_not_inferred')
  assert.equal(row.guardianshipInferred, false)
  assert.equal(row.messagingAuthorized, false)
})

test('a student with no destination on file is blocked', () => {
  assert.equal(find(classifyStudentDestinations(fixture()), 's-none').status, 'blocked_no_destination_on_file')
})

test('owner approval covers an instructor-owned destination but never authorizes sending', () => {
  const data = fixture()
  data.ownerDecisions = [{ tenantId: T, studentId: 's-coach', personId: 'coach', action: 'approve_responsible_adult_destination', approvedBy: 'owner', reason: 'Owner confirmed this adult is the responsible contact.' }]
  const row = find(classifyStudentDestinations(data), 's-coach')
  assert.equal(row.status, 'owner_approved_adult_destination')
  assert.equal(row.ownerApprovalPresent, true)
  assert.equal(row.messagingAuthorized, false)
  assert.equal(row.activateMessaging, false)
})

test('owner approval cannot authorize a different destination or another tenant', () => {
  const data = fixture()
  data.ownerDecisions = [{ tenantId: T, studentId: 's-coach', personId: 'plain', action: 'approve_responsible_adult_destination', approvedBy: 'owner', reason: 'Wrong target on purpose.' }]
  assert.equal(find(classifyStudentDestinations(data), 's-coach').status, 'blocked_owner_decision_target_mismatch')
  data.ownerDecisions = [{ tenantId: 'foreign', studentId: 's-coach', personId: 'coach', action: 'approve_responsible_adult_destination', approvedBy: 'owner', reason: 'Foreign scope.' }]
  assert.throws(() => classifyStudentDestinations(data), /Invalid owner/)
})

test('approving a student person is refused and foreign rows fail closed', () => {
  const data = fixture()
  data.ownerDecisions = [{ tenantId: T, studentId: 's-coach', personId: 'sib', action: 'approve_responsible_adult_destination', approvedBy: 'owner', reason: 'Student target.' }]
  assert.throws(() => classifyStudentDestinations(data), /Invalid owner/)
  const foreign = fixture(); foreign.people[0].tenant_id = 'foreign'
  assert.throws(() => classifyStudentDestinations(foreign), /Foreign/)
})

test('classification is deterministic and does not mutate inputs', () => {
  const data = fixture(), before = JSON.stringify(data)
  assert.deepEqual(classifyStudentDestinations(data), classifyStudentDestinations(data))
  assert.equal(JSON.stringify(data), before)
})

test('delivery owns routing independently of table checkbox presentation', () => {
  const policy = fs.readFileSync(path.join(root, 'lib/communication-recipients.ts'), 'utf8')
  assert.match(policy, /export const routesToAccountHolder/)
  assert.match(policy, /students\.some\(routesToAccountHolder\)/)
  const views = fs.readFileSync(path.join(root, 'lib/contact-list-views.ts'), 'utf8')
  assert.doesNotMatch(views, /routesToAccountHolder|isMessageTarget/)
  // The rule itself must not be restated here; only the field types may appear.
  assert.doesNotMatch(views, /=== 'account_holder'/)
  assert.doesNotMatch(views, /is_minor === true/)
})
