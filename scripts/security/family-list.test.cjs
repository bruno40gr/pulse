/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic fixtures only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, require(id) {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  return loaded.exports
}
const { groupContactFamilies, inquiryStudents } = load('lib/family-list.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const reviewContacts = require('./fixtures/contact-list-review.cjs')
const recipients = load('lib/communication-recipients.ts')
// Load the real routing rule, not a stub: Contacts must use what delivery uses.
const { contactViewGroups } = load('lib/contact-list-views.ts', { './family-list': { groupContactFamilies }, './communication-recipients': recipients })
test('family groups preserve ascending and descending contact sort instead of fixture order', () => {
  const ascending = [...reviewContacts].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
  for (const matches of [ascending, [...ascending].reverse()]) {
    const ranks = new Map(matches.map((contact, index) => [contact.id, index]))
    const groups = contactViewGroups(matches, reviewContacts, 'family')
    const positions = groups.map(group => Math.min(...group.selectionRows.map(contact => ranks.get(contact.id))))
    assert.deepEqual(plain(positions), [...positions].sort((a, b) => a - b))
    assert.equal(groups[0].selectionRows.some(contact => contact.id === matches[0].id), true)
  }
  assert.equal(contactViewGroups(ascending, reviewContacts, 'family')[0].parent.id, 'mock-jules')
})
test('grouping preserves all roles and solo contacts with each family head shown once', () => {
  const flat = contactViewGroups(reviewContacts, reviewContacts, 'none')
  assert.equal(flat.length, reviewContacts.length)
  assert.deepEqual(plain(flat.map(group => group.parent.id)), reviewContacts.map(contact => contact.id))
  const families = contactViewGroups(reviewContacts, reviewContacts, 'family')
  const shown = families.flatMap(group => [group.parent, ...group.members.filter(member => member.id !== group.parent?.id)].filter(Boolean))
  assert.equal(shown.length, reviewContacts.length)
  assert.equal(new Set(shown.map(contact => contact.id)).size, reviewContacts.length)
  for (const id of ['mock-avery', 'mock-morgan', 'mock-robin', 'mock-drew']) assert.ok(families.some(group => group.parent?.id === id))
  const ethan = reviewContacts.find(contact => contact.id === 'mock-ethan')
  const result = contactViewGroups([ethan], reviewContacts, 'family')
  assert.equal(result.length, 1)
  assert.equal(result[0].parent.id, 'mock-sam')
  // A matched minor cannot receive, so the Kim account holders carry the selection.
  assert.deepEqual(plain(result[0].selectionRows.map(contact => contact.id)), ['mock-sam', 'mock-jamie'])
  assert.deepEqual(plain(contactViewGroups([ethan], reviewContacts, 'none')[0].selectionRows), [])
  assert.ok(result[0].members.some(contact => contact.id === 'mock-sophie'))
  assert.deepEqual(plain(contactViewGroups([ethan], reviewContacts, 'none')[0].members.map(contact => contact.id)), ['mock-ethan'])
})
test('Contacts groups only explicit account IDs, retaining every real selectable contact', () => {
  const rows = [
    { id: 'emma', account_id: 'family', account_holder_name: 'Jane' },
    { id: 'noah', account_id: 'family', account_holder_name: 'Jane' },
    { id: 'other', account_id: 'another', account_holder_name: 'Jane' },
    { id: 'unlinked', account_holder_name: 'Jane' },
    { id: 'staff', account_id: 'family', account_holder_name: 'Jane', staff_id: 'staff' },
    { id: 'booking', account_id: 'family', account_holder_name: 'Jane', custom_fields: { contact_kind: 'booking' } },
  ]
  const groups = groupContactFamilies(rows)
  assert.equal(groups.length, 5)
  assert.deepEqual(plain(groups[0].members.map(row => row.id)), ['emma', 'noah'])
  assert.equal(groups[0].holder, 'Jane')
  assert.equal(groups[2].holder, null)
  assert.equal(groups.flatMap(group => group.members).length, rows.length)
  assert.deepEqual(plain(groupContactFamilies([rows[1]])[0].members), [rows[1]], 'Filtered-out siblings are not silently selected')
})
test('explicit accounts group even when a holder name is missing; pagination never splits siblings', () => {
  const rows = [{ id: 'one', account_id: 'a' }, { id: 'solo' }, { id: 'two', account_id: 'a' }]
  const groups = groupContactFamilies(rows)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].holder, 'Account holder')
  assert.deepEqual(plain(groups.slice(0, 1).flatMap(group => group.members.map(row => row.id))), ['one', 'two'])
})
test('Contacts uses atomic filtered-family selection, keeping drawers and transport unchanged', () => {
  const page = fs.readFileSync(path.join(root, 'app/dashboard/contacts/page.tsx'), 'utf8')
  assert.match(page, /contactViewGroups\(sortedDisplayed, contacts, contactView\)/)
  assert.match(page, /viewGroups\.slice\(\(currentPage - 1\) \* pageSize, currentPage \* pageSize\)/)
  assert.match(page, /isMessageTarget=\{isMessageTarget\}/)
  assert.doesNotMatch(page, /onToggleMembers/)
  assert.match(page, /if \(key === 'client_status'\) \{\s+if \(c.client_status !== val\) return false\s+continue/)
  assert.match(page, /<ContactSlidePanel/)
  assert.match(page, /sortedDisplayed\.findIndex\(row => row.id === contact.id\)/)
})
test('Leads uses canonical student requests, not duplicate legacy projections', () => {
  const students = inquiryStudents({ student_requests: [
    { name: 'Emma', program: 'Piano' }, { name: 'Noah', program: 'Drums' },
  ], student_name: 'Emma', siblings: [{ name: 'Noah' }] }, 'Jane')
  assert.deepEqual(plain(students.map(student => student.name)), ['Emma', 'Noah'])
  assert.equal(students[1].program, 'Drums')
  assert.deepEqual(plain(inquiryStudents({ student_requests: [], student_name: 'Old' }, 'Jane')), [])
})
test('self inquiries use contact identity; legacy siblings are displayed once', () => {
  assert.equal(inquiryStudents({ student_requests: [{ classes_for_myself: true, name: 'Old' }] }, 'Jane')[0].name, 'Jane')
  assert.equal(inquiryStudents({ student_requests: [{ classes_for_myself: true }] }, 'Jane')[0].self, true)
  assert.deepEqual(plain(inquiryStudents({ student_name: 'Emma', family_members: [{ name: 'Noah' }], siblings: [{ name: 'Noah' }] }, 'Jane').map(student => student.name)), ['Emma', 'Noah'])
  assert.deepEqual(plain(inquiryStudents({ student_requests: [null, {}, { name: '   ' }] }, 'Jane')), [])
})
test('SMS siblings with differently formatted manager phone receive one destination', () => {
  const { resolveCommunicationRecipients } = load('lib/communication-recipients.ts')
  const children = ['emma', 'noah'].map((id, index) => ({ id, first_name: id, phone: '+12025550999', students: [{ is_minor: true, accounts: { name: 'Jane', phone: index ? '+1 202 555 0101' : '(202) 555-0101' } }] }))
  const result = resolveCommunicationRecipients(children, 'sms')
  assert.equal(result.recipients.length, 1)
  assert.equal(result.recipients[0].destination, '+12025550101')
  assert.deepEqual(plain(result.recipients[0].contactIds), ['emma', 'noah'])
})