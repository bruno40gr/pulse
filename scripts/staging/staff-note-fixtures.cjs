/* eslint-disable @typescript-eslint/no-require-imports -- Guarded staging-only fixture tool. */
const fs = require('node:fs')
const { parseEnv } = require('node:util')
const assert = require('node:assert/strict')
const { createClient } = require('@supabase/supabase-js')
const { validateTarget } = require('./seed-users.cjs')

const TENANT = '00000000-0000-0000-0000-000000000001'
const STAFF = ['Josh Brent', 'Jessica Suase', 'Drew Johnson', 'Alyssa Abbott', 'Scott Gaona', 'Marshall James-Solano', 'Collin Franks', 'Noah Campos', 'Jacob Rogelstad', 'Vitto Trinchese', 'Isaias Pallib']
const FIXTURES = ['Scott Gaona', 'Bruno Wong', 'Jessica Suase', 'Josh Brent', 'Alyssa Abbott']
const SUFFIXES = ['000000000001', '000000000010', '000000000011', '000000000012', '000000000013']
const NOTES = [
  ['Tour follow-up', 'Please confirm the Rivera family’s Tuesday tour. Sofia is interested in Tiny Keys; ask whether the afternoon or evening works better.'],
  ['Saturday teaching schedule', 'Josh, please review the Saturday coverage with Jessica. Leave a reply here once the room assignments are confirmed.'],
  ['Little Rockers welcome', 'Prepare the welcome materials for the Bennett family. Check the student’s age and preferred start date before confirming enrollment.'],
  ['Family scheduling question', 'The Chen family would like back-to-back piano lessons. Please check availability before promising a time.'],
]
const REPLIES = ['I can cover the afternoon. Please confirm the family’s preferred time before we book it.', 'I checked the room schedule. Tuesday works; the evening slot still needs confirmation.', 'Thanks! I will follow up with the parent and add the outcome here.']

async function run(env) {
  validateTarget(env)
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  async function checked(query) {
    const { data, error } = await query
    if (error) throw new Error(`Staging fixture operation failed (${error.code})`)
    return data
  }
  assert.equal((await checked(db.from('twilio_config').select('id').limit(1))).length, 0, 'Provider configuration must remain empty')
  const instructors = await checked(db.from('instructors').select('person_id').eq('tenant_id', TENANT).order('id'))
  const people = await checked(db.from('people').select('id').eq('tenant_id', TENANT))
  for (const suffix of SUFFIXES) assert.ok(people.some(p => p.id === `10000000-0000-0000-0000-${suffix}`), 'Expected synthetic login identity missing')
  for (const [index, instructor] of instructors.entries()) {
    const fixtureIndex = SUFFIXES.findIndex(suffix => instructor.person_id === `10000000-0000-0000-0000-${suffix}`)
    const name = fixtureIndex >= 0 ? FIXTURES[fixtureIndex] : STAFF[index % STAFF.length]
    const [first_name, ...last] = name.split(' ')
    await checked(db.from('people').update({ first_name, last_name: last.join(' ') }).eq('id', instructor.person_id).eq('tenant_id', TENANT))
  }
  const members = await checked(db.from('tenant_memberships').select('id,person_id').eq('tenant_id', TENANT))
  const fixtureMembers = SUFFIXES.map(suffix => members.find(m => m.person_id === `10000000-0000-0000-0000-${suffix}`))
  assert.ok(fixtureMembers.every(Boolean), 'Expected synthetic memberships missing')
  const notes = await checked(db.from('notes').select('id').eq('tenant_id', TENANT).order('id').limit(1000))
  assert.ok(notes.length > 0 && notes.length < 1000, 'Unexpected note fixture size')
  for (const [index, note] of notes.entries()) {
    const author = index % FIXTURES.length
    const [title, body] = NOTES[index % NOTES.length]
    await checked(db.from('notes').update({ title, body, created_by: FIXTURES[author], created_by_membership_id: fixtureMembers[author].id, is_private: false, completed_at: null }).eq('id', note.id).eq('tenant_id', TENANT))
  }
  const replies = await checked(db.from('note_replies').select('id').eq('tenant_id', TENANT).order('id').limit(1000))
  assert.ok(replies.length < 1000, 'Unexpected reply fixture size')
  for (const [index, reply] of replies.entries()) {
    // All seeded reply authors have an existing, correctly named staff portrait.
    const author = [3, 2, 4][index % 3]
    await checked(db.from('note_replies').update({ body: REPLIES[index % REPLIES.length], created_by: FIXTURES[author], created_by_membership_id: fixtureMembers[author].id }).eq('id', reply.id).eq('tenant_id', TENANT))
  }
  const sampleReply = (await checked(db.from('note_replies').upsert({ id: '22000000-0000-0000-0000-000000000001', tenant_id: TENANT, note_id: notes[0].id, body: REPLIES[0], created_by: 'Josh Brent', created_by_membership_id: fixtureMembers[3].id }).select('id')))[0]
  const lead = (await checked(db.from('lead_intakes').select('id').eq('tenant_id', TENANT).order('id').limit(1)))[0]
  assert.ok(lead, 'Expected staging lead missing')
  for (const recipient of fixtureMembers) {
    const actor = fixtureMembers[3].id === recipient.id ? fixtureMembers[2] : fixtureMembers[3]
    await checked(db.from('notifications').upsert([
      { entity_type: 'dashboard_note', entity_id: notes[0].id, title: 'Mention in a sticky note', body: NOTES[0][1], link: `/dashboard/notes?note=${notes[0].id}`, deduplication_key: 'staging-review:sticky' },
      { entity_type: 'note_reply', entity_id: sampleReply.id, title: 'Mention in a comment', body: REPLIES[0], link: `/dashboard/notes?note=${notes[0].id}`, deduplication_key: 'staging-review:reply' },
      { entity_type: 'lead_note', entity_id: lead.id, title: 'Mention in a lead contact card', body: 'Please call the parent to confirm the preferred lesson time.', link: `/dashboard/leads?lead=${lead.id}`, deduplication_key: 'staging-review:lead' },
    ].map(row => ({ ...row, tenant_id: TENANT, recipient_membership_id: recipient.id, actor_membership_id: actor.id, reason: 'mention.created', read_at: null, dismissed_at: null })), { onConflict: 'tenant_id,recipient_membership_id,deduplication_key' }))
  }
  console.log(`STAGING ONLY: staff identities aligned; ${notes.length} readable notes; ${replies.length} replies refreshed; 3 pending notifications per test user.`)
}

module.exports = { STAFF, FIXTURES, NOTES, REPLIES }
if (require.main === module) run(parseEnv(fs.readFileSync(process.argv[2], 'utf8'))).catch(error => { console.error(error.message); process.exitCode = 1 })