/* eslint-disable @typescript-eslint/no-require-imports -- Isolated repository contracts; no database/provider clients. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file, dependencies = {}) {
  const loaded = { exports: {} }
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ module: loaded, exports: loaded.exports, console: { warn() {}, error() {} }, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return loaded.exports
}
const presentation = load('lib/contact-presentation.ts')
const family = load('lib/family-list.ts')
const plain = value => JSON.parse(JSON.stringify(value))
test('known minors never display their personal destination or use it as fallback', () => {
  for (const patch of [{ is_minor: true }, { custom_fields: { is_minor: true } }]) {
    const person = { id: 'child', phone: '+12025550999', email: 'child@example.invalid', ...patch }
    const result = presentation.contactDestination(person)
    assert.equal(result.holder, true)
    assert.equal(result.phone, undefined)
    assert.equal(result.email, undefined)
  }
})
test('saved holder routing is honoured for adults too; equal numbers do not establish routing', () => {
  const person = { id: 'adult', is_minor: false, phone: '+12025550101', account_holder_phone: '+12025550101', message_routing: 'account_holder' }
  assert.equal(presentation.usesAccountHolder(person), true)
  assert.equal(presentation.contactDestination(person).phone, '+12025550101')
  assert.equal(presentation.usesAccountHolder({ ...person, message_routing: 'student' }), false)
})
test('holder/student is one explicitly identified person, retaining the actual student status', () => {
  const rows = [
    { id: 'child', tenant_id: 'a', account_id: 'family', account_holder_person_id: 'adult', is_minor: true, student_id: 'child-role' },
    { id: 'adult', tenant_id: 'a', account_id: 'family', account_holder_person_id: 'adult', is_minor: false, student_id: 'adult-role', client_status: 'active' },
  ]
  const group = family.groupContactFamilies(rows)[0]
  const holder = presentation.familyHolderPerson(group.members)
  assert.equal(holder.id, 'adult')
  assert.equal(holder.student_id, 'adult-role')
  assert.equal(holder.client_status, 'active')
  assert.deepEqual(plain(group.members.filter(person => person.id !== holder.id).map(person => person.id)), ['child'])
  assert.equal(presentation.familyHolderPerson([rows[0]]), undefined, 'Filtering out the holder never invents an active student')
})
test('names, destinations, conflicting holder IDs and foreign tenant identities cannot combine people', () => {
  const holder = { id: 'adult', tenant_id: 'a', first_name: 'Sam', account_holder_person_id: 'adult' }
  for (const child of [
    { id: 'child', tenant_id: 'b', account_holder_person_id: 'adult' },
    { id: 'child', tenant_id: 'a', account_holder_person_id: 'other' },
  ]) assert.equal(presentation.familyHolderPerson([holder, child]), undefined)
  assert.equal(presentation.familyHolderPerson([{ id: 'one', first_name: 'Sam', phone: 'same' }, { id: 'two', first_name: 'Sam', phone: 'same' }]), undefined)
  assert.equal(presentation.familyHolderPerson([{ ...holder, is_minor: true }]), undefined)
})
test('same account ID in different tenants never shares a visual group; staff/student roles coexist', () => {
  const rows = [
    { id: 'a', tenant_id: 'one', account_id: 'same', staff_id: 'teacher', student_id: 'learner', custom_fields: { contact_kind: 'instructor' } },
    { id: 'b', tenant_id: 'one', account_id: 'same', student_id: 'sibling' },
    { id: 'c', tenant_id: 'two', account_id: 'same', student_id: 'foreign' },
    { id: 'd', tenant_id: 'one', account_id: 'same', staff_id: 'only-teacher' },
  ]
  const groups = family.groupContactFamilies(rows)
  assert.equal(groups.length, 3)
  assert.deepEqual(plain(groups[0].members.map(row => row.id)), ['a', 'b'])
})
test('Contacts reuses Leads grouped primitive without tree indentation or avatar typography', () => {
  const adapter = fs.readFileSync(path.join(root, 'components/contacts/FamilyListTable.tsx'), 'utf8')
  assert.match(adapter, /groupedRows/)
  assert.match(adapter, /<RichDataTable/)
  assert.match(adapter, /getDetailRows=/)
  assert.doesNotMatch(adapter, /paddingLeft|↳/)
  assert.doesNotMatch(adapter, /Chevron|aria-expanded=/)
  assert.match(adapter, /<TablePersonName onOpen=/)
  assert.match(adapter, /<TablePersonName detail=\{!member.isAccountHolder\} onOpen=/)
  assert.doesNotMatch(adapter, /paddingInlineStart/)
  const page = fs.readFileSync(path.join(root, 'app/dashboard/contacts/page.tsx'), 'utf8')
  assert.doesNotMatch(page, /<Avatar|<House/)
  assert.doesNotMatch(page, /Via /)
  assert.match(page, /weight=.*'semibold'.*'normal'/)
  const panel = fs.readFileSync(path.join(root, 'components/contacts/ContactSlidePanel.tsx'), 'utf8')
  assert.match(panel, /holderRouting \? <Button/)
  assert.match(panel, /disabled=\{!contactPhone \|\| !onCompose\}/)
  assert.doesNotMatch(panel, /contactPhone && contactPhone !== contact.phone \? <Button/)
})
test('list API exposes real student roles, tenant-scoped holder mappings and safe legacy fallback', async () => {
  const queries = []
  let holderFailure = false, denied = false
  const people = [{ id: 'adult', tenant_id: 'tenant', first_name: 'Sam', last_name: 'Kim', custom_fields: {}, students: [{ id: 'student-role', account_id: 'family', client_status: 'active', accounts: { name: 'Sam Kim' }, enrollments: [] }] }, { id: 'not-student', tenant_id: 'tenant', custom_fields: {}, students: [] }]
  const db = { from(table) {
    const query = { table, filters: [] }; queries.push(query)
    const result = () => ({ data: table === 'people' ? people : table === 'account_holders' ? [{ tenant_id: 'tenant', account_id: 'family', person_id: 'adult' }, { tenant_id: 'foreign', account_id: 'family', person_id: 'intruder' }] : [], error: table === 'account_holders' && holderFailure ? { code: 'PGRST200' } : null })
    const chain = { select(value) { query.select = value; return this }, eq(...args) { query.filters.push(args); return this }, in(...args) { query.filters.push(args); return this }, order() { return this }, range() { return this }, is() { return this }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) } }
    return chain
  } }
  const route = load('app/api/contacts/route.ts', {
    '@/lib/permissions': { PERMISSIONS: { contactsRead: 'contacts.read' } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => denied ? { ok: false, status: 403, error: 'Denied' } : { ok: true, tenantId: 'tenant' } },
    'next/server': { NextResponse: { json: value => value } },
    '@/lib/supabase/admin': { supabaseAdmin: db }, '@/lib/csv-parser': {}, '@/lib/instructors': {},
    '@/lib/demo-contact-enrichment': { enrichDemoContact: value => value }, '@/lib/import-profile': {
      getImportProfile: async () => ({ active_statuses: ['active', 'member'], inactive_statuses: ['lost'] }),
      classifyStatus: status => ['active', 'member'].includes(status.toLowerCase()) ? 'active' : 'inactive',
    },
    '@/lib/contact-kind': { isNonStudentBooking: () => false },
  })
  const result = await route.GET({})
  assert.equal(result[0].student_id, 'student-role')
  assert.equal(result[0].is_student, true)
  assert.equal(result[0].status_class, 'active')
  assert.equal(result[0].account_holder_person_id, 'adult')
  assert.equal(result[1].is_student, false)
  assert.equal(result[1].student_id, null)
  const holderQuery = queries.find(query => query.table === 'account_holders')
  assert.ok(holderQuery.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant'))
  assert.equal(queries.filter(query => query.table === 'account_holders').length, 1, 'Batched, not a per-row request')
  holderFailure = true
  const legacy = await route.GET({})
  assert.equal(legacy[0].account_holder_person_id, null, 'Unavailable optional relation does not guess holder identity')
  assert.equal(legacy[0].student_id, 'student-role')
  const before = queries.length
  denied = true
  assert.equal((await route.GET({})).error, 'Denied')
  assert.equal(queries.length, before, 'Denied users cannot trigger any domain lookups')
})