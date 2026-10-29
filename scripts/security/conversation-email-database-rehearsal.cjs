/* eslint-disable @typescript-eslint/no-require-imports -- Disposable offline database; never loads credentials or publishes ports. */
const assert = require('node:assert/strict')
const { execFileSync, execFile } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { randomBytes } = require('node:crypto')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const liveGmailSchema = process.argv.includes('--live-gmail-schema')
assert.ok(process.argv.slice(2).every(arg => arg === '--live-gmail-schema'), 'Unknown rehearsal option')
const docker = existsSync('/Applications/Docker.app/Contents/Resources/bin/docker') ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker'
const name = `pulse-conversation-rehearsal-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync(docker, args, { input, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] })
const sql = input => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input).trim()
const parallelSql = input => new Promise((resolve, reject) => {
  const child = execFile(docker, ['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { encoding: 'utf8', timeout: 15000 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim()))
  child.stdin.end(input)
})
;(async () => {
let started = false
try {
  run(['run', '-d', '--name', name, '--network', 'none', '-e', `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`, 'postgres:17'])
  started = true
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000) }
  }
  assert.ok(ready, 'Disposable database must become ready')
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);`)
  for (const file of ['scripts/crm-consolidation/01-schema.sql', 'scripts/crm-consolidation/12-gmail-outreach.sql', 'supabase/migrations/202610290001_conversation_email_store.sql', 'supabase/migrations/202610290002_gmail_sync_fairness.sql']) {
    let source = readFileSync(path.join(root, file), 'utf8')
    if (liveGmailSchema && file === 'scripts/crm-consolidation/12-gmail-outreach.sql') {
      const table = /CREATE TABLE public\.gmail_connections \([\s\S]*?\n\);/g
      assert.equal([...source.matchAll(table)].length, 1, 'Replace exactly one repository mailbox definition')
      source = source.replace(table, () => readFileSync(path.join(root, 'scripts/security/fixtures/gmail-connections-production-schema.sql'), 'utf8'))
    }
    sql(source)
  }
  if (liveGmailSchema) {
    assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='gmail_connections' AND column_name='scopes' AND is_nullable='NO';"), '1')
    console.log('Using focused live Gmail table schema; remaining dependencies are repository fixtures, not a complete production snapshot.')
  }
  sql(readFileSync(path.join(root, 'scripts/security/conversation-email-store.integration.sql'), 'utf8'))
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['conversation_email_jobs', 'conversation_email_messages', 'conversation_email_mailboxes']) {
      assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM public.${table};`))
    }
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM public.conversation_email_claim();`))
  }
  sql(`INSERT INTO tenants VALUES ('10000000-0000-0000-0000-000000000001');
    INSERT INTO gmail_connections(id,tenant_id,email,refresh_token_ciphertext,connected_by)
      SELECT ('20000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000001',
        'office'||i||'@example.invalid','synthetic','30000000-0000-0000-0000-000000000001' FROM generate_series(1,5) i;
    INSERT INTO conversation_email_jobs(tenant_id,connection_id,kind,job_key)
      SELECT tenant_id,id,'history','history' FROM gmail_connections;
    INSERT INTO conversation_email_jobs(tenant_id,connection_id,kind,job_key,range_start,range_end)
      SELECT tenant_id,id,'import','import',now()-interval '1 day',now() FROM gmail_connections;`)
  assert.equal(sql(`BEGIN; SELECT pg_sleep(1.5); SET ROLE service_role;
    SELECT lease_until>clock_timestamp()+interval '119 seconds' FROM conversation_email_claim(); COMMIT;`).trim(), 't',
    'A long transaction must still receive a full wall-clock lease')
  for (let i = 0; i < 3; i++) assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM conversation_email_claim();'), '1')
  assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM conversation_email_claim();'), '0', 'Global worker cap')
  assert.equal(sql('SELECT count(DISTINCT connection_id) FROM conversation_email_jobs WHERE lease_until>now();'), '4', 'One active claim per mailbox')
  sql('UPDATE conversation_email_jobs SET lease_until=now()-interval \'1 second\' WHERE status=\'running\';')
  assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM conversation_email_claim();'), '1', 'Expired leases are reclaimable')
  // Tenant-interleaved attempts, backoff, unchanged successful coverage, and retry cap.
  sql(`INSERT INTO tenants VALUES ('10000000-0000-0000-0000-000000000002');
    INSERT INTO gmail_connections(tenant_id,email,refresh_token_ciphertext,connected_by)
      VALUES ('10000000-0000-0000-0000-000000000002','healthy@example.invalid','synthetic','30000000-0000-0000-0000-000000000001');`)
  assert.equal(sql('SET ROLE service_role; SELECT count(DISTINCT tenant_id) FROM gmail_schedule_sync(2);'), '2', 'A second tenant precedes a second mailbox of the first')
  assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM gmail_schedule_sync(5);'), '4', 'Reserved failures do not starve untouched mailboxes')
  assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM gmail_schedule_sync(5);'), '0', 'Backoff excludes repeated failures')
  assert.equal(sql('SELECT count(*) FROM gmail_connections WHERE last_synced_at IS NOT NULL;'), '0', 'Attempts never advance coverage')
  sql('UPDATE gmail_connections SET sync_attempts=32,sync_next_attempt_at=now()-interval \'1 second\';')
  sql('SELECT count(*) FROM gmail_schedule_sync(5);')
  assert.equal(sql("SELECT bool_and(sync_next_attempt_at<=clock_timestamp()+interval '1 hour') FROM gmail_connections;"), 't', 'Retry backoff is capped')
  for (const role of ['anon', 'authenticated']) assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM gmail_schedule_sync(5);`))
  sql("UPDATE gmail_connections SET sync_next_attempt_at='-infinity',sync_last_attempt_at=NULL,sync_attempts=0;")
  const reservations = await Promise.all([parallelSql('SELECT id FROM gmail_schedule_sync(3);'),parallelSql('SELECT id FROM gmail_schedule_sync(3);')])
  const reserved = reservations.flatMap(value => value.split('\n').filter(Boolean))
  assert.equal(reserved.length,6)
  assert.equal(new Set(reserved).size,6,'Concurrent schedulers reserve disjoint batches')
  // Simulate the next tick with five persistently failing mailboxes, one healthy.
  sql("UPDATE gmail_connections SET sync_next_attempt_at=clock_timestamp()+interval '1 hour' WHERE tenant_id='10000000-0000-0000-0000-000000000001'; UPDATE gmail_connections SET sync_next_attempt_at='-infinity' WHERE tenant_id='10000000-0000-0000-0000-000000000002';")
  assert.equal(sql("SELECT count(*) FROM gmail_schedule_sync(5) WHERE tenant_id='10000000-0000-0000-0000-000000000002';"),'1','Healthy tenant continues while old failures back off')

  // Real separate sessions: a transaction waits on a row lock until its lease expires.
  const mailbox = '20000000-0000-0000-0000-000000000001'
  const job = sql(`SELECT id FROM conversation_email_jobs WHERE connection_id='${mailbox}' AND kind='history';`)
  const lease = '40000000-0000-0000-0000-000000000001'
  async function behindLock(table, id, statement) {
    const holder = parallelSql(`SET application_name='rehearsal-lock-holder'; BEGIN; SELECT id FROM ${table} WHERE id='${id}' FOR UPDATE; SELECT pg_sleep(1.5); COMMIT;`)
    holder.catch(() => {})
    let waiting = false
    for (let i=0;i<50;i++) {
      if (sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='rehearsal-lock-holder' AND wait_event='PgSleep';") === '1') { waiting=true;break }
      await new Promise(resolve => setTimeout(resolve,20))
    }
    assert.ok(waiting, 'Lock holder is active before the competing transaction')
    const result = await parallelSql(statement)
    await holder
    return result
  }
  sql(`UPDATE conversation_email_jobs SET lease_token='${lease}',lease_until=clock_timestamp()+interval '1 second',status='running' WHERE id='${job}';`)
  assert.equal(await behindLock('conversation_email_jobs',job,`SELECT conversation_email_commit('${job}','${lease}','[]','{}','{}',true,'must-not-publish');`),'f','Lock-delayed commit rejects expired lease')
  assert.equal(sql(`SELECT count(*) FROM conversation_email_mailboxes WHERE history_id='must-not-publish';`),'0')
  const old = sql(`SELECT sync_lease_token FROM gmail_claim_sync('${mailbox}','10000000-0000-0000-0000-000000000001');`)
  sql(`UPDATE gmail_connections SET lease_until=clock_timestamp()+interval '1 second' WHERE id='${mailbox}';`)
  assert.equal(await behindLock('gmail_connections',mailbox,`SELECT gmail_finish_sync('${mailbox}','10000000-0000-0000-0000-000000000001','${old}',true);`),'f')
  const replacement = sql(`SELECT sync_lease_token FROM gmail_claim_sync('${mailbox}','10000000-0000-0000-0000-000000000001');`)
  assert.notEqual(old,replacement)
  assert.equal(sql(`SELECT gmail_finish_sync('${mailbox}','10000000-0000-0000-0000-000000000001','${old}',false);`),'f','Old cleanup cannot release a successor lease')
  sql(`UPDATE gmail_connections SET refresh_token_ciphertext='new-credential' WHERE id='${mailbox}';`)
  assert.equal(sql(`SELECT gmail_finish_sync('${mailbox}','10000000-0000-0000-0000-000000000001','${replacement}',true);`),'f','Reconnect fences legacy workers too')
  const slowLease = sql(`SELECT sync_lease_token FROM gmail_claim_sync('${mailbox}','10000000-0000-0000-0000-000000000001');`)
  sql(`UPDATE gmail_connections SET lease_until=clock_timestamp()+interval '1 second' WHERE id='${mailbox}';
    CREATE FUNCTION slow_legacy_finish() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$;
    CREATE TRIGGER slow_legacy_finish BEFORE UPDATE OF last_synced_at ON gmail_connections FOR EACH ROW EXECUTE FUNCTION slow_legacy_finish();`)
  assert.equal(sql(`SELECT gmail_finish_sync('${mailbox}','10000000-0000-0000-0000-000000000001','${slowLease}',true);`),'f','Expiry during legacy coverage write rolls back')
  assert.equal(sql(`SELECT count(*) FROM gmail_connections WHERE id='${mailbox}' AND last_synced_at IS NULL AND sync_lease_token='${slowLease}';`),'1','Slow finish retained coverage and lease for reclaim')
  console.log('PASS: schemas, grants, recovery/reconnect/freshness, worker cap/reclaim, tenant-fair scheduling, capped backoff, real lock-wait expiry and successor/reconnect fencing.')
} catch (error) {
  console.error(String(error.stderr || error.message))
  process.exitCode = 1
} finally {
  if (started) run(['rm', '-fv', name])
}
})().catch(error => { console.error(error); process.exitCode=1 })