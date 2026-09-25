import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local (mirrors scripts/backfill-instructors.mjs)
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const WINBACK_SOURCE_FORM = '2026-disenrollment-import'
const TENANT_ID = env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const APPLY = process.argv.includes('--apply')

// Students from the re-audit CSV marked ACTIVE / RE-ENROLLED (attended in
// September after the handwritten disenrollment record). They are enrolled, so
// they must not remain in the Win-back list.
const REENROLLED_NAMES = [
  'Rigby Van Ness',
  'Daniel Montgomery',
  'Aliyah Song',
  'Austin Ewert',
  'Aubrielle Vu',
  'Athena Fiorentino',
  'Sophia Marquez',
  'Londyn Morris',
  'River Vanhorn',
  'Trik Aguilar',
  'Eva Williams',
  'Griffin Williams',
  'Landon Owen',
  'Oliver Micek',
]

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const supabase = createClient(env.CRM_SUPABASE_URL, env.CRM_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: leads, error } = await supabase
  .from('lead_intakes')
  .select('id, contact_id, program_label, category, status, payload, crm_contacts(id, full_name, contact_kind, lifecycle_stage)')
  .eq('tenant_id', TENANT_ID)
  .eq('source_form', WINBACK_SOURCE_FORM)

if (error) {
  console.error('fetch win-back leads error:', error.message)
  process.exit(1)
}

const nameSet = new Set(REENROLLED_NAMES.map(comparable))
const matches = (leads || []).filter((lead) => {
  const contact = Array.isArray(lead.crm_contacts) ? lead.crm_contacts[0] : lead.crm_contacts
  return nameSet.has(comparable(contact?.full_name))
})

console.log('Tenant:', TENANT_ID)
console.log('Mode:', APPLY ? 'APPLY (deleting)' : 'DRY RUN (no changes)')
console.log('Total win-back leads:', (leads || []).length)
console.log('Re-enrolled matches found:', matches.length)
console.log('')
console.log('Matches (to be removed from Win-back):')
for (const lead of matches) {
  const contact = Array.isArray(lead.crm_contacts) ? lead.crm_contacts[0] : lead.crm_contacts
  console.log(
    `  - ${contact?.full_name || '(no name)'} | program=${lead.program_label || ''} | kind=${contact?.contact_kind || ''} stage=${contact?.lifecycle_stage || ''} | lead=${lead.id} contact=${lead.contact_id}`,
  )
}

if (!APPLY) {
  console.log('\nRe-run with --apply to remove these records.')
  process.exit(0)
}

let removedLeads = 0
let removedEvents = 0
let removedContacts = 0
const seenContactIds = new Set()

for (const lead of matches) {
  // 1. Remove associated lead events first.
  const { data: events } = await supabase
    .from('lead_events')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('lead_intake_id', lead.id)
  const eventIds = (events || []).map((e) => e.id)
  if (eventIds.length > 0) {
    const { error: eventDelErr } = await supabase.from('lead_events').delete().in('id', eventIds)
    if (eventDelErr) {
      console.log('  FAILED events for', lead.id, eventDelErr.message)
      continue
    }
    removedEvents += eventIds.length
  }

  // 2. Remove the win-back lead record itself.
  const { error: leadDelErr } = await supabase.from('lead_intakes').delete().eq('id', lead.id)
  if (leadDelErr) {
    console.log('  FAILED lead for', lead.id, leadDelErr.message)
    continue
  }
  removedLeads += 1
  seenContactIds.add(lead.contact_id)
}

// 3. Clean up import-created contact records that are now orphaned.
for (const contactId of seenContactIds) {
  const { data: otherLeads } = await supabase
    .from('lead_intakes')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('contact_id', contactId)
    .limit(1)
  if (otherLeads && otherLeads.length > 0) continue

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('id, contact_kind, lifecycle_stage')
    .eq('tenant_id', TENANT_ID)
    .eq('id', contactId)
    .maybeSingle()

  // Only remove contacts the import itself created as win-back lead placeholders.
  if (contact && contact.contact_kind === 'lead' && contact.lifecycle_stage === 'former_student') {
    const { error: contactDelErr } = await supabase.from('crm_contacts').delete().eq('id', contactId)
    if (contactDelErr) {
      console.log('  FAILED contact for', contactId, contactDelErr.message)
      continue
    }
    removedContacts += 1
  }
}

console.log(`\nDone. leads=${removedLeads} events=${removedEvents} contacts=${removedContacts}`)
