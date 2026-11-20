/* eslint-disable @typescript-eslint/no-require-imports -- Offline tenant-isolated API fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const actor = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const noteId = '33333333-3333-4333-8333-333333333333'
const note = { id: noteId, tenant_id: HEAD, band_name: 'La Paz', body: 'Internal rehearsal context', is_private: false, completed_at: null, created_by_membership_id: actor }
function setup(options = {}) {
  const permissions = options.permissions || ['notes.read', 'notes.manage', 'contacts.read']
  const h = createHarness()
  h.setScenario({
    authUser: options.anonymous ? null : { id: 'auth' },
    env: options.disabled ? { ENABLE_CONTACT_BAND_OPPORTUNITIES: 'false' } : {},
    fixtures: {
      tenants: [{ id: HEAD }],
      tenant_memberships: [
        { id: actor, tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: options.status || 'active' },
        { id: other, tenant_id: HEAD, person_id: 'other-staff', role_id: 'recipient-role', status: 'active' },
      ],
      roles: [{ id: 'role', tenant_id: HEAD, key: options.role || 'staff' }, { id: 'recipient-role', tenant_id: HEAD, key: options.recipientRole || 'staff' }],
      permissions: permissions.map(key => ({ id: key, key })),
      role_permissions: [
        ...permissions.map(key => ({ role_id: 'role', permission_id: key })),
        ...permissions.map(key => ({ role_id: 'recipient-role', permission_id: key })),
      ],
      people: [{ id: 'staff', tenant_id: HEAD, first_name: 'Staff', last_name: 'Member' }],
      band_profiles: [{ tenant_id: HEAD, band_name: 'La Paz', status: 'active' }, { tenant_id: HEAD, band_name: 'SunKast', status: 'active' }, { tenant_id: DEMO, band_name: 'Foreign band', status: 'active' }],
      notes: [note, { ...note, id: 'other-band', band_name: 'SunKast' }, { ...note, id: 'private-note', is_private: true }, { ...note, id: 'general', band_name: null }, { ...note, id: 'foreign-note', tenant_id: DEMO }],
      note_participants: options.privateParticipant ? [{ tenant_id: HEAD, note_id: 'private-note', membership_id: actor }] : [],
      note_replies: [{ id: 'reply', tenant_id: HEAD, note_id: noteId, body: 'Internal reply' }, { id: 'foreign-reply', tenant_id: DEMO, note_id: noteId, body: 'Foreign reply' }],
    },
    errors: options.errors,
  })
  return h
}
const request = (url = '', method = 'GET', body) => new Request(`https://synthetic.invalid/api/notes${url}${url.includes('?') ? '&' : '?'}tenant=${HEAD}`, {
  method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
})
const params = id => ({ params: Promise.resolve({ id }) })

test('band notes list is band/tenant scoped and private participant rules still apply', async () => {
  for (const privateParticipant of [false, true]) {
    const h = setup({ privateParticipant })
    const response = await h.load('app/api/notes/route.ts').GET(request('?band=La%20Paz&show_done=true'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-Notes-Can-Manage'), 'true')
    assert.deepEqual((await response.json()).map(row => row.id), privateParticipant ? [noteId, 'private-note'] : [noteId])
    const query = h.getQueries().find(query => query.table === 'notes')
    assert.ok(query.filters.some(([op, key, value]) => op === 'eq' && key === 'tenant_id' && value === HEAD))
    assert.ok(query.filters.some(([op, key, value]) => op === 'eq' && key === 'band_name' && value === 'La Paz'))
  }
})

test('band note creation keeps canonical band context and rejects foreign/nonexistent bands', async () => {
  const h = setup()
  const response = await h.load('app/api/notes/route.ts').POST(request('', 'POST', { band_name: 'La Paz', body: 'Rehearse the bridge', note_date: '2026-11-20' }))
  assert.equal(response.status, 200)
  const write = h.getWrites().find(query => query.table === 'notes')
  assert.equal(write.payload.band_name, 'La Paz')
  assert.equal(write.payload.tenant_id, HEAD)
  assert.equal(write.payload.created_by_membership_id, actor)
  assert.equal(write.payload.is_private, false)
  for (const band of ['Foreign band', 'Missing band']) {
    const denied = setup()
    assert.equal((await denied.load('app/api/notes/route.ts').POST(request('', 'POST', { band_name: band, body: 'No' }))).status, 404)
    assert.equal(denied.getWrites().length, 0)
  }
})

test('family/student, inactive, anonymous, missing permission and feature-off callers cannot list or create band notes', async () => {
  for (const options of [{ role: 'family' }, { role: 'student' }, { role: 'parent' }, { status: 'suspended' }, { anonymous: true }, { permissions: ['notes.read', 'notes.manage'] }, { disabled: true }]) {
    const h = setup(options)
    const api = h.load('app/api/notes/route.ts')
    assert.ok([401, 403].includes((await api.GET(request('?band=La%20Paz'))).status), JSON.stringify(options))
    assert.ok([401, 403].includes((await api.POST(request('', 'POST', { band_name: 'La Paz', body: 'No' }))).status))
    assert.equal(h.getWrites().length, 0)
  }
})

test('general notes URLs never expose internal band notes to ineligible roles', async () => {
  for (const options of [{ role: 'family' }, { permissions: ['notes.read'] }, { disabled: true }]) {
    const h = setup(options)
    const response = await h.load('app/api/notes/route.ts').GET(request('?show_done=true'))
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).map(row => row.id), ['general'])
  }
})

test('direct edit/delete/reply URLs enforce internal access and never write for outsiders', async () => {
  for (const options of [{ role: 'family' }, { permissions: ['notes.read', 'notes.manage'] }, { disabled: true }, { permissions: ['contacts.read', 'notes.read'] }]) {
    const h = setup(options)
    const api = h.load('app/api/notes/[id]/route.ts')
    assert.ok([403, 404].includes((await api.PATCH(request(`/${noteId}`, 'PATCH', { body: 'No' }), params(noteId))).status))
    assert.ok([403, 404].includes((await api.DELETE(request(`/${noteId}`, 'DELETE'), params(noteId))).status))
    const replies = h.load('app/api/notes/[id]/replies/route.ts')
    assert.equal((await replies.POST(request(`/${noteId}/replies`, 'POST', { body: 'No' }), params(noteId))).status, 404)
    if (!options.permissions?.includes('contacts.read')) assert.equal((await replies.GET(request(`/${noteId}/replies`), params(noteId))).status, 404)
    assert.equal(h.getWrites().length, 0)
  }
})

test('staff can read/reply/edit and cannot move a note to another band with PATCH', async () => {
  const h = setup()
  const replies = h.load('app/api/notes/[id]/replies/route.ts')
  assert.deepEqual((await (await replies.GET(request(`/${noteId}/replies`), params(noteId))).json()).map(row => row.id), ['reply'])
  assert.equal((await replies.POST(request(`/${noteId}/replies`, 'POST', { body: 'Good rehearsal' }), params(noteId))).status, 201)
  const response = await h.load('app/api/notes/[id]/route.ts').PATCH(request(`/${noteId}`, 'PATCH', { body: 'Updated', band_name: 'SunKast' }), params(noteId))
  assert.equal(response.status, 200)
  const update = h.getWrites().find(query => query.table === 'notes' && query.operation === 'update')
  assert.equal(update.payload.band_name, undefined)
})

test('internal note mentions never send previews to family recipients', async () => {
  const h = setup({ recipientRole: 'family' })
  const response = await h.load('app/api/notes/route.ts').POST(request('', 'POST', { band_name: 'La Paz', body: '@Family internal context', mention_membership_ids: [other] }))
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
  const reply = await h.load('app/api/notes/[id]/replies/route.ts').POST(request(`/${noteId}/replies`, 'POST', { body: 'No preview', mention_membership_ids: [other] }), params(noteId))
  assert.equal(reply.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('foreign notes and private-note outsiders cannot read replies or mutate by ID', async () => {
  const h = setup()
  for (const id of ['foreign-note', 'private-note']) {
    const api = h.load('app/api/notes/[id]/route.ts')
    assert.equal((await api.PATCH(request(`/${id}`, 'PATCH', { body: 'No' }), params(id))).status, 404)
    assert.equal((await api.DELETE(request(`/${id}`, 'DELETE'), params(id))).status, 404)
    const replies = h.load('app/api/notes/[id]/replies/route.ts')
    assert.equal((await replies.GET(request(`/${id}/replies`), params(id))).status, 404)
    assert.equal((await replies.POST(request(`/${id}/replies`, 'POST', { body: 'No' }), params(id))).status, 404)
  }
  assert.equal(h.getWrites().length, 0)
})

test('task assignment to family recipients cannot reveal private band-note history', async () => {
  const h = setup({ recipientRole: 'family' })
  const follow_up = { description: 'Internal task', ownerId: other, personId: null, dueDate: '2026-12-01' }
  const response = await h.load('app/api/notes/route.ts').POST(request('', 'POST', { band_name: 'La Paz', body: 'Internal', is_private: true, follow_up }))
  assert.equal(response.status, 400)
  const update = await h.load('app/api/notes/[id]/route.ts').PATCH(request(`/${noteId}`, 'PATCH', { follow_up }), params(noteId))
  assert.equal(update.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('read-only staff receive read-only capability; roster failures fail closed', async () => {
  const h = setup({ permissions: ['contacts.read', 'notes.read'] })
  const response = await h.load('app/api/notes/route.ts').GET(request('?band=La%20Paz'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('X-Notes-Can-Manage'), 'false')
  const failed = setup({ errors: { enrollments: { message: 'offline' } } })
  assert.equal((await failed.load('app/api/notes/route.ts').POST(request('', 'POST', { band_name: 'La Paz', body: 'No' }))).status, 500)
  assert.equal(failed.getWrites().length, 0)
})

test('band notes reuse the actual notes composition and migration preserves rename/history boundaries', () => {
  const source = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
  assert.match(source('components/bands/ProductionBandsWorkspace.tsx'), /<BandNotes[^>]+bandName=\{band.name\}/)
  const bandNotes = source('components/bands/BandNotes.tsx')
  assert.match(bandNotes, /<NotesSection/)
  assert.doesNotMatch(bandNotes, /DashboardNotes|ColorSwatch|noteBackground/)
  const notes = source('components/notes/DashboardNotes.tsx')
  assert.match(notes, /band_name: bandName/)
  assert.match(notes, /readOnly=\{!canWrite\}/)
  const migration = source('supabase/migrations/202611210002_band_notes.sql')
  assert.match(migration, /FOREIGN KEY \(tenant_id, band_name\)/)
  assert.match(migration, /ON UPDATE CASCADE ON DELETE RESTRICT/)
  assert.match(migration, /REVOKE ALL.*notes.*note_replies FROM anon, authenticated/)
})