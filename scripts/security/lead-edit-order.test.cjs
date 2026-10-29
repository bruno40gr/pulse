/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

function setup(viewer = 'author') {
  const h = createHarness()
  const payload = { text: 'Original', actor: { personId: 'author', displayName: 'Old name' }, custom: 'retained' }
  h.setScenario({
    actor: { personId: viewer, instructorId: null, displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, is_demo: true }],
      people: [{ id: 'author', tenant_id: HEAD, first_name: 'Lorena', last_name: 'Rudha' }],
      lead_intakes: [{ id: 'lead', tenant_id: HEAD, contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'new', payload: { message: 'Initial' }, created_at: '2026-10-01T00:00:00Z' }],
      lead_events: [{ id: 'note', tenant_id: HEAD, lead_intake_id: 'lead', event_type: 'note_added', payload, created_at: '2026-10-02T00:00:00Z' }],
    },
    // The synthetic builder compares object references; emulate JSONB equality
    // only for this fenced update, while asserting the actual serialized filter.
    queryResult: q => q.operation === 'update' && q.table === 'lead_events' ? { data: { id: 'note' }, error: null } : undefined,
  })
  const route = h.load('app/api/leads/[id]/route.ts')
  const patch = edit_note => route.PATCH(new Request('https://synthetic.invalid/api/leads/lead', { method: 'PATCH', body: JSON.stringify({ edit_note }) }), { params: Promise.resolve({ id: 'lead' }) })
  return { h, route, patch, payload }
}

test('manual and website leads use the same newest-first default, with no sticky manual pin', () => {
  const { compareNewestLead } = createHarness().load('lib/lead-table-order.ts')
  const rows = [{ source_system: 'pulse-manual', created_at: '2026-10-01' }, { source_system: 'headliner-website', created_at: '2026-10-03' }, { source_system: 'pulse-manual', created_at: '2026-10-02' }]
  assert.deepEqual(rows.sort(compareNewestLead).map(row => row.created_at), ['2026-10-03', '2026-10-02', '2026-10-01'])
})

test('note author is resolved by tenant-scoped person identity and gets Lorena portrait without an alias', async () => {
  const { h, route } = setup()
  const r = await route.GET(new Request('https://synthetic.invalid/api/leads/lead'), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal(r.status, 200)
  const note = (await r.json()).notes_history.find(n => n.id === 'note')
  assert.equal(note.actor_name, 'Lorena Rudha')
  assert.match(note.actor_avatar_url, /9fd46acb-1557-437d-8776-5c969e96687f/)
  assert.ok(h.getQueries().find(q => q.table === 'people').filters.some(f => f[1] === 'tenant_id' && f[2] === HEAD))
})

test('editing preserves original author, adds revision and fences payload without replaying automation', async () => {
  const { h, patch, payload } = setup()
  assert.equal((await patch({ id: 'note', text: ' Corrected ', previous_text: 'Original' })).status, 200)
  const write = h.getWrites().find(q => q.table === 'lead_events')
  assert.equal(write.payload.payload.text, 'Corrected')
  assert.deepEqual(write.payload.payload.actor, payload.actor)
  assert.equal(write.payload.payload.revisions[0].text, 'Original')
  assert.ok(write.filters.some(f => f[1] === 'payload' && f[2] === JSON.stringify(payload)))
  assert.equal(h.getWrites().length, 1)
})

test('blank, missing, stale and cross-lead notes cannot be edited', async () => {
  for (const [edit, status] of [
    [{ id: 'note', text: ' ', previous_text: 'Original' }, 400],
    [{ id: 'foreign-note', text: 'Changed', previous_text: 'Original' }, 404],
    [{ id: 'note', text: 'Changed', previous_text: 'Stale' }, 409],
  ]) {
    const { h, patch } = setup()
    assert.equal((await patch(edit)).status, status)
    assert.equal(h.getWrites().length, 0)
  }
})

test('initial inquiry message has no staff author and remains read-only', async () => {
  const { h, patch } = setup()
  assert.equal((await patch({ id: 'intake-message-lead', text: 'Corrected initial', previous_text: 'Initial' })).status, 403)
  assert.equal(h.getWrites().length, 0)
})

test('another staff member cannot edit a note and does not receive an Edit capability', async () => {
  const { h, route, patch } = setup('someone-else')
  const r = await route.GET(new Request('https://synthetic.invalid/api/leads/lead'), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal((await r.json()).notes_history.find(note => note.id === 'note').editable, false)
  assert.equal((await patch({ id: 'note', text: 'Changed', previous_text: 'Original' })).status, 403)
  assert.equal(h.getWrites().length, 0)
})

test('authorship uses stable identity, never name or an owner role override', () => {
  const { isLeadNoteAuthor } = createHarness().load('lib/lead-notes.ts')
  assert.equal(isLeadNoteAuthor({ displayName: 'Same Name' }, { personId: 'owner' }), false)
  assert.equal(isLeadNoteAuthor({ personId: 'other' }, { personId: 'owner' }), false)
  assert.equal(isLeadNoteAuthor({ personId: 'author' }, { personId: 'author' }), true)
  assert.equal(isLeadNoteAuthor({ membershipId: 'membership' }, { personId: 'author', membershipId: 'membership' }), true)
  assert.equal(isLeadNoteAuthor({ personId: 'other', membershipId: 'membership' }, { personId: 'author', membershipId: 'membership' }), false)
})

test('authenticated staff without leads.manage cannot edit notes', async () => {
  const h = createHarness()
  h.setScenario({ authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'assistant' }],
    people: [{ id: 'staff', tenant_id: HEAD, first_name: 'Synthetic', last_name: 'Staff' }],
  } })
  const r = await h.load('app/api/leads/[id]/route.ts').PATCH(new Request('https://synthetic.invalid/api/leads/lead', {
    method: 'PATCH', body: JSON.stringify({ edit_note: { id: 'note', text: 'Changed', previous_text: 'Original' } }),
  }), { params: Promise.resolve({ id: 'lead' }) })
  assert.equal(r.status, 403)
  assert.equal(h.getWrites().length, 0)
})