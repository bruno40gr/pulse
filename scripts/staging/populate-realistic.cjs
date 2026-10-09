/* eslint-disable @typescript-eslint/no-require-imports -- Guarded staging-only fixture tool. */
const fs = require('node:fs')
const { parseEnv } = require('node:util')
const { createClient } = require('@supabase/supabase-js')
const { validateTarget } = require('./seed-users.cjs')
const { fictionalName, transformNames } = require('./fictional-names.cjs')

async function main() {
  const env = parseEnv(fs.readFileSync(process.argv[2], 'utf8'))
  validateTarget(env)
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  async function checked(query) {
    const { data, error } = await query
    if (error) throw new Error(`Staging fixture operation failed (${error.code})`)
    return data
  }
  for (const table of ['people', 'crm_contacts', 'contacts', 'accounts', 'lead_intakes', 'lead_events', 'messages']) {
    const rows = await checked(db.from(table).select('*').order('id').limit(1000))
    if (rows.length === 1000) throw new Error('Fixture size exceeds reviewed limit')
    let changed = 0
    const updates = []
    for (const row of rows) {
      // Never overwrite login fixture names here; they are assigned below.
      if (table === 'people' && row.id.startsWith('10000000-0000-0000-0000-')) continue
      const patch = {}
      if (table === 'people' || table === 'crm_contacts' || table === 'contacts') {
        const full = fictionalName(row.id)
        const [first, ...last] = full.split(' ')
        if ('first_name' in row) patch.first_name = row.first_name ? fictionalName(row.first_name.length > 60 ? row.first_name : row.id, 'first_name') : row.first_name
        if ('last_name' in row) patch.last_name = row.last_name ? fictionalName(row.last_name.length > 60 ? row.last_name : row.id, 'last_name') : row.last_name
        if ('full_name' in row) patch.full_name = [patch.first_name || first, patch.last_name || last.join(' ')].join(' ')
      }
      if (table === 'accounts') patch.name = fictionalName(row.id) + ' Family'
      for (const key of ['payload', 'custom_fields', 'notes_history', 'student_notes_history']) {
        if (row[key]) patch[key] = transformNames(row[key])
      }
      if (Object.keys(patch).length) {
        updates.push({ ...row, ...patch })
        changed++
      }
    }
    for (let offset = 0; offset < updates.length; offset += 100) await checked(db.from(table).upsert(updates.slice(offset, offset + 100)))
    console.log(`Fictional names applied: ${table} (${changed})`)
  }
  const fixtures = [
    ['000000000001', 'Jamie', 'Bennett'],
    ['000000000010', 'Morgan', 'Reyes'],
    ['000000000011', 'Avery', 'Chen'],
    ['000000000012', 'Jordan', 'Patel'],
    ['000000000013', 'Riley', 'Brooks'],
  ]
  const tenant = '00000000-0000-0000-0000-000000000001'
  for (const [suffix, first_name, last_name] of fixtures) await checked(db.from('people').update({ first_name, last_name }).eq('id', `10000000-0000-0000-0000-${suffix}`).eq('tenant_id', tenant))
  const members = await checked(db.from('tenant_memberships').select('id,person_id').eq('tenant_id', tenant))
  const recipients = members.filter(m => fixtures.some(([suffix]) => m.person_id === `10000000-0000-0000-0000-${suffix}`))
  const notes = await checked(db.from('notes').select('id').eq('tenant_id', tenant).limit(1))
  if (!notes.length) throw new Error('No staging note available for notification fixture')
  for (const recipient of recipients) {
    const actor = recipients.find(m => m.id !== recipient.id)
    await checked(db.from('notifications').upsert([
      { tenant_id: tenant, recipient_membership_id: recipient.id, actor_membership_id: actor.id, reason: 'mention.created', entity_type: 'note', entity_id: notes[0].id, title: 'Please review the tour follow-up', body: 'Fictional example: confirm the family’s preferred date before booking.', link: `/dashboard/notes?note=${notes[0].id}`, deduplication_key: 'staging-sample:tour', read_at: null },
      { tenant_id: tenant, recipient_membership_id: recipient.id, actor_membership_id: actor.id, reason: 'mention.created', entity_type: 'note', entity_id: notes[0].id, title: 'New lesson inquiry needs attention', body: 'Fictional example: the student is interested in piano on Tuesdays.', link: '/dashboard/leads', deduplication_key: 'staging-sample:lesson', read_at: null },
      { tenant_id: tenant, recipient_membership_id: recipient.id, actor_membership_id: actor.id, reason: 'mention.created', entity_type: 'note', entity_id: notes[0].id, title: 'Completed scheduling review', body: 'Fictional example of a notification already marked Done.', link: '/dashboard/notes', deduplication_key: 'staging-sample:done', read_at: new Date().toISOString() },
    ], { onConflict: 'tenant_id,recipient_membership_id,deduplication_key' }))
  }
  console.log(`SAMPLE NOTIFICATIONS READY FOR ${recipients.length} TEST USERS; STAGING ONLY`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })