/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup({ anonymous = false, foreign = false, instructor = false, error = false } = {}) {
  const h = createHarness()
  h.setScenario({
    actor: anonymous ? null : { personId: 'staff', displayName: 'Demo', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      people: [{ id: 'contact', tenant_id: foreign ? DEMO : HEAD, first_name: 'Fictional', last_name: 'Contact', custom_fields: {}, students: [] }],
      instructors: instructor ? [{ id: 'teacher', tenant_id: HEAD, person_id: 'contact' }] : [],
      enrollments: [],
    },
    errors: error ? { people: { message: 'Synthetic failure' } } : {},
  })
  return { h, get: async () => {
    const cookie = anonymous ? '' : `pulse_access=${await h.load('lib/access.ts').createAccessSession({
      instructorId: 'synthetic-teacher', personId: 'staff', displayName: 'Demo', access: { kind: 'demo', tenantId: HEAD },
    })}`
    return h.load('app/api/contacts/[id]/route.ts').GET(
    new Request(`http://synthetic.invalid/api/contacts/contact?tenant=${HEAD}`, { headers: { cookie } }),
    { params: Promise.resolve({ id: 'contact' }) },
  ) } }
}

test('contact detail includes stage timing without changing payload or adding writes', async () => {
  const { h, get } = setup()
  const response = await get()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.id, 'contact')
  assert.equal(body.first_name, 'Fictional')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.ok(response.headers.get('x-request-id'))
  for (const stage of ['record', 'access', 'instructor', 'total']) {
    assert.match(response.headers.get('server-timing'), new RegExp(`(?:^|, )${stage};dur=\\d+`))
  }
  assert.equal(h.getQueries().length, 2, 'Only existing person and instructor queries')
  assert.equal(h.getWrites().length, 0)
})

test('instructor enrichment has separate timing', async () => {
  const response = await setup({ instructor: true }).get()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('server-timing'), /students;dur=\d+/)
  assert.equal((await response.json()).staff_id, 'teacher')
})

for (const options of [{ anonymous: true }, { foreign: true }]) {
  test(`contact timing preserves access denial: ${JSON.stringify(options)}`, async () => {
    const { get, h } = setup(options)
    const response = await get()
    assert.ok([401, 403].includes(response.status))
    assert.equal((await response.json()).first_name, undefined)
    assert.match(response.headers.get('server-timing'), /access;dur=\d+/)
    assert.equal(h.getQueries().some(query => query.table === 'instructors'), false)
    assert.equal(h.getWrites().length, 0)
  })
}

test('failed contact query retains error behavior and timing', async () => {
  const response = await setup({ error: true }).get()
  assert.equal(response.status, 500)
  assert.equal((await response.json()).error, 'Synthetic failure')
  assert.match(response.headers.get('server-timing'), /record;dur=\d+/)
})

test('shared timing measures failures and parallel work without adding stage durations', async () => {
  const timing = createHarness().load('lib/detail-request-timing.ts').createDetailRequestTiming()
  await assert.rejects(timing.measure('failed', async () => { throw new Error('Expected') }), /Expected/)
  await Promise.all(['first', 'second'].map(name => timing.measure(name, async () => 'ok')))
  for (const name of ['failed', 'first', 'second']) assert.equal(typeof timing.timings[name], 'number')
  assert.match(timing.responseHeaders()['Server-Timing'], /total;dur=\d+/)
})