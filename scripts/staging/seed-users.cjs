/* eslint-disable @typescript-eslint/no-require-imports -- Standalone staging fixture tool. */
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { parseEnv } = require('node:util')
const { createClient } = require('@supabase/supabase-js')

const STAGING = 'xpnygavujqmzkdmcktdm'
const TENANT = '00000000-0000-0000-0000-000000000001'
const READ = ['staff.read', 'contacts.read', 'leads.read', 'notes.read', 'communications.read', 'tenant_settings.read', 'funding.read']
const STAFF = [...READ, 'contacts.manage', 'leads.manage', 'notes.manage']
const USERS = [
  { name: 'Owner', role: 'owner' },
  { name: 'Admin', role: 'admin' },
  { name: 'Staff', role: 'staging_staff' },
  { name: 'Assistant', role: 'staging_assistant' },
]

function validateTarget(env) {
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${STAGING}.supabase.co`, 'Refusing non-staging target')
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'Staging server key required')
}

async function seed(env) {
  validateTarget(env)
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  async function checked(query) {
    const { data, error } = await query
    if (error) throw new Error('Staging fixture database operation failed: ' + error.code)
    return data
  }
  const provider = await checked(db.from('twilio_config').select('id').limit(1))
  assert.equal(provider.length, 0, 'Refusing fixtures while staging has provider configuration')
  const permissions = await checked(db.from('permissions').select('id,key'))
  for (const [index, user] of USERS.entries()) {
    const suffix = String(index + 10).padStart(12, '0')
    const personId = `10000000-0000-0000-0000-${suffix}`
    const role = (await checked(db.from('roles').upsert({ tenant_id: TENANT, key: user.role, name: user.name, is_system: false }, { onConflict: 'tenant_id,key' }).select('id')))[0]
    const allowed = user.role === 'owner' || user.role === 'admin'
      ? permissions.map(p => p.key).filter(key => !['communications.send', 'communications.configure', 'data_migrations.run'].includes(key))
      : user.role === 'staging_staff' ? STAFF : READ
    await checked(db.from('role_permissions').delete().eq('role_id', role.id))
    await checked(db.from('role_permissions').insert(permissions.filter(p => allowed.includes(p.key)).map(p => ({ role_id: role.id, permission_id: p.id }))))
    await checked(db.from('people').upsert({ id: personId, tenant_id: TENANT, first_name: `Staging${user.name}`, last_name: 'Tester', email: `${user.name.toLowerCase()}@example.invalid`, custom_fields: { staff_status: 'active', staging_fixture: true } }))
    await checked(db.from('instructors').upsert({ id: `11000000-0000-0000-0000-${suffix}`, tenant_id: TENANT, person_id: personId, specialty: ['Synthetic staff'] }))
    await checked(db.from('tenant_memberships').upsert({ tenant_id: TENANT, person_id: personId, role_id: role.id, status: 'unclaimed', legacy_access_enabled: true }, { onConflict: 'tenant_id,person_id' }))
    console.log(`Ready: Staging${user.name} T. (${user.name})`)
  }
  console.log('STAGING USERS READY; NO PRODUCTION WRITES')
}

module.exports = { validateTarget, USERS }
if (require.main === module) {
  const file = process.argv[2]
  assert.ok(file, 'Pass the private staging environment file path')
  seed(parseEnv(fs.readFileSync(file, 'utf8'))).catch(error => { console.error(error.message); process.exitCode = 1 })
}