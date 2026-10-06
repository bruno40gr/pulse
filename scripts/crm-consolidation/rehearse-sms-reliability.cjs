// Synthetic, network-isolated PostgreSQL test. No production credentials or records.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const docker = '/Applications/Docker.app/Contents/Resources/bin/docker';
const name = `odeon-sms-reliability-${process.pid}`;
const run = (args, input) => execFileSync(docker, args, { input, encoding: 'utf8', timeout: 120000 });
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], text).trim();
const tenant = '00000000-0000-0000-0000-000000000001';
const sid = `SM${'1'.repeat(32)}`;
const payload = JSON.stringify({ message_sid: sid, from_phone: '+12025550111', to_phone: '+12025550122', body: 'Synthetic reply' });
const receive = `SET ROLE service_role; SELECT public.odeon_sms_receive('${tenant}','${payload}'::jsonb,'2026-10-01T10:00:00Z');`;
try {
  run(['run', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break; }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  assert.ok(ready);
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY); INSERT INTO public.tenants VALUES('${tenant}');
    CREATE TABLE public.twilio_config(tenant_id uuid,phone_number text);
    INSERT INTO public.twilio_config VALUES('${tenant}','+12025550122');
    CREATE TABLE public.people(id uuid PRIMARY KEY,tenant_id uuid,phone text,opted_out boolean);
    CREATE TABLE public.campaigns(id uuid PRIMARY KEY,tenant_id uuid);
    CREATE TABLE public.messages(id uuid PRIMARY KEY,tenant_id uuid,contact_id uuid REFERENCES people(id),
      campaign_id uuid REFERENCES campaigns(id),channel text,direction text,body text,status text,
      twilio_sid text,created_at timestamptz,from_phone text,to_phone text);
    GRANT SELECT ON public.twilio_config,public.people,public.campaigns TO service_role;
    GRANT SELECT,INSERT,DELETE ON public.messages TO service_role; GRANT UPDATE ON public.people TO service_role;`);
  sql(readFileSync(__dirname + '/04-capture-queue.sql', 'utf8'));
  sql('ALTER TABLE public.odeon_crm_cutover_queue ADD COLUMN message_persisted_at timestamptz;');
  sql(readFileSync(__dirname + '/11-sms-reliability.sql', 'utf8'));
  assert.equal(sql(receive), 'saved');
  assert.equal(sql(receive), 'existing');
  assert.equal(sql('SELECT count(*) FROM messages;'), '1');
  assert.equal(sql("SELECT created_at AT TIME ZONE 'UTC' FROM messages;"), '2026-10-01 10:00:00');
  assert.throws(() => sql(receive.replace('Synthetic reply', 'Conflicting body')));
  sql(`SET ROLE service_role; DELETE FROM public.messages WHERE twilio_sid='${sid}';`);
  assert.equal(sql(receive), 'deleted');
  assert.equal(sql('SELECT count(*) FROM messages;'), '0');
  assert.equal(sql('SELECT count(*) FROM sms_deleted_receipts;'), '1');
  assert.throws(() => sql(`SET ROLE anon; SELECT * FROM public.sms_deleted_receipts;`));
  assert.throws(() => sql(`SET ROLE authenticated; SELECT public.odeon_sms_receive('${tenant}','${payload}');`));
  assert.throws(() => sql(receive.replace('+12025550122', '+12025550199')));
  // A previously pending receipt must not prevent storing an unrelated newer reply.
  const pendingSid = `SM${'2'.repeat(32)}`;
  sql(`SELECT public.odeon_crm_capture('${tenant}','inbound_sms','${pendingSid}',
    '${payload.replace(sid,pendingSid)}');`);
  assert.equal(sql(receive.replace(sid,`SM${'3'.repeat(32)}`)), 'saved');
  console.log('PASS: durable receipt, retry deduplication, original time, deletion tombstone, role isolation, number validation, independent receipt processing.');
} finally {
  run(['rm', '-fv', name]);
}