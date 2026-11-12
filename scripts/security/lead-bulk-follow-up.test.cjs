/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic TypeScript VM harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(read('lib/lead-bulk-follow-up.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject })
const { followUpPatch, updateLeadFollowUps } = exportsObject
const plain = value => JSON.parse(JSON.stringify(value))
test('bulk follow-up only patches edited fields; clearing is explicit null', () => {
  const draft = { date: '', reminder: '', dateChanged: false, reminderChanged: false }
  assert.deepEqual(plain(followUpPatch(draft)), {})
  assert.deepEqual(plain(followUpPatch({ ...draft, reminder: '  Call tomorrow  ', reminderChanged: true })), { follow_up_note: 'Call tomorrow' })
  assert.deepEqual(plain(followUpPatch({ ...draft, dateChanged: true })), { follow_up_at: null })
  assert.deepEqual(plain(followUpPatch({ ...draft, reminderChanged: true })), { follow_up_note: null })
  const patch = followUpPatch({ ...draft, date: '2026-12-18', dateChanged: true })
  assert.equal(new Date(patch.follow_up_at).getDate(), 18)
  assert.equal('follow_up_note' in patch, false)
  assert.throws(() => followUpPatch({ ...draft, date: '2026-02-30', dateChanged: true }), /valid/)
})
test('bulk follow-up reports partial failures and retries only failed targets', async () => {
  const calls = [], patch = { follow_up_note: null }
  const result = await updateLeadFollowUps(['a', 'b', 'c'], patch, async (id, value) => {
    calls.push({ id, value }); if (id === 'b') throw new Error('Denied')
  })
  assert.deepEqual(plain(result.succeeded), ['a', 'c'])
  assert.deepEqual(plain(result.failed.map(item => item.id)), ['b'])
  const retried = []
  await updateLeadFollowUps(result.failed.map(item => item.id), patch, async id => { retried.push(id) })
  assert.deepEqual(retried, ['b'])
  assert.equal(calls.every(item => item.value === patch), true)
})
test('bulk UI uses simple mixed-value fields and snapshots original failed patch', () => {
  const panel = read('components/leads/LeadBulkFollowUpPanel.tsx')
  assert.match(panel, /title="Update follow up"/)
  assert.match(panel, /Mixed — selected leads have different dates/)
  assert.match(panel, /\? 'Mixed'/)
  assert.match(panel, /retry\?\.patch \|\| followUpPatch/)
  assert.match(panel, /disabled=\{saving \|\| !!retry\}/)
  assert.match(panel, /<Select label="Quick pick"/)
  assert.match(panel, /label="Date"/)
  assert.match(panel, /label="Reminder note"/)
  assert.match(panel, /'Update follow'/)
  assert.doesNotMatch(panel, /Internal reminder only/)
})
test('deletion is owner-only server side and follow-up changes require manage permission', () => {
  const route = read('app/api/leads/route.ts').split('export async function DELETE')[1]
  assert.match(route, /await requireOwner\(request, tenantId\)/)
  assert.doesNotMatch(route, /PERMISSIONS.leadsDelete/)
  const detail = read('app/api/leads/[id]/route.ts')
  assert.match(detail, /roleKey !== 'owner' && !tenantAccess.context.permissions.has\(PERMISSIONS.leadsManage\)/)
  assert.match(detail, /'follow_up_note' in \(body.payload as Record<string, unknown>\)/)
})

const { createHarness, HEAD } = require('./synthetic-harness.cjs')
function authorizedHarness(role, manage = false) {
  const h = createHarness()
  h.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: role }],
    role_permissions: [{ role_id: 'role', permission_id: 'delete' }, ...(manage ? [{ role_id: 'role', permission_id: 'manage' }] : [])],
    permissions: [{ id: 'delete', key: 'leads.delete' }, { id: 'manage', key: 'leads.manage' }],
    people: [{ id: 'staff', tenant_id: HEAD, first_name: 'Synthetic', last_name: 'Staff' }],
    crm_contacts: [{ id: 'contact', tenant_id: HEAD, full_name: 'Synthetic' }],
    lead_intakes: [{ id: 'lead', tenant_id: HEAD, contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'contacted', payload: { follow_up_at: '2026-12-01T12:00:00Z', follow_up_note: 'Keep', custom: 'preserved' } }],
  } })
  return h
}
for (const role of ['assistant', 'admin', 'owner']) {
  test(`bulk delete ${role}: only owner can delete even with leads.delete`, async () => {
    const h = authorizedHarness(role)
    const response = await h.load('app/api/leads/route.ts').DELETE(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}`, { method: 'DELETE', body: JSON.stringify({ ids: ['lead'], intake_type: 'lesson_inquiry' }) }))
    assert.equal(response.status, role === 'owner' ? 200 : 403)
    if (role !== 'owner') assert.equal(h.getWrites().length, 0)
  })
}
test('follow-up PATCH rejects unauthorized staff before writes', async () => {
  const h = authorizedHarness('assistant')
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/lead', { method: 'PATCH', body: JSON.stringify({ payload: { follow_up_note: 'Denied' } }) }), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal(response.status, 403)
  assert.equal(h.getWrites().length, 0)
})
test('reminder-only PATCH preserves date and payload and logs follow-up activity', async () => {
  const h = authorizedHarness('assistant', true)
  const response = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/lead', { method: 'PATCH', body: JSON.stringify({ payload: { follow_up_note: 'Changed' } }) }), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal(response.status, 200)
  const payload = h.getWrites().find(write => write.table === 'lead_intakes' && write.operation === 'update').payload.payload
  assert.equal(payload.follow_up_at, '2026-12-01T12:00:00Z')
  assert.equal(payload.follow_up_note, 'Changed')
  assert.equal(payload.custom, 'preserved')
  assert.equal(h.getWrites().some(write => write.table === 'lead_events' && write.payload.event_type === 'follow_up_scheduled'), true)
})

for (const payload of [{ follow_up_at: 'not-a-date' }, { follow_up_note: 42 }, { follow_up_note: 'x'.repeat(12001) }]) {
  test(`follow-up PATCH validates ${Object.keys(payload)[0]} before writing`, async () => {
    const h = authorizedHarness('owner')
    const response = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/lead', { method: 'PATCH', body: JSON.stringify({ payload }) }), { params: Promise.resolve({ id: 'lead' }) })
    assert.equal(response.status, 400)
    assert.equal(h.getWrites().length, 0)
  })
}