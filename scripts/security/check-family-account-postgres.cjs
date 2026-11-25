/* eslint-disable @typescript-eslint/no-require-imports -- Local disposable PostgreSQL only; no hosted configuration or credentials. */
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
const name = `pulse-family-account-${process.pid}`
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-At', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], text)
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const tenant = uuid(1), foreign = uuid(2), actor = uuid(3), family = uuid(4), member = uuid(5), third = uuid(6)
const migration = file => readFileSync(resolve(__dirname, '../../supabase/migrations', file), 'utf8')
let created = false
try {
  run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '--memory', '512m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']); created = true
  let ready = false
  for (let count = 0; count < 100; count++) {
    try { run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100) }
  }
  assert.ok(ready)
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);
    CREATE TABLE public.accounts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text);
    CREATE TABLE public.contact_family_operations(tenant_id uuid,operation_id uuid,actor_id uuid,change jsonb,result jsonb,created_at timestamptz,PRIMARY KEY(tenant_id,operation_id));
    GRANT SELECT,INSERT ON public.contact_family_operations TO service_role;
    GRANT SELECT ON public.accounts TO service_role;
    CREATE TABLE public.students(id uuid PRIMARY KEY,account_id uuid,message_routing text);
    CREATE TABLE public.enrollments(id uuid PRIMARY KEY,payer_account_id uuid);
    INSERT INTO public.tenants VALUES('${tenant}'),('${foreign}');
    INSERT INTO public.accounts VALUES('${family}','${tenant}','Family'),('${member}','${tenant}','Other payer'),('${third}','${tenant}','Third'),('${uuid(7)}','${foreign}','Foreign');
    INSERT INTO public.students VALUES('${uuid(8)}','${member}','account_holder');
    INSERT INTO public.enrollments VALUES('${uuid(9)}','${member}');`)
  const originalBilling = sql('SELECT row_to_json(s) FROM public.students s; SELECT row_to_json(e) FROM public.enrollments e;')
  sql(migration('202611250001_family_account_links.sql'))
  sql(migration('202611250002_account_follow_ups.sql'))
  const service = text => sql(`SET ROLE service_role; ${text}`).split('\n').at(-1)
  const link = (target, from, operation = 10) => `SELECT public.link_family_account('${tenant}','${actor}','${uuid(operation)}','${JSON.stringify({ account_id: target, member_account_id: from })}');`
  service(link(family, member)); service(link(family, member))
  assert.equal(sql('SELECT count(*) FROM public.family_account_links'), '1')
  assert.equal(sql('SELECT row_to_json(s) FROM public.students s; SELECT row_to_json(e) FROM public.enrollments e;'), originalBilling)
  for (const text of [link(member, family, 11), link(third, family, 12), link(third, member, 13), link(family, uuid(7), 14), link(family, family, 15), link(family, third, 10)]) {
    const before = sql('SELECT jsonb_agg(to_jsonb(l)) FROM public.family_account_links l; SELECT count(*) FROM public.contact_family_operations;')
    assert.throws(() => service(text))
    assert.equal(sql('SELECT jsonb_agg(to_jsonb(l)) FROM public.family_account_links l; SELECT count(*) FROM public.contact_family_operations;'), before)
  }
  console.log('PASS: explicit accounts, idempotency, changed retries, tenant isolation, cycle/family-move rejection; payer/routing snapshots unchanged')
  const rpc = (action, version, account = family, due = "'2026-12-01T20:00:00Z'", message = "'Family reminder'") =>
    `SELECT row_to_json(r) FROM public.save_account_follow_up('${tenant}','${account}','${actor}','${action}',${version},${due},${message}) r;`
  let row = JSON.parse(service(rpc('save', 0)))
  assert.equal(row.account_id, family)
  assert.equal(row.version, 1)
  const before = sql('SELECT jsonb_agg(to_jsonb(r)) FROM public.account_follow_ups r; SELECT count(*) FROM public.account_follow_up_history;')
  for (const text of [rpc('save', 0), rpc('save', 1, family, "'infinity'"), rpc('save', 1, family, 'NULL'), rpc('clear', 0, third)]) {
    assert.throws(() => service(text))
    assert.equal(sql('SELECT jsonb_agg(to_jsonb(r)) FROM public.account_follow_ups r; SELECT count(*) FROM public.account_follow_up_history;'), before)
  }
  row = JSON.parse(service(rpc('complete', row.version)))
  assert.equal(row.status, 'completed'); assert.equal(row.message, 'Family reminder')
  row = JSON.parse(service(rpc('save', row.version)))
  row = JSON.parse(service(rpc('clear', row.version)))
  assert.equal(row.status, 'cleared'); assert.equal(row.version, 4)
  assert.equal(sql('SELECT count(*) FROM public.account_follow_up_history'), '4')
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['account_follow_ups', 'account_follow_up_history', 'family_account_links']) assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM public.${table};`))
    assert.throws(() => sql(`SET ROLE ${role}; ${rpc('save', 4)}`))
    assert.throws(() => sql(`SET ROLE ${role}; ${link(family, third, 30)}`))
  }
  for (const table of ['account_follow_ups', 'account_follow_up_history']) {
    assert.throws(() => service(`TRUNCATE public.${table} CASCADE;`))
    assert.throws(() => service(`DELETE FROM public.${table};`))
  }
  assert.equal(sql('SELECT row_to_json(s) FROM public.students s; SELECT row_to_json(e) FROM public.enrollments e;'), originalBilling)
  assert.equal(sql('SELECT count(*) FROM public.account_follow_up_history'), '4')
  console.log('PASS: account-owned save/reload/complete/clear, stale drafts, finite dates, history, hosted-default ACL reset, browser denial and no payer/routing changes')
} finally {
  if (created) run(['rm', '-fv', name])
}