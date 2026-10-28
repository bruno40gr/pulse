/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local-only PostgreSQL rehearsal. */
// Never loads .env, connects to Supabase, or publishes database ports.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const root = path.resolve(__dirname, '../..')
const docker = existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')
  ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker'
const name = `odeon-gmail-rehearsal-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync(docker, args, {
  input, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'],
})
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], text).trim()
const tenant = '00000000-0000-0000-0000-000000000001'
const otherTenant = '00000000-0000-0000-0000-000000000002'
const contact = '10000000-0000-0000-0000-000000000001'
const lead = '20000000-0000-0000-0000-000000000001'
const mailbox = '30000000-0000-0000-0000-000000000001'
const actor = '40000000-0000-0000-0000-000000000001'
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
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);
    INSERT INTO public.tenants VALUES ('${tenant}'), ('${otherTenant}');`)
  sql(readFileSync(path.join(root, 'scripts/crm-consolidation/01-schema.sql'), 'utf8'))
  sql(readFileSync(path.join(root, 'scripts/crm-consolidation/12-gmail-outreach.sql'), 'utf8'))
  sql(`SET ROLE service_role;
    INSERT INTO crm_contacts(id,tenant_id,full_name) VALUES('${contact}','${tenant}','Synthetic parent');
    INSERT INTO lead_intakes(id,tenant_id,contact_id,intake_type,source_form)
      VALUES('${lead}','${tenant}','${contact}','lesson_inquiry','synthetic');
    INSERT INTO gmail_connections(id,tenant_id,email,refresh_token_ciphertext,connected_by)
      VALUES('${mailbox}','${tenant}','office@example.invalid','synthetic-ciphertext','${actor}');`)
  assert.equal(sql(`SELECT count(*) FROM gmail_claim_sync('${mailbox}','${otherTenant}');`), '0')
  assert.equal(sql(`SELECT count(*) FROM gmail_claim_sync('${mailbox}','${tenant}');`), '1')
  assert.equal(sql(`SELECT count(*) FROM gmail_claim_sync('${mailbox}','${tenant}');`), '0')
  for (const role of ['anon', 'authenticated']) {
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM gmail_connections;`))
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM gmail_outreach;`))
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM gmail_claim_sync('${mailbox}','${tenant}');`))
    assert.throws(() => sql(`SET ROLE ${role}; SELECT gmail_record_outreach('${tenant}',gen_random_uuid(),'${lead}','note','booked','${actor}');`))
  }
  let sequence = 0
  const receipt = () => sql(`INSERT INTO gmail_outreach(tenant_id,connection_id,fingerprint,provider_message_id,
    sender,recipients,subject,body,sent_at,candidate_lead_ids)
    VALUES('${tenant}','${mailbox}','fingerprint-${++sequence}','message-${sequence}',
    'office@example.invalid',ARRAY['parent@example.invalid'],'Synthetic outreach','Synthetic body',now(),ARRAY['${lead}'::uuid]) RETURNING id;`)
  const record = (id, decision, targetTenant = tenant) => sql(`SET ROLE service_role;
    SELECT gmail_record_outreach('${targetTenant}','${id}','${lead}','Email sent on test date','${decision}','${actor}');`)
  const first = receipt()
  assert.throws(() => record(first, 'contacted', otherTenant))
  assert.equal(sql('SELECT count(*) FROM lead_events;'), '0')
  record(first, 'contacted')
  record(first, 'contacted')
  assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), 'contacted')
  assert.equal(sql("SELECT count(*) FROM lead_events WHERE event_type='note_added';"), '1')
  assert.throws(() => sql(`INSERT INTO gmail_outreach(tenant_id,connection_id,fingerprint,provider_message_id,sender,recipients,subject,body,sent_at,candidate_lead_ids)
    SELECT tenant_id,connection_id,fingerprint,'another-provider-id',sender,recipients,subject,body,sent_at,candidate_lead_ids
    FROM gmail_outreach WHERE id='${first}';`))
  const invalidCandidate = receipt()
  sql(`UPDATE gmail_outreach SET candidate_lead_ids='{}' WHERE id='${invalidCandidate}';`)
  assert.throws(() => record(invalidCandidate, 'booked'))
  assert.equal(sql(`SELECT status FROM gmail_outreach WHERE id='${invalidCandidate}';`), 'review')
  record(receipt(), 'booked')
  assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), 'booked')
  record(receipt(), 'contacted')
  assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), 'booked', 'No downgrade')
  for (const status of ['processing', 'won', 'enrolled']) {
    sql(`UPDATE lead_intakes SET status='${status}' WHERE id='${lead}';`)
    for (const decision of ['contacted', 'booked']) {
      const id = receipt()
      const beforeNotes = Number(sql("SELECT count(*) FROM lead_events WHERE event_type='note_added';"))
      const beforeChanges = sql("SELECT count(*) FROM lead_events WHERE event_type='status_automated';")
      record(id, decision)
      record(id, decision)
      assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), status, 'Converted status never regresses')
      assert.equal(Number(sql("SELECT count(*) FROM lead_events WHERE event_type='note_added';")), beforeNotes + 1, 'One note per message')
      assert.equal(sql("SELECT count(*) FROM lead_events WHERE event_type='status_automated';"), beforeChanges)
      assert.equal(sql(`SELECT count(*) FROM lead_events e JOIN gmail_outreach m ON m.event_id=e.id
        WHERE m.id='${id}' AND m.status='recorded' AND m.lead_id='${lead}'
        AND e.contact_id='${contact}' AND e.lead_intake_id='${lead}' AND e.tenant_id='${tenant}';`), '1', 'Note retains both lead and contact linkage')
    }
  }
  sql(`UPDATE lead_intakes SET status='new',payload='{"status_automation":{"paused":true}}' WHERE id='${lead}';`)
  record(receipt(), 'booked')
  assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), 'new', 'Manual pause respected')
  sql(`UPDATE lead_intakes SET payload=jsonb_build_object('status_automation',jsonb_build_object('last_change',jsonb_build_object('changed_at',now()+interval '1 day'))) WHERE id='${lead}';`)
  record(receipt(), 'booked')
  assert.equal(sql(`SELECT status FROM lead_intakes WHERE id='${lead}';`), 'new', 'Older email cannot override newer status evidence')
  sql(`UPDATE lead_intakes SET payload='{}' WHERE id='${lead}';
    CREATE FUNCTION reject_synthetic_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'synthetic write failure'; END $$;
    CREATE TRIGGER reject_synthetic_status BEFORE UPDATE ON lead_intakes
      FOR EACH ROW EXECUTE FUNCTION reject_synthetic_status();`)
  const failed = receipt()
  const before = sql('SELECT count(*) FROM lead_events;')
  assert.throws(() => record(failed, 'booked'))
  assert.equal(sql(`SELECT status FROM gmail_outreach WHERE id='${failed}';`), 'review')
  assert.equal(sql('SELECT count(*) FROM lead_events;'), before, 'Failed status write rolls back note too')
  sql(`DELETE FROM gmail_connections WHERE id='${mailbox}';`)
  assert.equal(sql('SELECT count(*) FROM gmail_connections;'), '0')
  assert.equal(sql('SELECT count(*) FROM gmail_outreach WHERE connection_id IS NOT NULL;'), '0')
  assert.equal(sql('SELECT count(*) FROM gmail_outreach;'), String(sequence), 'Disconnect preserves receipts')
  console.log('PASS: migration, service-role access, tenant isolation, leases, atomic rollback, deduplication, status guards, and disconnect retention.')
} catch (error) {
  console.error(String(error.stderr || error.message))
  process.exitCode = 1
} finally {
  if (started) run(['rm', '-fv', name])
}