/* eslint-disable @typescript-eslint/no-require-imports -- Guarded staging-only fixture tool. */
const fs = require('node:fs')
const { parseEnv } = require('node:util')
const { createHash } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const { validateTarget } = require('./seed-users.cjs')
const { fictionalName, transformNames } = require('./fictional-names.cjs')

const AUTHORS = ['Jessica Suase', 'Josh Brent', 'Alyssa Abbott', 'Scott Gaona']
const COMMENTS = [
  'The parent prefers Tuesday afternoons. Please confirm teacher availability before booking the first lesson.',
  'I spoke with the family. They would like a tour before choosing a lesson time.',
  'Please prepare the welcome information and check the student’s preferred program.',
  'Follow up with the parent about the trial lesson and record their preferred start date.',
]
function eventId(leadId) {
  const hex = createHash('sha256').update(`staging-lead-comment:${leadId}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
function readableNotes(value) {
  if (!Array.isArray(value)) return value
  return value.map((entry, index) => entry && typeof entry === 'object'
    ? { ...entry, actor_name: AUTHORS[index % AUTHORS.length], text: COMMENTS[index % COMMENTS.length] }
    : entry)
}
async function run(env) {
  validateTarget(env)
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  async function checked(query) {
    const { data, error } = await query
    if (error) throw new Error(`Staging fixture operation failed (${error.code})`)
    return data
  }
  async function rows(table) {
    const result = await checked(db.from(table).select('*').order('id').limit(1000))
    if (result.length >= 1000) throw new Error('Fixture size exceeds reviewed limit')
    return result
  }
  const instructors = await rows('instructors')
  const staffIds = new Set(instructors.map(row => row.person_id))
  for (const table of ['people', 'crm_contacts', 'contacts', 'accounts', 'lead_intakes']) {
    for (const row of await rows(table)) {
      const patch = {}
      if (table === 'people' && (staffIds.has(row.id) || row.id.startsWith('10000000-0000-0000-0000-'))) continue
      if (['people', 'crm_contacts', 'contacts'].includes(table)) {
        if ('first_name' in row && row.first_name) patch.first_name = fictionalName(row.id, 'first_name')
        if ('last_name' in row && row.last_name) patch.last_name = fictionalName(row.id, 'last_name')
        if ('full_name' in row) patch.full_name = fictionalName(row.id)
      }
      if (table === 'accounts') patch.name = `${fictionalName(row.id)} Family`
      for (const key of ['payload', 'custom_fields']) if (row[key]) patch[key] = transformNames(row[key])
      for (const key of ['notes_history', 'student_notes_history']) if (row[key]) patch[key] = readableNotes(row[key])
      if (Object.keys(patch).length) await checked(db.from(table).update(patch).eq('id', row.id).eq('tenant_id', row.tenant_id))
    }
  }
  const leads = await rows('lead_intakes')
  const memberships = await rows('tenant_memberships')
  const people = await rows('people')
  const personNames = new Map(people.map(p => [p.id, `${p.first_name} ${p.last_name}`]))
  const actorFor = (tenant, index) => {
    const available = memberships.filter(m => m.tenant_id === tenant && AUTHORS.includes(personNames.get(m.person_id)))
    const member = available[index % available.length]
    return member ? { displayName: personNames.get(member.person_id), membershipId: member.id } : { displayName: AUTHORS[index % AUTHORS.length] }
  }
  const events = (await rows('lead_events')).filter(e => e.event_type === 'note_added')
  for (const [index, event] of events.entries()) {
    await checked(db.from('lead_events').update({ payload: { ...event.payload, text: COMMENTS[index % COMMENTS.length], actor: actorFor(event.tenant_id, index) } }).eq('id', event.id).eq('tenant_id', event.tenant_id))
  }
  for (const [index, lead] of leads.entries()) {
    await checked(db.from('lead_events').upsert({
      id: eventId(lead.id), tenant_id: lead.tenant_id, contact_id: lead.contact_id,
      lead_intake_id: lead.id, event_type: 'note_added', event_label: 'Staging follow-up note',
      payload: { text: COMMENTS[index % COMMENTS.length], actor: actorFor(lead.tenant_id, index) },
      created_at: lead.created_at,
    }))
  }
  console.log(`STAGING ONLY: normal contact names; ${events.length} existing comments updated; ${leads.length} leads have portrait-backed staff comment fixtures.`)
}
module.exports = { AUTHORS, COMMENTS, readableNotes, eventId }
if (require.main === module) run(parseEnv(fs.readFileSync(process.argv[2], 'utf8'))).catch(error => { console.error(error.message); process.exitCode = 1 })