/* eslint-disable @typescript-eslint/no-require-imports -- Isolated API tests, no network or live writes. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const actor = '11111111-1111-4111-8111-111111111111'
const owner = '22222222-2222-4222-8222-222222222222'
const foreign = '33333333-3333-4333-8333-333333333333'
const noteId = '44444444-4444-4444-8444-444444444444'
const contactId = '55555555-5555-4555-8555-555555555555'
const task = { description: 'Call tomorrow\nKeep the original schedule.', ownerId: owner, dueDate: '2026-11-05', personId: null }
const note = { id: noteId, tenant_id: HEAD, title: 'Original', body: 'Context', color: 'yellow', pinned: true, is_private: true, follow_up: null }
function scenario(permissions = ['notes.read', 'notes.manage', 'contacts.read', 'leads.read']) {
  return {
    authUser: { id: 'auth' },
    fixtures: {
      tenants: [{ id: HEAD }],
      tenant_memberships: [
        { id: actor, tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' },
        { id: owner, tenant_id: HEAD, person_id: 'owner-person', role_id: 'role', status: 'active' },
        { id: foreign, tenant_id: 'other', status: 'active' },
      ],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }],
      role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })),
      permissions: permissions.map((key, i) => ({ id: String(i), key })),
      people: [{ id: 'staff', tenant_id: HEAD, first_name: 'Synthetic', last_name: 'Staff' }, { id: contactId, tenant_id: HEAD }],
      notes: [note],
      note_participants: [{ tenant_id: HEAD, note_id: noteId, membership_id: actor }],
    },
    rpcResults: { save_note_task: [{ ...note, follow_up: task }] },
  }
}
function setup(input = scenario()) { const h = createHarness(); h.setScenario(input); return h }
const patch = (h, body) => h.load('app/api/notes/[id]/route.ts').PATCH(new Request(`https://synthetic.invalid/api/notes/${noteId}?tenant=${HEAD}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: noteId }) })

test('task parsing checks actual calendar dates, description and identifiers', () => {
  const { parseNoteTask, noteDateOffset, mentionedTaskOwners } = setup().load('lib/note-tasks.ts')
  assert.equal(parseNoteTask(task).description, task.description)
  for (const change of [{ dueDate: '2026-02-30' }, { description: ' ' }, { ownerId: 'admin' }, { personId: 'fictional-person' }, { personId: undefined }]) {
    assert.throws(() => parseNoteTask({ ...task, ...change }))
  }
  assert.equal(noteDateOffset(2, new Date('2026-12-31T12:00:00')), '2027-01-02')
  const directory = [{ id: owner, name: 'Jordan Smith' }]
  for (const body of ['@', '@Unknown', 'name@Jordan Smith.com', '@Jordan Smithson']) assert.equal(mentionedTaskOwners(body, directory).length, 0)
  assert.equal(mentionedTaskOwners('@Jordan\u00a0Smith please call.', directory)[0].id, owner)
})
test('conversion updates the same note through an atomic participant-and-task function', async () => {
  const h = setup()
  const response = await patch(h, { follow_up: task })
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.id, noteId); assert.equal(saved.pinned, true); assert.equal(saved.is_private, true)
  assert.equal(saved.body, note.body); assert.equal(saved.color, note.color)
  const write = h.getWrites().find(q => q.table === 'save_note_task')
  assert.equal(write.payload.p_note_id, noteId)
  assert.equal(write.payload.p_actor_membership_id, actor)
  assert.equal(write.payload.p_task.ownerId, owner)
  assert.equal(h.getWrites().some(q => q.table === 'note_replies' || q.operation === 'delete'), false)
})
test('foreign and suspended owners are rejected before any writes', async () => {
  for (const invalidOwner of [foreign, owner]) {
    const input = scenario()
    if (invalidOwner === owner) input.fixtures.tenant_memberships[1].status = 'suspended'
    const h = setup(input)
    assert.equal((await patch(h, { follow_up: { ...task, ownerId: invalidOwner } })).status, 400)
    assert.equal(h.getWrites().length, 0)
  }
})
test('private note outsiders and missing manage permission cannot convert or delete', async () => {
  const outsider = scenario(); outsider.fixtures.note_participants = []
  for (const input of [outsider, scenario(['notes.read'])]) {
    const h = setup(input)
    assert.ok([403, 404].includes((await patch(h, { follow_up: task })).status))
    assert.equal(h.getWrites().length, 0)
    const response = await h.load('app/api/notes/[id]/route.ts').DELETE(new Request(`https://synthetic.invalid/api/notes/${noteId}?tenant=${HEAD}`, { method: 'DELETE' }), { params: Promise.resolve({ id: noteId }) })
    assert.ok([403, 404].includes(response.status))
    assert.equal(h.getWrites().length, 0)
  }
})
test('related person is tenant-scoped and linking requires record permission', async () => {
  const h = setup()
  assert.equal((await patch(h, { follow_up: { ...task, personId: `contact:${contactId}` } })).status, 200)
  const other = setup()
  assert.equal((await patch(other, { follow_up: { ...task, personId: `contact:${foreign}` } })).status, 400)
  assert.equal(other.getWrites().length, 0)
  const denied = setup(scenario(['notes.read', 'notes.manage']))
  assert.equal((await patch(denied, { follow_up: { ...task, personId: `contact:${contactId}` } })).status, 403)
  assert.equal(denied.getWrites().length, 0)
})
test('atomic assignment failure is surfaced rather than claiming success', async () => {
  const input = scenario(); input.rpcErrors = { save_note_task: { message: 'Synthetic transaction failure' } }
  assert.equal((await patch(setup(input), { follow_up: task })).status, 500)
})
test('task creation adds owner to private participants while keeping mention notifications', async () => {
  const h = setup()
  const response = await h.load('app/api/notes/route.ts').POST(new Request(`https://synthetic.invalid/api/notes?tenant=${HEAD}`, { method: 'POST', body: JSON.stringify({ title: 'New', body: '@Synthetic Staff call', is_private: true, note_date: '2026-11-04', follow_up: task, mention_membership_ids: [actor] }) }))
  assert.equal(response.status, 200)
  const participantWrite = h.getWrites().find(q => q.table === 'note_participants')
  assert.ok(participantWrite.payload.some(row => row.membership_id === owner))
  assert.ok(participantWrite.payload.some(row => row.membership_id === actor))
  assert.ok(h.getWrites().some(q => q.table === 'notes' && q.payload.follow_up?.ownerId === owner))
})
test('private note listing keeps participant checks and never exposes outsiders', async () => {
  const input = scenario(); input.fixtures.note_participants = []
  const response = await setup(input).load('app/api/notes/route.ts').GET(new Request(`https://synthetic.invalid/api/notes?tenant=${HEAD}&show_done=true`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).length, 0)
})