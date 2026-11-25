/* eslint-disable @typescript-eslint/no-require-imports -- Disposable synthetic migration rehearsal; no environment files or hosted access. */
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')

const name = `pulse-shared-follow-up-${process.pid}`
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = (text, database = 'postgres') => run(['exec', '-i', name, 'psql', '-X', '-At', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], text)
const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/202611240005_shared_follow_ups.sql'), 'utf8')
const fixture = readFileSync(resolve(__dirname, 'shared-follow-up-postgres.sql'), 'utf8')
let created = false

try {
  run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try { run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
  assert.ok(ready, 'Disposable PostgreSQL final listener did not become ready')
  run(['exec', '-i', name, 'sh', '-c', 'cat > /tmp/shared-follow-ups-migration.sql'], migration)
  // Match hosted postgres default ACLs before the fixture creates the tables.
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO anon, authenticated, service_role;`)
  sql(fixture.replace(/CREATE ROLE (anon|authenticated|service_role)[^;]*;/g, ''))
  console.log('PASS: shared follow-up persistence, compatibility, permissions and non-mutating backfill fixture')

  const tenant = '00000000-0000-0000-0000-000000000001'
  const person = '11111111-1111-4111-8111-111111111111'
  const lead = '22222222-2222-4222-8222-222222222222'
  const actor = '44444444-4444-4444-8444-444444444444'
  const rpc = (action, version, options = {}) => `SELECT row_to_json(saved) FROM public.save_shared_follow_up(
    '${options.tenant || tenant}', '${options.person || person}', '${lead}', '${actor}',
    '${action}', ${version}, '2026-12-05T20:00:00Z', 'Service role reminder') saved;`
  const service = text => sql(`SET ROLE service_role; ${text}`).split('\n').at(-1)
  const snapshot = () => sql(`SELECT jsonb_build_object(
    'inquiries', (SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM public.lead_intakes l),
    'follow_ups', (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM public.follow_ups f),
    'history', (SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.follow_up_history h));`)
  const rejectUnchanged = (text, expectedError) => {
    const before = snapshot()
    assert.throws(() => sql(text), error => expectedError.test(String(error.stderr)))
    assert.equal(snapshot(), before, 'Rejected operation changed inquiry, follow-up or history')
  }
  const version = Number(service(`SELECT version FROM public.follow_ups WHERE lead_intake_id='${lead}';`))
  const saved = JSON.parse(service(rpc('save', version)))
  assert.equal(saved.message, 'Service role reminder')
  assert.equal(saved.updated_by_membership_id, actor)
  assert.equal(service(`SELECT payload->>'follow_up_note' FROM public.lead_intakes WHERE id='${lead}';`), saved.message)
  rejectUnchanged(`SET ROLE service_role; ${rpc('save', version)}`, /Follow-up changed/)
  rejectUnchanged(`SET ROLE service_role; ${rpc('save', saved.version, { tenant: '00000000-0000-0000-0000-000000000099' })}`, /Inquiry not found/)
  rejectUnchanged(`SET ROLE service_role; ${rpc('save', saved.version, { person: '11111111-1111-4111-8111-111111111199' })}`, /Inquiry not found/)
  const completed = JSON.parse(service(rpc('complete', saved.version)))
  assert.equal(completed.status, 'completed')
  assert.equal(completed.message, saved.message)
  assert.equal(completed.due_at, saved.due_at)
  const cleared = JSON.parse(service(rpc('clear', JSON.parse(service(rpc('save', completed.version))).version)))
  assert.equal(cleared.status, 'cleared')
  assert.equal(cleared.due_at, null)
  assert.equal(cleared.message, saved.message)
  rejectUnchanged(`SET ROLE service_role; ${rpc('complete', cleared.version)}`, /No open follow-up/)
  console.log('PASS: actual service-role save/complete/clear; stale version, foreign tenant/person and repeated completion reject without side effects')

  for (const role of ['anon', 'authenticated']) {
    for (const table of ['follow_ups', 'follow_up_history']) {
      rejectUnchanged(`SET ROLE ${role}; SELECT * FROM public.${table};`, /permission denied/)
    }
    rejectUnchanged(`SET ROLE ${role}; ${rpc('save', cleared.version)}`, /permission denied/)
  }
  rejectUnchanged('SET ROLE service_role; DELETE FROM public.follow_ups;', /permission denied/)
  rejectUnchanged("SET ROLE service_role; UPDATE public.follow_up_history SET snapshot='{}';", /permission denied/)
  rejectUnchanged('SET ROLE service_role; DELETE FROM public.follow_up_history;', /permission denied/)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['follow_ups', 'follow_up_history']) {
      rejectUnchanged(`SET ROLE ${role}; TRUNCATE public.${table} CASCADE;`, /permission denied/)
      assert.equal(sql(`SELECT has_table_privilege('${role}', 'public.${table}', 'DELETE')
        OR has_table_privilege('${role}', 'public.${table}', 'TRUNCATE')
        OR has_table_privilege('${role}', 'public.${table}', 'REFERENCES')
        OR has_table_privilege('${role}', 'public.${table}', 'TRIGGER');`), 'f')
    }
  }
  console.log('PASS: actual browser-role reads/RPC denied; service role cannot delete follow-ups or update/delete history')

  for (const [database, payload, expectedError] of [
    ['invalid_date', { follow_up_at: 'not-a-date', follow_up_note: 'Keep malformed reminder' }, /invalid input syntax for type timestamp with time zone/],
    ['overlong_note', { follow_up_at: '2026-12-01T20:00:00Z', follow_up_note: 'x'.repeat(12001) }, /violates check constraint/],
  ]) {
    sql(`CREATE DATABASE ${database};`)
    sql(`CREATE TABLE public.lead_intakes (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL, person_id uuid, payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'contacted', updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION public.fixture_touch_inquiry() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
    CREATE TRIGGER fixture_touch_inquiry BEFORE UPDATE ON public.lead_intakes FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_inquiry();
    INSERT INTO public.lead_intakes(id,tenant_id,payload,updated_at) VALUES
    ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000001',
    '${JSON.stringify(payload)}'::jsonb,'2026-11-01T12:00:00Z');`, database)
    const before = sql('SELECT row_to_json(l) FROM public.lead_intakes l;', database)
    assert.throws(() => sql(migration, database), error => expectedError.test(String(error.stderr)), `${database} must reject the migration`)
    assert.equal(sql('SELECT row_to_json(l) FROM public.lead_intakes l;', database), before, 'Failed migration changed legacy inquiry data')
    assert.equal(sql(`SELECT to_regclass('public.follow_ups') IS NULL
      AND to_regclass('public.follow_up_history') IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname IN ('save_shared_follow_up','sync_inquiry_follow_up','audit_follow_up'))
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname='inquiry_follow_up_sync');`, database), 't', 'Failed migration left partial schema')
    console.log(`PASS: ${database} rejects atomically; original payload/timestamp retained; no partial tables/functions/trigger`)
  }
} finally {
  if (created) run(['rm', '--force', name])
}