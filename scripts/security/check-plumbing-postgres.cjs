/* eslint-disable @typescript-eslint/no-require-imports -- Disposable local Postgres integration checks. */
const { spawnSync, spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const name = `pulse-plumbing-check-${process.pid}`
const root = path.resolve(__dirname, '../..')
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000 })
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Docker command failed')
  return result.stdout.trim()
}
function sql(input) {
  return docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input)
}
function contender() {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'])
    let out = '', err = ''
    child.stdout.on('data', data => { out += data })
    child.stderr.on('data', data => { err += data })
    child.on('error', reject)
    child.on('close', code => resolve({ code, out, err }))
    child.stdin.end(`BEGIN;
      INSERT INTO group_email_operations (tenant_id, operation_id, membership_id, fingerprint)
      VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004', repeat('a',64));
      SELECT pg_sleep(0.15); COMMIT;`)
  })
}
async function main() {
  try {
    // No host ports, production credentials, volumes or network access.
    docker(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'])
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      try { docker(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 250)) }
    }
    assert.ok(ready, 'Local Postgres must be ready')
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE tenants (id uuid PRIMARY KEY);
      -- Deliberately no membership unique key: the ledger must not assume one.
      CREATE TABLE tenant_memberships (id uuid, tenant_id uuid);
      CREATE TABLE messages (id bigint PRIMARY KEY, tenant_id uuid, direction text, status text, from_phone text, campaign_id uuid);
      INSERT INTO tenants VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');`)
    for (const migration of ['202611200005_group_email_operations.sql', '202611200006_unread_messages_index.sql']) {
      const source = fs.readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8')
      sql(source)
      sql(source) // Reapplication must also succeed.
    }
    const results = await Promise.all([contender(), contender(), contender()])
    assert.equal(results.filter(result => result.code === 0).length, 1, JSON.stringify(results))
    assert.ok(results.filter(result => result.code !== 0).every(result => /duplicate key/.test(result.err)))
    assert.equal(sql('SELECT status FROM group_email_operations'), 'uncertain')
    sql(`SET ROLE service_role; UPDATE group_email_operations SET status='sent', provider_message_id='provider-one';`)
    assert.equal(sql('SELECT status FROM group_email_operations'), 'sent')
    // Same operation ID is independent in another tenant.
    sql(`INSERT INTO group_email_operations SELECT '00000000-0000-0000-0000-000000000002',
      operation_id, membership_id, fingerprint, 'uncertain', NULL, now() FROM group_email_operations;`)
    assert.equal(sql('SELECT count(*) FROM group_email_operations'), '2')
    for (const role of ['anon', 'authenticated']) {
      assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM group_email_operations;`), /permission denied/)
      assert.throws(() => sql(`SET ROLE ${role}; UPDATE group_email_operations SET status='sent';`), /permission denied/)
    }
    assert.throws(() => sql('SET ROLE service_role; DELETE FROM group_email_operations;'), /permission denied/)
    assert.throws(() => sql("UPDATE group_email_operations SET status='retry';"), /check constraint/)
    assert.throws(() => sql("UPDATE group_email_operations SET fingerprint='short';"), /check constraint/)
    sql(`INSERT INTO messages SELECT i, '00000000-0000-0000-0000-000000000001', 'inbound',
      CASE WHEN i=1 THEN NULL WHEN i=2 THEN 'read' ELSE 'received' END, '9165550100', NULL
      FROM generate_series(1,1002) i;`)
    assert.equal(sql("SELECT count(*) FROM messages WHERE direction='inbound' AND (status IS NULL OR status <> 'read');"), '1001')
    const plan = sql(`SET enable_seqscan=off; EXPLAIN SELECT id, from_phone FROM messages
      WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND direction='inbound'
      AND (status IS NULL OR status <> 'read') ORDER BY id LIMIT 500;`)
    assert.match(plan, /idx_messages_tenant_unread_inbound/)
    console.log('PASS: migrations/reapplication, concurrent reservations, tenant uniqueness, uncertain/sent state, client ACLs, retention, null unread statuses and index plan.')
  } finally {
    docker(['rm', '--force', name])
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })