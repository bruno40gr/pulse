// Synthetic database-only cutover/abort rehearsal. No env files, live URLs,
// credentials or private snapshots accepted. Not a deployment orchestration tool.
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { importSql, tables } = require('./transfer.cjs');
const { rollbackSql } = require('./rollback-sql.cjs');
const { freezeSql, unfreezeSql } = require('./write-barrier.cjs');
const docker = existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')
  ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker';
const name = `odeon-crm-cutover-${process.pid}-${Date.now()}`;
const password = randomBytes(32).toString('hex');
const run = (args, input) => execFileSync(docker, args, {
  input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], timeout: 180000,
  env: { ...process.env, POSTGRES_PASSWORD: password,
    PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH || ''}` },
});
const sql = (db, text) => run(['exec','-i',name,'psql','-X','-q','-t','-A',
  '-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'], text).trim();
const file = name => readFileSync(join(__dirname,name),'utf8');
const snapshot = db => JSON.parse(sql(db,file('03-export-snapshot.sql')));
const tenant = '00000000-0000-0000-0000-000000000001';
const contact = '10000000-0000-0000-0000-000000000001';
const lead = '20000000-0000-0000-0000-000000000001';
function blocked(db, text) {
  assert.throws(() => sql(db,text), error =>
    error.stderr.toString().includes('CRM cutover write barrier active'));
}
function capture(db, key) {
  return sql(db,`SET ROLE service_role; SELECT public.odeon_crm_capture('${tenant}',
    'intake','${key}', '{"full_name":"Synthetic cutover applicant",
    "email":"${key}@example.invalid","intake_type":"lesson_inquiry",
    "source_form":"synthetic-cutover","payload":{}}'::jsonb);`);
}
function drain(db) {
  return JSON.parse(sql(db,'SET ROLE service_role; SELECT public.odeon_crm_drain_next();'));
}
function mainMessagingFixture() {
  sql('main',`CREATE TABLE public.people(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,
    phone text,opted_out boolean DEFAULT false);
    CREATE TABLE public.campaigns(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TABLE public.messages(id uuid PRIMARY KEY,tenant_id uuid,contact_id uuid REFERENCES public.people(id),
      campaign_id uuid REFERENCES public.campaigns(id),channel text NOT NULL,direction text NOT NULL,
      body text,status text,twilio_sid text,created_at timestamptz DEFAULT now(),from_phone text,to_phone text);
    GRANT SELECT,INSERT ON public.messages TO service_role;
    GRANT SELECT,UPDATE ON public.people TO service_role;
    GRANT SELECT ON public.campaigns TO service_role;
    INSERT INTO public.people VALUES('${contact}','${tenant}','+12025550111',false);`);
}
function captureSms(body, digit) {
  const sid = `SM${digit.repeat(32)}`;
  return sql('main',`SET ROLE service_role; SELECT public.odeon_crm_capture('${tenant}',
    'inbound_sms','${sid}','${JSON.stringify({message_sid:sid,from_phone:'+12025550111',
      to_phone:'+12025550122',body})}'::jsonb);`);
}
function captureVoice(sequence) {
  const sid = `CA${'7'.repeat(32)}`;
  return sql('main',`SET ROLE service_role; SELECT public.odeon_crm_capture('${tenant}',
    'voice_status','${sid}:${sequence}','${JSON.stringify({call_sid:sid,
      sequence,status:'completed',duration:42})}'::jsonb);`);
}
let started = false;
try {
  run(['pull','postgres:17']);
  run(['run','-d','--name',name,'--network','none','-e','POSTGRES_PASSWORD','postgres:17']);
  started = true;
  let ready = false;
  for (let i=0;i<60;i++) {
    try { run(['exec',name,'pg_isready','-U','postgres']); ready=true; break; }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000); }
  }
  assert.ok(ready,'Local database failed to start');
  sql('postgres',`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE DATABASE crm; CREATE DATABASE main;`);
  for (const db of ['crm','main']) {
    sql(db,`CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text NOT NULL,is_demo boolean);
      INSERT INTO public.tenants VALUES('${tenant}','Synthetic school',false);`);
    sql(db,file('01-schema.sql'));
  }
  sql('crm',file('02-triggers.sql'));
  sql('crm',`INSERT INTO public.crm_contacts(id,tenant_id,full_name,email)
    VALUES('${contact}','${tenant}','Synthetic existing contact','existing@example.invalid');
    INSERT INTO public.lead_intakes(id,tenant_id,contact_id,intake_type,source_form)
    VALUES('${lead}','${tenant}','${contact}','lesson_inquiry','synthetic-existing');`);
  sql('crm',`UPDATE public.crm_contacts SET phone='+12025550111' WHERE id='${contact}';
    INSERT INTO public.lead_events(tenant_id,lead_intake_id,contact_id,event_type,payload)
    VALUES('${tenant}','${lead}','${contact}','call_started',
      jsonb_build_object('call_sid','CA${'7'.repeat(32)}','retained','synthetic'));`);
  mainMessagingFixture();
  for (const name of ['04-capture-queue.sql','05-replay-inquiry.sql',
    '06-replay-sms-history.sql','07-persist-captured-sms.sql',
    '08-replay-voice-status.sql','09-drain-queue.sql']) sql('main',file(name));

  // Main capture is independent of the frozen source, as in the intended topology.
  sql('crm',freezeSql());
  const baseline = snapshot('crm');
  blocked('crm',`UPDATE public.crm_contacts SET notes='Should not save';`);
  const duringFreeze = capture('main','during-freeze');
  const retry = capture('main','during-freeze');
  assert.equal(retry,duringFreeze);
  sql('main',importSql(baseline));
  assert.deepEqual(snapshot('main'),baseline);
  sql('main',file('02-triggers.sql'));
  const completed = drain('main');
  assert.equal(completed.status,'completed');
  assert.equal(completed.queue_id,duringFreeze);
  assert.equal(drain('main').status,'empty');
  assert.deepEqual(snapshot('crm'),baseline);
  assert.equal(sql('main',`SELECT count(*) FROM public.lead_intakes WHERE id='${duringFreeze}';`),'1');
  assert.equal(sql('main',`SELECT count(*) FROM public.lead_events
    WHERE lead_intake_id='${duringFreeze}' AND event_type='created';`),'1');
  console.log('PASS: frozen source -> final snapshot -> verified import -> trigger install -> captured inquiry drain without duplicates.');

  const competingInquiry = capture('main','competing-worker');
  run(['exec','-d',name,'psql','-X','-q','-U','postgres','-d','main',
    '-v','ON_ERROR_STOP=1','-c',`BEGIN; SELECT pg_advisory_xact_lock(8675310);
      SELECT pg_sleep(4); ROLLBACK;`]);
  let locked = false;
  for (let i=0;i<40;i++) {
    if (sql('main',`SELECT count(*) FROM pg_locks WHERE locktype='advisory'
      AND objid=8675310 AND granted;`) === '1') { locked=true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);
  }
  assert.ok(locked,'Synthetic competing drain did not hold replay lock');
  assert.throws(() => sql('main',`SET lock_timeout='100ms';
    SET ROLE service_role; SELECT public.odeon_crm_drain_next();`), error =>
    error.stderr.toString().includes('lock timeout'));
  assert.equal(sql('main',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue
    WHERE id='${competingInquiry}';`),'t');
  assert.equal(sql('main',`SELECT count(*) FROM public.lead_intakes WHERE id='${competingInquiry}';`),'0');
  assert.equal(drain('main').queue_id,competingInquiry);
  assert.equal(drain('main').status,'empty');
  console.log('PASS: competing drain lock times out safely without completing or skipping pending inquiry; retry completes once.');

  // Destination activity must be preserved when reversing. Source stays frozen
  // after guarded replacement, including replica-mode writes, until explicitly reopened.
  sql('main',`SET ROLE service_role; UPDATE public.crm_contacts SET notes='Synthetic after switch'
    WHERE id='${contact}';`);
  const pendingAbort = capture('main','pending-abort');
  const stopId = captureSms('STOP','a');
  // Webhook main persistence may precede CRM replay. Rollback must not undo it.
  sql('main',`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${stopId}');`);
  assert.equal(sql('main','SELECT opted_out FROM public.people;'),'t');
  const voiceId = captureVoice(3);
  sql('crm',rollbackSql(baseline,snapshot('crm'),snapshot('main')));
  assert.deepEqual(snapshot('crm'),snapshot('main'));
  for (const table of tables) {
    assert.equal(sql('crm',`SELECT count(*) FROM pg_trigger
      WHERE tgrelid='public.${table}'::regclass AND tgname='odeon_crm_cutover_write_barrier'
        AND tgenabled='A';`),'1');
    blocked('crm',`SET session_replication_role=replica; UPDATE public.${table} SET id=id;`);
  }
  assert.equal(sql('main',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue
    WHERE id='${pendingAbort}';`),'t');
  // Abort strategy: project remaining captured activity on main, then perform a
  // second guarded reverse sync before reopening source. Capture writers would
  // have to be quiesced/fenced in production; this sequential test is not that fence.
  assert.equal(drain('main').status,'completed');
  assert.equal(drain('main').queue_id,stopId);
  assert.equal(drain('main').queue_id,voiceId);
  assert.equal(drain('main').status,'empty');
  const reverseBaseline = snapshot('crm');
  sql('crm',rollbackSql(reverseBaseline,snapshot('crm'),snapshot('main')));
  assert.deepEqual(snapshot('crm'),snapshot('main'));
  sql('crm',unfreezeSql());
  sql('crm',`SET ROLE service_role; UPDATE public.crm_contacts SET notes='Synthetic reopened'
    WHERE id='${contact}';`);
  assert.equal(sql('crm',`SELECT count(*) FROM public.lead_intakes WHERE id='${pendingAbort}';`),'1');
  assert.equal(sql('crm',`SELECT count(*) FROM public.lead_events WHERE id='${stopId}' AND event_type='inbound_sms';`),'1');
  assert.equal(sql('crm',`SELECT payload->>'status' FROM public.lead_events
    WHERE event_type='call_started';`),'completed');
  assert.equal(sql('main','SELECT count(*) FROM public.messages;'),'1');
  assert.equal(sql('main','SELECT opted_out FROM public.people;'),'t');
  sql('main',`SELECT public.odeon_crm_persist_captured_sms('${stopId}');`);
  assert.equal(sql('main','SELECT count(*) FROM public.messages;'),'1');
  console.log('PASS: guarded reverse sync retains post-switch edits, keeps source barrier active, and carries pending captured inquiry back before reopening.');
  console.log('PASS: post-switch abort transfers SMS/voice CRM history without reversing main STOP consent or duplicating messages.');

  // Pre-switch abort: no destination records yet. Drop/rebuild ONLY this disposable
  // fixture to rehearse that branch, with source history kept as the new baseline.
  sql('main','DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO service_role;');
  sql('main',`CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text NOT NULL,is_demo boolean);
    INSERT INTO public.tenants VALUES('${tenant}','Synthetic school',false);`);
  sql('main',file('01-schema.sql'));
  mainMessagingFixture();
  for (const name of ['04-capture-queue.sql','05-replay-inquiry.sql',
    '06-replay-sms-history.sql','07-persist-captured-sms.sql',
    '08-replay-voice-status.sql','09-drain-queue.sql']) sql('main',file(name));
  sql('crm',freezeSql());
  const abortBaseline = snapshot('crm');
  const beforeSwitch = capture('main','before-switch-abort');
  const beforeSwitchSms = captureSms('START','b');
  const beforeSwitchVoice = captureVoice(4);
  sql('main',importSql(abortBaseline));
  sql('main',file('02-triggers.sql'));
  assert.equal(drain('main').status,'completed');
  assert.equal(drain('main').queue_id,beforeSwitchSms);
  assert.equal(drain('main').queue_id,beforeSwitchVoice);
  assert.equal(drain('main').status,'empty');
  sql('crm',rollbackSql(abortBaseline,snapshot('crm'),snapshot('main')));
  assert.deepEqual(snapshot('crm'),snapshot('main'));
  sql('crm',unfreezeSql());
  assert.equal(sql('crm',`SELECT count(*) FROM public.lead_intakes WHERE id='${beforeSwitch}';`),'1');
  assert.equal(sql('crm',`SELECT count(*) FROM public.lead_events WHERE id='${beforeSwitchSms}';`),'1');
  assert.equal(sql('crm',`SELECT payload->>'callback_sequence' FROM public.lead_events
    WHERE event_type='call_started';`),'4');
  assert.equal(sql('main','SELECT opted_out FROM public.people;'),'f');
  assert.equal(sql('main','SELECT count(*) FROM public.messages;'),'1');
  console.log('PASS: pre-switch abort preserves capture via local projection and guarded reverse sync.');
  console.log('PASS: pre-switch abort preserves START message/consent and voice sequence while returning CRM history to source.');
  console.log('LIMIT: sequential PostgreSQL fixtures only; no HTTP/API, deployed writer fencing or hosted service validation.');
} catch (error) {
  // Avoid printing SQL/driver detail. This runner only contains synthetic data.
  console.error('FAIL: local cutover rehearsal; inspect assertions privately.');
  // This file accepts no external data. Opt-in detail is only for these fixtures.
  if (process.env.ODEON_SYNTHETIC_DEBUG === '1') console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) run(['rm','-f','-v',name]);
}