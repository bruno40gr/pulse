// Synthetic data only; never loads .env, accepts URLs, or connects to Supabase.
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync, mkdtempSync, realpathSync, chmodSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { importSql, tables } = require('./transfer.cjs');
const { rollbackSql } = require('./rollback-sql.cjs');
const { freezeSql, unfreezeSql } = require('./write-barrier.cjs');
const { writeArtifact } = require('./private-artifacts.cjs');
const docker = existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')
  ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker';
const name = `odeon-crm-transfer-${process.pid}-${Date.now()}`;
const run = (args, input) => execFileSync(docker, args, {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000,
  env: { ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
    PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH || ''}` },
});
const sql = (db, text) => run(['exec', '-i', name, 'psql', '-X', '-q', '-t', '-A',
  '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], text).trim();
const schema = readFileSync(join(__dirname, '01-schema.sql'), 'utf8');
const triggers = readFileSync(join(__dirname, '02-triggers.sql'), 'utf8');
const exportQuery = readFileSync(join(__dirname, '03-export-snapshot.sql'), 'utf8');
const setup = `CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  created_at timestamptz DEFAULT now(), last_synced_at timestamptz, is_demo boolean DEFAULT false);
INSERT INTO public.tenants (id,name,is_demo) VALUES
 ('00000000-0000-0000-0000-000000000001','Synthetic school',false),
 ('00000000-0000-0000-0000-000000000002','Synthetic demo',true);`;
function rejects(db, text, expected) {
  let failed = false;
  try { sql(db, text); } catch (error) {
    failed = true;
    // Never print SQL or driver error detail: a future private snapshot contains PII.
    assert.ok(error.stderr.toString().includes(expected), 'Expected refusal not observed');
  }
  assert.ok(failed, 'Unsafe import unexpectedly succeeded');
}
function empty(db) {
  assert.equal(sql(db, `SELECT ${tables.map(t => `(SELECT count(*) FROM public.${t})`).join('+')};`), '0');
}
let started = false;
const privateDir = mkdtempSync(join(realpathSync(tmpdir()), 'odeon-crm-backup-test-'));
chmodSync(privateDir, 0o700);
try {
  run(['pull', 'postgres:17']);
  run(['run', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_PASSWORD', 'postgres:17']);
  started = true;
  let ready = false;
  for (let i=0; i<60; i++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready=true; break; }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000); }
  }
  assert.ok(ready, 'Local database not ready');
  sql('postgres', `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE DATABASE source; CREATE DATABASE destination; CREATE DATABASE negative;`);
  for (const db of ['source','destination','negative']) {
    sql(db, setup);
    sql(db, schema);
  }
  sql('source', triggers);
  sql('source', `
    INSERT INTO public.crm_contacts(id,tenant_id,full_name,first_name,email,notes,tags)
    VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
      'Synthetic O''Brien 音楽','Synthetic','test@example.invalid',
      E'Comma, newline\\nquote " and dollar $$',ARRAY['one,two','音楽']);
    INSERT INTO public.lead_intakes(id,tenant_id,contact_id,intake_type,source_form,payload)
    VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001','tour_request','synthetic',
      '{"nested":{"null":null,"list":[1,"unicode 音楽","quote \\"",true]}}'::jsonb);
    UPDATE public.lead_intakes SET category='historical_override',status='won';
    INSERT INTO public.lead_events(tenant_id,lead_intake_id,contact_id,event_type,payload)
    VALUES ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      NULL,'synthetic_note','{"note":"keep history"}');
    INSERT INTO public.job_applications(tenant_id,contact_id,full_name,email,message,availability)
    VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
      'Synthetic applicant','applicant@example.invalid',E'Two lines\\nsecond',ARRAY['Monday']);
  `);
  const snapshot = JSON.parse(sql('source', exportQuery));
  const savedSnapshot = writeArtifact(privateDir, 'synthetic-snapshot.json', JSON.stringify(snapshot));
  assert.deepEqual(JSON.parse(readFileSync(savedSnapshot.file, 'utf8')), snapshot);
  // Custom archive contains schema/data, not cluster-global roles or platform settings.
  // Binary stdout must not pass through UTF-8 conversion.
  const archive = execFileSync(docker, ['exec', name, 'pg_dump', '-U', 'postgres',
    '-d', 'source', '--format=custom'], { timeout: 180000,
    stdio: ['ignore','pipe','pipe'], maxBuffer: 64 * 1024 * 1024 });
  const savedArchive = writeArtifact(privateDir, 'synthetic-database.dump', archive);
  sql('postgres', 'CREATE DATABASE restored;');
  run(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', 'restored',
    '--exit-on-error', '--single-transaction'], readFileSync(savedArchive.file));
  assert.deepEqual(JSON.parse(sql('restored', exportQuery)), snapshot);
  assert.equal(sql('restored', `SELECT count(*) FROM pg_trigger
    WHERE tgrelid IN ('public.crm_contacts'::regclass,'public.lead_intakes'::regclass,
      'public.job_applications'::regclass) AND NOT tgisinternal;`), '5');
  assert.equal(sql('restored', `SELECT count(*) FROM pg_class WHERE
    relname IN ('crm_contacts','lead_intakes','lead_events','job_applications') AND relrowsecurity;`), '4');
  assert.equal(sql('restored', `SELECT has_table_privilege('anon','public.crm_contacts','SELECT');`), 'f');
  sql('restored', `SET ROLE service_role;
    INSERT INTO public.lead_intakes(tenant_id,contact_id,intake_type,source_form)
    VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
      'tour_request','restore_test'); RESET ROLE;`);
  assert.equal(sql('restored', 'SELECT count(*) FROM public.lead_events;'), '3');
  console.log('PASS: private snapshot/archive permissions and digests; archive restores records, triggers, RLS, and grants; restored inquiry behavior works.');
  assert.equal(snapshot.tables.lead_events.length, 2);
  assert.equal(snapshot.tables.lead_intakes[0].category, 'historical_override');
  sql('destination', importSql(snapshot));
  assert.deepEqual(JSON.parse(sql('destination', exportQuery)), snapshot);
  console.log('PASS: every field and ID preserved across export/import; no extra history.');
  rejects('destination', importSql(snapshot), 'Destination must be empty');
  const badTenant = structuredClone(snapshot);
  badTenant.tenants[0].name = 'Wrong label';
  rejects('negative', importSql(badTenant), 'Tenant inventory mismatch'); empty('negative');
  const missingColumn = structuredClone(snapshot);
  delete missingColumn.tables.crm_contacts[0].notes;
  rejects('negative', importSql(missingColumn), 'Record column inventory mismatch'); empty('negative');
  const foreignId = structuredClone(snapshot);
  foreignId.tables.lead_intakes[0].contact_id = '90000000-0000-0000-0000-000000000001';
  rejects('negative', importSql(foreignId), 'foreign key constraint'); empty('negative');
  const foreignTenant = structuredClone(snapshot);
  foreignTenant.tables.lead_intakes[0].tenant_id = '00000000-0000-0000-0000-000000000002';
  rejects('negative', importSql(foreignTenant), 'Cross-tenant relationship mismatch'); empty('negative');
  const duplicate = structuredClone(snapshot);
  duplicate.tables.crm_contacts.push(duplicate.tables.crm_contacts[0]);
  assert.throws(() => importSql(duplicate), /duplicate record ID/);
  sql('negative', triggers);
  rejects('negative', importSql(snapshot), 'without user triggers'); empty('negative');
  console.log('PASS: duplicate import, tenant/column mismatch, foreign ID, cross-tenant link, and active triggers refused; failed transactions left no records.');
  // Also exercise empty arrays, including the source's currently empty application table.
  sql('negative', `DROP TRIGGER trg_crm_contacts_updated_at ON public.crm_contacts;
    DROP TRIGGER trg_job_applications_updated_at ON public.job_applications;
    DROP TRIGGER trg_categorize_lead_intake ON public.lead_intakes;
    DROP TRIGGER trg_lead_intakes_updated_at ON public.lead_intakes;
    DROP TRIGGER trg_log_lead_intake_created ON public.lead_intakes;`);
  const blank = structuredClone(snapshot);
  for (const t of tables) blank.tables[t]=[];
  sql('negative', importSql(blank)); empty('negative');
  sql('destination', triggers);
  assert.deepEqual(JSON.parse(sql('destination', exportQuery)), snapshot);
  sql('destination', `SET ROLE service_role;
    INSERT INTO public.lead_intakes(tenant_id,contact_id,intake_type,source_form)
    VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
      'lesson_inquiry','post_transfer_test'); RESET ROLE;`);
  assert.equal(sql('destination', 'SELECT count(*) FROM public.lead_events;'), '3');
  console.log('PASS: empty tables supported; installing triggers preserves history; new backend inquiries generate events.');
  // Database-level application contracts, NOT a PostgREST/browser test.
  assert.equal(sql('destination', `SET ROLE service_role;
    SELECT count(*) FROM public.lead_intakes l
    JOIN public.crm_contacts c ON c.id=l.contact_id
    WHERE l.tenant_id='00000000-0000-0000-0000-000000000001'
      AND l.intake_type='lesson_inquiry'; RESET ROLE;`), '1');
  assert.equal(sql('destination', `SET ROLE service_role;
    SELECT count(*) FROM public.crm_contacts
    WHERE tenant_id='00000000-0000-0000-0000-000000000001'
      AND id='10000000-0000-0000-0000-000000000001'; RESET ROLE;`), '1');
  sql('destination', `BEGIN; SET LOCAL ROLE service_role;
    UPDATE public.lead_intakes SET status='contacted'
    WHERE tenant_id='00000000-0000-0000-0000-000000000001'
      AND id='20000000-0000-0000-0000-000000000001';
    INSERT INTO public.lead_events(tenant_id,lead_intake_id,contact_id,event_type,payload)
    VALUES ('00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001','outbound_sms','{"synthetic":true}');
    ROLLBACK;`);
  assert.equal(sql('destination', `SELECT status FROM public.lead_intakes
    WHERE id='20000000-0000-0000-0000-000000000001';`), 'won');
  assert.equal(sql('destination', 'SELECT count(*) FROM public.lead_events;'), '3');
  for (const role of ['anon', 'authenticated']) {
    for (const table of tables) {
      assert.equal(sql('destination', `SELECT has_table_privilege('${role}',
        'public.${table}', 'SELECT,INSERT,UPDATE,DELETE');`), 'f');
    }
  }
  rejects('destination', `SET ROLE service_role;
    INSERT INTO public.lead_events(tenant_id,lead_intake_id,contact_id,event_type)
    VALUES ('00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001','call_started');`, 'foreign key constraint');
  console.log('PASS: backend list/contact joins, transactional edit/history writes, browser-role restrictions, and foreign call-contact refusal. Not API/browser coverage.');
  sql('destination', `UPDATE public.crm_contacts SET notes='Synthetic post-switch edit';
    DELETE FROM public.lead_events WHERE id=(SELECT id FROM public.lead_events ORDER BY id LIMIT 1);`);
  const afterSwitch = JSON.parse(sql('destination', exportQuery));
  const malformedReplay = structuredClone(afterSwitch);
  const newLead = malformedReplay.tables.lead_intakes.find(r => !snapshot.tables.lead_intakes.some(old => old.id === r.id));
  assert.ok(newLead, 'Post-switch addition required for refusal test');
  delete newLead.source_page;
  rejects('source', rollbackSql(snapshot, snapshot, malformedReplay), 'Record column inventory mismatch');
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), snapshot);
  assert.equal(sql('source', `SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
    AND tgrelid IN (${tables.map(t => `'public.${t}'::regclass`).join(',')}) AND tgenabled <> 'O';`), '0');
  sql('source', rollbackSql(snapshot, snapshot, afterSwitch));
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), afterSwitch);
  assert.equal(sql('source', `SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
    AND tgrelid IN (${tables.map(t => `'public.${t}'::regclass`).join(',')}) AND tgenabled <> 'O';`), '0');
  // A source change after planning must be detected under database locks.
  rejects('source', rollbackSql(snapshot, snapshot, afterSwitch), 'baseline reconciliation failed');
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), afterSwitch);
  sql('source', `INSERT INTO public.lead_intakes(tenant_id,contact_id,intake_type,source_form)
    VALUES ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
      'tour_request','after_rollback');`);
  assert.equal(sql('source', 'SELECT count(*) FROM public.lead_events;'), '3');
  console.log('PASS: guarded reverse replay preserves complete records, refuses stale baseline, and restores triggers.');
  const beforeFreeze = JSON.parse(sql('source', exportQuery));
  sql('source', freezeSql());
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), beforeFreeze);
  for (const t of tables) {
    rejects('source', `SET ROLE service_role; UPDATE public.${t} SET id=id;`, 'write barrier active');
    rejects('source', `SET ROLE service_role; DELETE FROM public.${t};`, 'write barrier active');
    rejects('source', `SET ROLE service_role; INSERT INTO public.${t} SELECT * FROM public.${t} WHERE false;`, 'write barrier active');
    // Owner-level truncation and replica-mode writes must also be blocked.
    rejects('source', `TRUNCATE public.${t} CASCADE;`, 'write barrier active');
    rejects('source', `SET session_replication_role=replica; UPDATE public.${t} SET id=id;`, 'write barrier active');
    assert.equal(sql('source', `SELECT count(*) FROM pg_trigger WHERE tgrelid='public.${t}'::regclass
      AND tgname='odeon_crm_cutover_write_barrier' AND tgenabled='A';`), '1');
  }
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), beforeFreeze);
  rejects('source', freezeSql(), 'already exists');
  sql('source', unfreezeSql());
  assert.deepEqual(JSON.parse(sql('source', exportQuery)), beforeFreeze);
  sql('source', `SET ROLE service_role; UPDATE public.crm_contacts SET notes='Synthetic after unfreeze';`);
  assert.equal(sql('source', `SELECT count(*) FROM public.crm_contacts WHERE notes='Synthetic after unfreeze';`), '1');
  console.log('PASS: source barrier blocks all four tables, owner truncation and replica writes; reads remain available; removal restores writes. No capture/replay coverage.');
  sql('source', readFileSync(join(__dirname, '04-capture-queue.sql'), 'utf8'));
  const capture = `SELECT public.odeon_crm_capture(
    '00000000-0000-0000-0000-000000000001','intake','synthetic-delivery',
    '{"full_name":"Synthetic queue test","email":"queue@example.invalid"}'::jsonb);`;
  const queueId = sql('source', `SET ROLE service_role; ${capture}`);
  assert.equal(sql('source', `SET ROLE service_role; ${capture}`), queueId);
  rejects('source', capture.replace('Synthetic queue test', 'Different payload'), 'Capture key conflict');
  assert.equal(sql('source', 'SELECT count(*) FROM public.odeon_crm_cutover_queue;'), '1');
  for (const role of ['anon', 'authenticated']) {
    assert.equal(sql('source', `SELECT has_table_privilege('${role}',
      'public.odeon_crm_cutover_queue','SELECT,INSERT,UPDATE,DELETE');`), 'f');
    assert.equal(sql('source', `SELECT has_function_privilege('${role}',
      'public.odeon_crm_capture(uuid,text,text,jsonb)','EXECUTE');`), 'f');
  }
  sql('source', freezeSql());
  // Capture remains possible while CRM records are frozen; no CRM write is attempted.
  sql('source', capture.replace('synthetic-delivery', 'synthetic-during-freeze'));
  sql('source', unfreezeSql());
  const claim = `SELECT id FROM public.odeon_crm_cutover_queue
    WHERE completed_at IS NULL ORDER BY received_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`;
  const effect = `INSERT INTO public.job_applications(tenant_id,full_name,email,message)
    VALUES ('00000000-0000-0000-0000-000000000001',
      'Synthetic replay','queue@example.invalid','Synthetic only');`;
  const countBefore = sql('source', 'SELECT count(*) FROM public.job_applications;');
  // A processing failure must undo both its effect and completion mark.
  rejects('source', `BEGIN; SET LOCAL ROLE service_role;
    CREATE TEMP TABLE claimed AS ${claim}; ${effect}
    UPDATE public.odeon_crm_cutover_queue SET completed_at=now() WHERE id IN (SELECT id FROM claimed);
    SELECT 1/0; COMMIT;`, 'division by zero');
  assert.equal(sql('source', 'SELECT count(*) FROM public.job_applications;'), countBefore);
  assert.equal(sql('source', 'SELECT count(*) FROM public.odeon_crm_cutover_queue WHERE completed_at IS NULL;'), '2');
  // Competing worker must skip a row held by another session.
  run(['exec', '-d', name, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'source',
    '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN; SELECT id FROM public.odeon_crm_cutover_queue
      FOR UPDATE; SELECT pg_advisory_xact_lock(8675309); SELECT pg_sleep(8); ROLLBACK;`]);
  let locked = false;
  for (let i=0;i<40;i++) {
    if (sql('source', `SELECT count(*) FROM pg_locks WHERE locktype='advisory'
      AND objid=8675309 AND granted;`) === '1') { locked=true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  assert.ok(locked, 'Competing session did not acquire queue locks');
  assert.equal(sql('source', `BEGIN; SET LOCAL ROLE service_role; ${claim}; ROLLBACK;`), '');
  for (let i=0;i<100;i++) {
    if (sql('source', `SELECT count(*) FROM pg_locks WHERE locktype='advisory'
      AND objid=8675309 AND granted;`) === '0') break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);
  }
  // Synthetic stand-in for a future transactional replay RPC, not an actual intake worker.
  sql('source', `BEGIN; SET LOCAL ROLE service_role;
    CREATE TEMP TABLE claimed AS ${claim}; ${effect}
    UPDATE public.odeon_crm_cutover_queue SET completed_at=now() WHERE id IN (SELECT id FROM claimed);
    COMMIT;`);
  assert.equal(sql('source', 'SELECT count(*) FROM public.odeon_crm_cutover_queue WHERE completed_at IS NOT NULL;'), '1');
  assert.equal(sql('source', `SET ROLE service_role; ${capture}`), queueId);
  assert.equal(sql('source', 'SELECT count(*) FROM public.odeon_crm_cutover_queue;'), '2');
  console.log('PASS: durable capture during freeze, key dedup/conflict refusal, browser-role denial, failure rollback and competing-worker exclusion. Synthetic replay effect only; no route integration.');
  sql('destination', readFileSync(join(__dirname, '04-capture-queue.sql'), 'utf8'));
  sql('destination', readFileSync(join(__dirname, '05-replay-inquiry.sql'), 'utf8'));
  const inquiryCapture = `SELECT public.odeon_crm_capture(
    '00000000-0000-0000-0000-000000000001','intake','actual-replay-test',
    '{"full_name":"Synthetic Inquiry","email":"new-inquiry@example.invalid",
      "intake_type":"tour_request","source_form":"synthetic-tour","payload":{"source":"website"}}'::jsonb);`;
  const inquiryId = sql('destination', `SET ROLE service_role; ${inquiryCapture}`);
  sql('destination', `UPDATE public.odeon_crm_cutover_queue SET received_at='2026-01-01T12:00:00Z' WHERE id='${inquiryId}';`);
  const replay = `SELECT public.odeon_crm_replay_inquiry('${inquiryId}'::uuid);`;
  sql('destination', freezeSql());
  rejects('destination', `SET ROLE service_role; ${replay}`, 'write barrier active');
  assert.equal(sql('destination', `SELECT count(*) FROM public.crm_contacts WHERE email='new-inquiry@example.invalid';`), '0');
  assert.equal(sql('destination', `SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${inquiryId}';`), 't');
  sql('destination', unfreezeSql());
  assert.equal(sql('destination', `SET ROLE service_role; ${replay}`), inquiryId);
  assert.equal(sql('destination', `SET ROLE service_role; ${replay}`), inquiryId);
  assert.equal(sql('destination', `SELECT count(*) FROM public.lead_events WHERE lead_intake_id='${inquiryId}';`), '1');
  assert.equal(sql('destination', `SELECT category||','||priority||','||temperature FROM public.lead_intakes WHERE id='${inquiryId}';`), 'tour,high,hot');
  assert.equal(sql('destination', `SELECT bool_and(created_at='2026-01-01T12:00:00Z') FROM public.lead_events WHERE lead_intake_id='${inquiryId}';`), 't');
  assert.equal(sql('destination', `SELECT created_at='2026-01-01T12:00:00Z' FROM public.lead_intakes WHERE id='${inquiryId}';`), 't');
  const beforeMatch = sql('destination', `SELECT row_to_json(c)::text FROM public.crm_contacts c WHERE email='new-inquiry@example.invalid';`);
  const matchedId = sql('destination', inquiryCapture.replace('actual-replay-test','matched-replay-test').replace('Synthetic Inquiry','Different submitted name'));
  sql('destination', `SET ROLE service_role; SELECT public.odeon_crm_replay_inquiry('${matchedId}');`);
  assert.equal(sql('destination', `SELECT row_to_json(c)::text FROM public.crm_contacts c WHERE email='new-inquiry@example.invalid';`), beforeMatch);
  const invalidId = sql('destination', inquiryCapture.replace('actual-replay-test','invalid-replay-test').replace('"email"','"missing_email"'));
  rejects('destination', `SET ROLE service_role; SELECT public.odeon_crm_replay_inquiry('${invalidId}');`, 'Unsupported or invalid inquiry');
  assert.equal(sql('destination', `SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${invalidId}';`), 't');
  for (const role of ['anon','authenticated']) {
    assert.equal(sql('destination', `SELECT has_function_privilege('${role}',
      'public.odeon_crm_replay_inquiry(uuid)','EXECUTE');`), 'f');
  }
  console.log('PASS: actual inquiry replay creates contact/lead/history atomically, classifies tours, preserves receipt time, is retry-safe, protects existing identity and leaves failures pending. No HTTP integration.');
  // Invalid queue item blocks ordered intake processing until deliberately corrected.
  rejects('destination', `SELECT public.odeon_crm_replay_inquiry('${invalidId}');`, 'Unsupported or invalid inquiry');
  sql('destination', `UPDATE public.odeon_crm_cutover_queue SET payload=payload||'{"email":"new-inquiry@example.invalid"}'::jsonb WHERE id='${invalidId}';
    SELECT public.odeon_crm_replay_inquiry('${invalidId}');`);
  const applicationId = sql('destination', `SELECT public.odeon_crm_capture(
    '00000000-0000-0000-0000-000000000001','intake','application-replay',
    '{"full_name":"Synthetic Applicant","email":"applicant@example.invalid",
    "intake_type":"job_application","source_form":"careers","payload":{
    "positions":["Voice",42,"Piano"],"availability":["Monday"],"message":"Synthetic application"}}');`);
  const applicationReplay = `SELECT public.odeon_crm_replay_inquiry('${applicationId}');`;
  sql('destination', freezeSql());
  rejects('destination', applicationReplay, 'write barrier active');
  assert.equal(sql('destination', `SELECT count(*) FROM public.crm_contacts WHERE email='applicant@example.invalid';`), '0');
  sql('destination', unfreezeSql());
  assert.equal(sql('destination', `SET ROLE service_role; ${applicationReplay}`), applicationId);
  assert.equal(sql('destination', `SET ROLE service_role; ${applicationReplay}`), applicationId);
  assert.equal(sql('destination', `SELECT positions=ARRAY['Voice','Piano'] AND availability=ARRAY['Monday']
    AND message='Synthetic application' FROM public.job_applications WHERE id='${applicationId}';`), 't');
  assert.equal(sql('destination', `SELECT count(*) FROM public.lead_intakes WHERE id='${applicationId}';`), '0');
  assert.equal(sql('destination', `SELECT a.created_at=q.received_at AND a.updated_at=q.received_at
    FROM public.job_applications a JOIN public.odeon_crm_cutover_queue q ON q.id=a.id WHERE a.id='${applicationId}';`), 't');
  console.log('PASS: application contact/application/completion is atomic and retry-safe; string arrays and receipt times preserved; no inquiry created.');
  const phoneApplication = `SELECT public.odeon_crm_capture(
    '00000000-0000-0000-0000-000000000001','intake','phone-application',
    '{"full_name":"Synthetic Phone Applicant","phone":"+12025550199",
      "intake_type":"job_application","source_form":"careers","payload":{}}');`;
  const phoneId = sql('destination', phoneApplication);
  for (let retry=0;retry<2;retry++) {
    assert.equal(sql('destination', `SET ROLE service_role; SELECT public.odeon_crm_replay_inquiry('${phoneId}');`), phoneId);
  }
  assert.equal(sql('destination', `SELECT a.email='' AND a.phone='+12025550199'
    AND c.email IS NULL AND a.positions='{}'::text[] AND a.availability='{}'::text[]
    AND q.completed_at IS NOT NULL FROM public.job_applications a
    JOIN public.crm_contacts c ON c.id=a.contact_id
    JOIN public.odeon_crm_cutover_queue q ON q.id=a.id WHERE a.id='${phoneId}';`), 't');
  const noContactId = sql('destination', phoneApplication.replace('phone-application','no-contact-application').replace('"phone"','"unused_phone"'));
  const beforeRefusal = sql('destination', 'SELECT count(*) FROM public.crm_contacts;');
  rejects('destination', `SET ROLE service_role; SELECT public.odeon_crm_replay_inquiry('${noContactId}');`, 'Unsupported or invalid inquiry');
  assert.equal(sql('destination', 'SELECT count(*) FROM public.crm_contacts;'), beforeRefusal);
  assert.equal(sql('destination', `SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${noContactId}';`), 't');
  console.log('PASS: phone-only application accepted once with existing email semantics; neither-email-nor-phone refused without partial writes.');
  // Resolve prior invalid synthetic intake before exercising ordered SMS replay.
  sql('destination', `UPDATE public.odeon_crm_cutover_queue SET payload=payload||'{"phone":"+12025550199"}'::jsonb WHERE id='${noContactId}';
    SELECT public.odeon_crm_replay_inquiry('${noContactId}');`);
  sql('destination', readFileSync(join(__dirname,'06-replay-sms-history.sql'),'utf8'));
  sql('destination', `UPDATE public.crm_contacts SET phone='+12025550188' WHERE email='new-inquiry@example.invalid';`);
  const smsCapture = `SELECT public.odeon_crm_capture('00000000-0000-0000-0000-000000000001',
    'inbound_sms','SM00000000000000000000000000000001',
    '{"message_sid":"SM00000000000000000000000000000001","from_phone":"+12025550188"}');`;
  const smsId = sql('destination',smsCapture);
  const smsReplay = `SELECT public.odeon_crm_replay_sms_history('${smsId}');`;
  sql('destination',freezeSql());
  rejects('destination',smsReplay,'write barrier active');
  assert.equal(sql('destination',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${smsId}';`),'t');
  sql('destination',unfreezeSql());
  assert.equal(sql('destination',`SET ROLE service_role; ${smsReplay}`),smsId);
  assert.equal(sql('destination',`SET ROLE service_role; ${smsReplay}`),smsId);
  assert.equal(sql('destination',`SELECT count(*) FROM public.lead_events WHERE payload->>'twilio_sid'='SM00000000000000000000000000000001';`),'1');
  assert.equal(sql('destination',`SELECT e.created_at=q.received_at FROM public.lead_events e
    JOIN public.odeon_crm_cutover_queue q ON q.id=e.id WHERE e.id='${smsId}';`),'t');
  const unknownSms = sql('destination',smsCapture.replaceAll('00000000000000000000000000000001','00000000000000000000000000000002').replace('+12025550188','+12025550177'));
  rejects('destination',`SET ROLE service_role; SELECT public.odeon_crm_replay_sms_history('${unknownSms}');`,'SMS contact unresolved');
  assert.equal(sql('destination',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${unknownSms}';`),'t');
  const laterInquiry = sql('destination', inquiryCapture.replace('actual-replay-test','after-unresolved-sms'));
  rejects('destination',`SET ROLE service_role; SELECT public.odeon_crm_replay_inquiry('${laterInquiry}');`,'Earlier queued event pending');
  assert.equal(sql('destination',`SELECT count(*) FROM public.lead_intakes WHERE id='${laterInquiry}';`),'0');
  // Correct only this synthetic sender; production correction requires an audited procedure.
  sql('destination',`UPDATE public.odeon_crm_cutover_queue SET payload=jsonb_set(payload,'{from_phone}','"+12025550188"') WHERE id='${unknownSms}';`);
  sql('destination',`SET ROLE service_role; SELECT public.odeon_crm_replay_sms_history('${unknownSms}');
    SELECT public.odeon_crm_replay_inquiry('${laterInquiry}');`);
  const invalidSms = sql('destination',smsCapture.replaceAll('00000000000000000000000000000001','00000000000000000000000000000003'));
  sql('destination',`UPDATE public.odeon_crm_cutover_queue SET payload=jsonb_set(payload,'{message_sid}','"invalid"') WHERE id='${invalidSms}';`);
  rejects('destination',`SELECT public.odeon_crm_replay_sms_history('${invalidSms}');`,'Invalid SMS history payload');
  sql('destination',`UPDATE public.odeon_crm_cutover_queue SET payload=jsonb_set(payload,'{message_sid}','"SM00000000000000000000000000000004"') WHERE id='${invalidSms}';`);
  rejects('destination',`SELECT public.odeon_crm_replay_sms_history('${invalidSms}');`,'SMS delivery key mismatch');
  sql('destination',`UPDATE public.odeon_crm_cutover_queue SET payload=jsonb_set(payload,'{message_sid}',to_jsonb(delivery_key))||'{"tenant_id":"00000000-0000-0000-0000-000000000002"}'::jsonb WHERE id='${invalidSms}';`);
  rejects('destination',`SELECT public.odeon_crm_replay_sms_history('${invalidSms}');`,'Payload tenant mismatch');
  sql('destination',`UPDATE public.odeon_crm_cutover_queue SET payload=payload-'tenant_id' WHERE id='${invalidSms}';
    INSERT INTO public.crm_contacts(tenant_id,full_name,phone) VALUES
    ('00000000-0000-0000-0000-000000000001','Synthetic ambiguous sender','+12025550188');`);
  rejects('destination',`SELECT public.odeon_crm_replay_sms_history('${invalidSms}');`,'Ambiguous SMS contact');
  assert.equal(sql('destination',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${invalidSms}';`),'t');
  assert.equal(sql('destination',`SELECT count(*) FROM public.lead_events WHERE id='${invalidSms}';`),'0');
  console.log('PASS: mixed-kind ordering; invalid SID, delivery-key/tenant mismatch and ambiguous sender refused without history writes.');
  for (const role of ['anon','authenticated']) {
    assert.equal(sql('destination',`SELECT has_function_privilege('${role}',
      'public.odeon_crm_replay_sms_history(uuid)','EXECUTE');`),'f');
  }
  console.log('PASS: SMS history replay is atomic, retry-safe, tenant-scoped and receipt-timed; unresolved senders remain pending. Does not replay messages, consent or voice callbacks.');
  // Independent fixture DB: no production schema changes or customer records.
  sql('negative', readFileSync(join(__dirname,'04-capture-queue.sql'),'utf8'));
  sql('negative', `CREATE TABLE public.people(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,
    phone text,opted_out boolean DEFAULT false);
    CREATE TABLE public.campaigns(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TABLE public.messages(id uuid PRIMARY KEY,tenant_id uuid,contact_id uuid REFERENCES public.people(id),
    campaign_id uuid REFERENCES public.campaigns(id),
    channel text NOT NULL,direction text NOT NULL,body text,status text,twilio_sid text,
    created_at timestamptz DEFAULT now(),from_phone text,to_phone text);
    GRANT SELECT,INSERT ON public.messages TO service_role;
    GRANT SELECT,UPDATE ON public.people TO service_role;
    GRANT SELECT ON public.campaigns TO service_role;
    INSERT INTO public.people VALUES('10000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000001','+12025550111',false);`);
  sql('negative',readFileSync(join(__dirname,'07-persist-captured-sms.sql'),'utf8'));
  const captureSms = body => `SELECT public.odeon_crm_capture(
    '00000000-0000-0000-0000-000000000001','inbound_sms',
    'SM${body === 'STOP' ? 'a' : 'b'}${'0'.repeat(31)}',
    '${JSON.stringify({ message_sid: `SM${body === 'STOP' ? 'a' : 'b'}${'0'.repeat(31)}`,
      from_phone: '+12025550111', to_phone: '+12025550122', body })}'::jsonb);`;
  const stop = sql('negative',captureSms('STOP'));
  const start = sql('negative',captureSms('START'));
  rejects('negative',`SELECT public.odeon_crm_persist_captured_sms('${start}');`,'Earlier SMS pending');
  sql('negative',`ALTER TABLE public.messages ADD CONSTRAINT synthetic_failure CHECK (body<>'STOP');`);
  rejects('negative',`SELECT public.odeon_crm_persist_captured_sms('${stop}');`,'synthetic_failure');
  assert.equal(sql('negative','SELECT opted_out FROM public.people;'),'f');
  assert.equal(sql('negative',`SELECT message_persisted_at IS NULL FROM public.odeon_crm_cutover_queue WHERE id='${stop}';`),'t');
  sql('negative','ALTER TABLE public.messages DROP CONSTRAINT synthetic_failure;');
  sql('negative',`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${stop}');`);
  assert.equal(sql('negative','SELECT opted_out FROM public.people;'),'t');
  sql('negative',`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${start}');
    SELECT public.odeon_crm_persist_captured_sms('${stop}');`);
  assert.equal(sql('negative','SELECT opted_out FROM public.people;'),'f');
  assert.equal(sql('negative','SELECT count(*) FROM public.messages;'),'2');
  assert.equal(sql('negative',`SELECT bool_and(m.created_at=q.received_at AND q.completed_at IS NULL)
    FROM public.messages m JOIN public.odeon_crm_cutover_queue q ON q.id=m.id;`),'t');
  for (const role of ['anon','authenticated']) assert.equal(sql('negative',
    `SELECT has_function_privilege('${role}','public.odeon_crm_persist_captured_sms(uuid)','EXECUTE');`),'f');
  sql('negative',`INSERT INTO public.campaigns VALUES
    ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
    UPDATE public.people SET phone='+12025550999';
    INSERT INTO public.messages(id,tenant_id,contact_id,campaign_id,channel,direction,to_phone,created_at)
    VALUES('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000099','30000000-0000-0000-0000-000000000001',
    'sms','outbound','2025550111',now());`);
  const reply = sql('negative',captureSms('Reply').replaceAll(`SMb${'0'.repeat(31)}`,`SMc${'0'.repeat(31)}`));
  sql('negative',`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${reply}');`);
  assert.equal(sql('negative',`SELECT contact_id::text||':'||campaign_id::text FROM public.messages WHERE id='${reply}';`),
    '10000000-0000-0000-0000-000000000099:30000000-0000-0000-0000-000000000001');
  sql('negative',`UPDATE public.campaigns SET tenant_id='00000000-0000-0000-0000-000000000002';`);
  const foreignReply = sql('negative',captureSms('Reply').replaceAll(`SMb${'0'.repeat(31)}`,`SMd${'0'.repeat(31)}`));
  rejects('negative',`SELECT public.odeon_crm_persist_captured_sms('${foreignReply}');`,'Outbound SMS campaign tenant mismatch');
  assert.equal(sql('negative',`SELECT count(*) FROM public.messages WHERE id='${foreignReply}';`),'0');
  console.log('PASS: latest outbound sender match and campaign preserved; foreign campaign refused without message writes.');
  console.log('PASS: atomic SMS/consent persistence, failure rollback, STOP/START ordering and retry without reapplying old STOP; history remains pending. Fixture schema only.');
  // Clear intentionally unresolved synthetic captures before independent voice tests.
  sql('destination','DELETE FROM public.odeon_crm_cutover_queue;');
  sql('destination',readFileSync(join(__dirname,'08-replay-voice-status.sql'),'utf8'));
  const voiceSid = `CA${'7'.repeat(32)}`;
  const voiceEvent = sql('destination',`INSERT INTO public.lead_events
    (tenant_id,lead_intake_id,contact_id,event_type,payload)
    SELECT tenant_id,id,contact_id,'call_started',
      jsonb_build_object('call_sid','${voiceSid}','retained','synthetic')
    FROM public.lead_intakes ORDER BY id LIMIT 1 RETURNING id;`);
  const voiceTenant = sql('destination',`SELECT tenant_id FROM public.lead_events WHERE id='${voiceEvent}';`);
  const captureVoice = (sequence,status,duration=null,tenant=voiceTenant,sid=voiceSid) => sql('destination',
    `SELECT public.odeon_crm_capture('${tenant}','voice_status','${sid}:${sequence}',
      '${JSON.stringify({call_sid:sid,status,sequence,duration})}'::jsonb);`);
  const completedVoice = captureVoice(3,'completed',42);
  sql('destination',`SET ROLE service_role; SELECT public.odeon_crm_replay_voice_status('${completedVoice}');`);
  const oldVoice = captureVoice(1,'ringing');
  sql('destination',`SELECT public.odeon_crm_replay_voice_status('${oldVoice}');
    SELECT public.odeon_crm_replay_voice_status('${completedVoice}');`);
  assert.equal(sql('destination',`SELECT payload->>'status'||':'||(payload->>'duration')||':'||
    (payload->>'retained') FROM public.lead_events WHERE id='${voiceEvent}';`),'completed:42:synthetic');
  assert.equal(sql('destination',`SELECT count(*) FROM public.odeon_crm_cutover_queue
    WHERE completed_at IS NULL;`),'0');
  const unknownVoice = captureVoice(0,'ringing',null,voiceTenant,`CA${'8'.repeat(32)}`);
  rejects('destination',`SELECT public.odeon_crm_replay_voice_status('${unknownVoice}');`,'Voice history unresolved');
  assert.equal(sql('destination',`SELECT completed_at IS NULL FROM public.odeon_crm_cutover_queue
    WHERE id='${unknownVoice}';`),'t');
  const laterVoice = captureVoice(4,'completed',43);
  rejects('destination',`SELECT public.odeon_crm_replay_voice_status('${laterVoice}');`,'Earlier queued event pending');
  // Drop only the intentionally unresolved synthetic fixture to continue independent tests.
  sql('destination',`DELETE FROM public.odeon_crm_cutover_queue WHERE id='${unknownVoice}';`);
  sql('destination',`SELECT public.odeon_crm_replay_voice_status('${laterVoice}');`);
  const invalidVoice = captureVoice(5,'bogus');
  rejects('destination',`SELECT public.odeon_crm_replay_voice_status('${invalidVoice}');`,'Invalid voice payload');
  sql('destination',`DELETE FROM public.odeon_crm_cutover_queue WHERE id='${invalidVoice}';`);
  const foreignVoiceTenant = voiceTenant === '00000000-0000-0000-0000-000000000001'
    ? '00000000-0000-0000-0000-000000000002' : '00000000-0000-0000-0000-000000000001';
  const foreignVoice = captureVoice(5,'completed',45,foreignVoiceTenant);
  rejects('destination',`SELECT public.odeon_crm_replay_voice_status('${foreignVoice}');`,'Voice history unresolved');
  assert.equal(sql('destination',`SELECT payload->>'duration' FROM public.lead_events WHERE id='${voiceEvent}';`),'43');
  for (const role of ['anon','authenticated']) assert.equal(sql('destination',
    `SELECT has_function_privilege('${role}','public.odeon_crm_replay_voice_status(uuid)','EXECUTE');`),'f');
  console.log('PASS: atomic voice replay preserves payload, ignores older sequences, retries safely, and refuses unresolved/foreign/invalid callbacks.');
  sql('destination',readFileSync(join(__dirname,'09-drain-queue.sql'),'utf8'));
  const blockedDrain = JSON.parse(sql('destination','SET ROLE service_role; SELECT public.odeon_crm_drain_next();'));
  assert.equal(blockedDrain.status,'blocked');
  assert.equal(blockedDrain.queue_id,foreignVoice);
  assert.equal(blockedDrain.reason,'reconciliation_required');
  const pendingInquiry = sql('destination',`SELECT public.odeon_crm_capture('${voiceTenant}',
    'intake','drain-synthetic-inquiry',
    '{"intake_type":"lesson_inquiry","source_form":"drain-test","full_name":"Synthetic drain person","email":"drain@example.invalid","payload":{}}'::jsonb);`);
  assert.equal(JSON.parse(sql('destination','SELECT public.odeon_crm_drain_next();')).queue_id,foreignVoice);
  assert.equal(sql('destination',`SELECT count(*) FROM public.lead_intakes WHERE id='${pendingInquiry}';`),'0');
  // Only remove a deliberately invalid synthetic fixture, never a production item.
  sql('destination',`DELETE FROM public.odeon_crm_cutover_queue WHERE id='${foreignVoice}';`);
  const completedDrain = JSON.parse(sql('destination','SET ROLE service_role; SELECT public.odeon_crm_drain_next();'));
  assert.equal(completedDrain.status,'completed');
  assert.equal(completedDrain.queue_id,pendingInquiry);
  assert.equal(JSON.parse(sql('destination','SELECT public.odeon_crm_drain_next();')).status,'empty');
  for (const role of ['anon','authenticated']) assert.equal(sql('destination',
    `SELECT has_function_privilege('${role}','public.odeon_crm_drain_next()','EXECUTE');`),'f');
  // An unmatched SMS can persist in main, but a failed combined replay must roll
  // that attempt back and keep its queue entry pending, without revealing payload.
  sql('negative',readFileSync(join(__dirname,'08-replay-voice-status.sql'),'utf8'));
  sql('negative',readFileSync(join(__dirname,'09-drain-queue.sql'),'utf8'));
  sql('negative','DELETE FROM public.odeon_crm_cutover_queue;');
  const unresolvedSms = sql('negative',captureSms('Private synthetic body')
    .replaceAll(`SMb${'0'.repeat(31)}`,`SMe${'0'.repeat(31)}`)
    .replaceAll('+12025550111','+12025550888'));
  const smsDrain = JSON.parse(sql('negative','SELECT public.odeon_crm_drain_next();'));
  assert.equal(smsDrain.status,'blocked');
  assert.equal(smsDrain.queue_id,unresolvedSms);
  assert.ok(!JSON.stringify(smsDrain).includes('Private synthetic body'));
  assert.equal(sql('negative',`SELECT count(*) FROM public.messages WHERE id='${unresolvedSms}';`),'0');
  assert.equal(sql('negative',`SELECT message_persisted_at IS NULL AND completed_at IS NULL
    FROM public.odeon_crm_cutover_queue WHERE id='${unresolvedSms}';`),'t');
  console.log('PASS: ordered queue drain completes inquiries, blocks unresolved items without skipping or exposing PII, and rolls back partial SMS effects.');
  console.log('PASS: isolated synthetic transfer/backup rehearsal (no live access; temporary private synthetic files removed).');
} finally {
  try { if (started) run(['rm','-f','-v',name]); }
  finally { rmSync(privateDir, { recursive: true, force: true }); }
}