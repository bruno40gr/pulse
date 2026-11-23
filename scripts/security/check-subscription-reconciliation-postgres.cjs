/* eslint-disable @typescript-eslint/no-require-imports -- Disposable isolated Postgres only. */
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
const name = `pulse-subscription-repair-${process.pid}`
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-At', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], text)
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
let created = false
try {
  run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']); created = true
  for (let n = 0; n < 50; n++) {
    try { run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100) }
  }
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);
    CREATE TABLE public.people(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text,custom_fields jsonb);
    CREATE TABLE public.students(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,person_id uuid,client_status text);
    CREATE TABLE public.instructors(id uuid PRIMARY KEY,tenant_id uuid,person_id uuid);
    CREATE TABLE public.enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,student_id uuid,instructor_person_id uuid,instrument text,service_type text,plan_name text,status text,custom_fields jsonb);
    INSERT INTO public.tenants VALUES('${id(1)}');
    INSERT INTO public.people VALUES('${id(2)}','${id(1)}','Student','One','{"external_id":"${id(20)}"}'),('${id(3)}','${id(1)}','Current','Teacher','{}'),('${id(4)}','${id(1)}','Past','Teacher','{"staff_status":"sunset"}');
    INSERT INTO public.students VALUES('${id(5)}','${id(1)}','${id(2)}','active');
    INSERT INTO public.instructors VALUES('${id(6)}','${id(1)}','${id(3)}');
    INSERT INTO public.enrollments VALUES('${id(7)}','${id(1)}','${id(5)}','${id(4)}','Piano','private','Legacy','active','{"attendance":[{"session_date":"2026-08-01"}],"instructor":"Past Teacher"}');`)
  sql(readFileSync(resolve(__dirname, '../../supabase/migrations/202611230001_subscription_reconciliation.sql'), 'utf8'))
  sql(`INSERT INTO public.subscription_reconciliation_runs(id,tenant_id,source_sha256,source_date,expected_rows,expected_fingerprint)
    SELECT 'test','${id(1)}','hash','2026-11-19',2,md5(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text) FROM public.enrollments e;
    INSERT INTO public.subscription_reconciliation_rows VALUES
      ('test','${id(8)}','${id(20)}','${id(21)}','${id(3)}','Piano - Level 2 (30 min)','Private Piano','Piano','private',2,30,'active'),
      ('test','${id(9)}','${id(20)}','${id(21)}','${id(3)}','Voice - Level 3 (30 min)','Private Voice','Voice','private',3,30,'pending');`)
  const result = JSON.parse(sql("SELECT public.apply_subscription_reconciliation('test');"))
  assert.equal(result.subscriptions, 2)
  assert.equal(result.historical_enrollments_preserved, 1)
  assert.equal(JSON.parse(sql("SELECT public.apply_subscription_reconciliation('test');")).subscriptions, 2, 'Replay is idempotent')
  assert.equal(sql(`SELECT instructor_person_id='${id(4)}' AND custom_fields->>'instructor'='Past Teacher' AND jsonb_array_length(custom_fields->'attendance')=1 AND custom_fields->>'status'='ended' FROM public.enrollments WHERE id='${id(7)}';`), 't')
  assert.equal(sql("SELECT count(*) FROM public.enrollments WHERE custom_fields->>'subscription_id' IS NOT NULL;"), '2')
  assert.equal(sql("SELECT jsonb_array_length(backup->'enrollments') FROM public.subscription_reconciliation_runs WHERE id='test';"), '1')
  sql(`INSERT INTO public.subscription_reconciliation_runs VALUES('changed','${id(1)}','hash','2026-11-19',1,'stale',null,null,null);`)
  assert.throws(() => sql("SELECT public.apply_subscription_reconciliation('changed');"), /Command failed/)
  const rollback = readFileSync(resolve(__dirname, 'rollback-subscription-reconciliation.sql'), 'utf8')
  sql("SET pulse.reconciliation_run='test';\n" + rollback)
  assert.equal(sql('SELECT count(*) FROM public.enrollments;'), '1')
  assert.equal(sql(`SELECT status FROM public.enrollments WHERE id='${id(7)}';`), 'active')
  sql(`DELETE FROM public.subscription_reconciliation_rows; DELETE FROM public.subscription_reconciliation_runs;
    DELETE FROM public.students;
    INSERT INTO public.subscription_reconciliation_runs(id,tenant_id,source_sha256,source_date,expected_rows,expected_fingerprint)
      SELECT 'missing-role','${id(1)}','hash','2026-11-19',1,md5(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text) FROM public.enrollments e;
    INSERT INTO public.subscription_reconciliation_rows VALUES
      ('missing-role','${id(8)}','${id(20)}','${id(21)}','${id(3)}','Piano - Level 2 (30 min)','Private Piano','Piano','private',2,30,'active');`)
  const expectRejected = (mutation, restore) => {
    sql(mutation)
    assert.throws(() => sql("SELECT public.apply_subscription_reconciliation('missing-role');"), /Command failed/)
    assert.equal(sql("SELECT applied_at IS NULL AND backup IS NULL FROM public.subscription_reconciliation_runs WHERE id='missing-role';"), 't')
    assert.equal(sql('SELECT count(*) FROM public.students;'), '0')
    sql(restore)
  }
  expectRejected(`UPDATE public.people SET tenant_id='${id(99)}' WHERE id='${id(2)}';`, `UPDATE public.people SET tenant_id='${id(1)}' WHERE id='${id(2)}';`)
  expectRejected(`UPDATE public.people SET custom_fields='{"staff_status":"inactive"}' WHERE id='${id(3)}';`, `UPDATE public.people SET custom_fields='{}' WHERE id='${id(3)}';`)
  expectRejected(`UPDATE public.instructors SET tenant_id='${id(99)}';`, `UPDATE public.instructors SET tenant_id='${id(1)}';`)
  expectRejected(`ALTER TABLE public.enrollments ADD CONSTRAINT reject_insert CHECK (plan_name='Legacy');`, 'ALTER TABLE public.enrollments DROP CONSTRAINT reject_insert;')
  const missingRole = JSON.parse(sql("SELECT public.apply_subscription_reconciliation('missing-role');"))
  assert.equal(missingRole.student_roles_created, 1)
  assert.equal(sql(`SELECT count(*) FROM public.people WHERE id='${id(2)}';`), '1', 'Preserves existing person')
  sql("UPDATE public.enrollments SET plan_name='Later change' WHERE custom_fields->>'subscription_id' IS NOT NULL;")
  assert.throws(() => sql("SET pulse.reconciliation_run='missing-role';\n" + rollback), /Command failed/)
  sql("UPDATE public.enrollments SET plan_name='Private Piano' WHERE custom_fields->>'subscription_id' IS NOT NULL;")
  sql("SET pulse.reconciliation_run='missing-role';\n" + rollback)
  assert.equal(sql('SELECT count(*) FROM public.students;'), '0', 'Rollback removes only newly created role')
  assert.equal(sql('SELECT count(*) FROM public.enrollments;'), '1')
  console.log('PASS: atomic repair, history, separate subscriptions, backup, replay, stale-state, missing role, tenant/inactive rejection, failure atomicity and guarded rollback')
} finally { if (created) run(['rm', '--force', name]) }