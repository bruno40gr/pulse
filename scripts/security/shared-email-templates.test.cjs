/* eslint-disable @typescript-eslint/no-require-imports -- Offline fixtures, no provider access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const h = createHarness()
const { headlinerEmailTemplates: templates, fillOutreachTemplate: fill, unresolvedEmailPlaceholders: unresolved } = h.load('lib/headliner-email-templates.ts')

test('four approved shared templates replace sample outreach, preserving contact details and closings', () => {
  assert.deepEqual(Array.from(templates, template => template.name), ['2-Day Contact', '5-Day Contact', 'One Week Contact', 'META Lead / Generic Email'])
  for (const template of templates) {
    assert.match(template.body, /435-1300/)
    assert.match(template.body, /voicemail|by phone/)
    assert.doesNotMatch(template.body, /\[ADMIN NAME\]|\[ADMIN TITLE\]/)
  }
  assert.match(templates[0].body, /Warm regards,$/)
  assert.match(templates[1].body, /All my best,$/)
  assert.match(templates[2].body, /Sincerely,$/)
  assert.match(templates[3].body, /Warm Regards,$/)
  assert.doesNotMatch(templates[3].body, /\[CHILD|\[INSTRUMENT|\[SON/)
})

test('personalization fills known names and never guesses instrument, child, or pronouns', () => {
  const filled = fill(templates[1].body, { name: 'Alex Rivera', student: 'Sam' })
  assert.match(filled, /Hello Alex Rivera,/)
  assert.match(filled, /lessons for Sam/)
  assert.deepEqual(Array.from(unresolved(filled)), ['[INSTRUMENT]', '[SON/DAUGHTER]'])
  assert.match(fill(templates[0].body), /\[MEMBER’S NAME\]/)
  assert.match(fill(templates[0].body, { name: 'Alex', student: '' }), /\[CHILD’S NAME\]/)
  assert.equal(unresolved(fill(templates[3].body, { name: 'Alex', student: '' })).length, 0)
})

function routeFor(tenant, permission = true) {
  const harness = createHarness()
  harness.setScenario({ authUser: { id: 'user' }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: tenant, auth_user_id: 'user', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: tenant, key: 'staff' }],
    role_permissions: permission ? [{ role_id: 'role', permission_id: 'read' }] : [],
    permissions: [{ id: 'read', key: 'communications.read' }],
  } })
  return harness.load('app/api/conversations/templates/route.ts')
}
test('any Headliner communications reader can access shared templates without settings-management permission', async () => {
  const response = await routeFor(HEAD).GET(new Request(`http://synthetic.invalid/api/conversations/templates?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).templates.length, 4)
})
test('other schools do not receive Headliner templates and unauthorized readers are denied', async () => {
  const other = '00000000-0000-0000-0000-000000000003'
  const response = await routeFor(other).GET(new Request(`http://synthetic.invalid/api/conversations/templates?tenant=${other}`))
  assert.equal((await response.json()).templates.length, 0)
  assert.equal((await routeFor(HEAD, false).GET(new Request(`http://synthetic.invalid/api/conversations/templates?tenant=${HEAD}`))).status, 403)
})