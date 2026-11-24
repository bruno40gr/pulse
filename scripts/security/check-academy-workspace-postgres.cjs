/* eslint-disable @typescript-eslint/no-require-imports -- Disposable PostgreSQL concurrency proof. */
const { execFileSync, spawn } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
const name = `pulse-academy-workspace-${process.pid}`
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const args = ['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-X', '-At', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
const sql = text => run(args, text)
function concurrent(text) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args)
    let out = '', error = ''
    child.stdout.on('data', data => { out += data })
    child.stderr.on('data', data => { error += data })
    child.on('error', reject)
    child.on('close', code => code ? reject(new Error(error)) : resolve(out.trim()))
    child.stdin.end(text)
  })
}
;(async () => {
  let created = false
  try {
    run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']); created = true
    for (let n = 0; n < 50; n++) {
      try { run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100) }
    }
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public.tenants(id uuid PRIMARY KEY);
      CREATE TABLE public.tenant_memberships(id uuid PRIMARY KEY,tenant_id uuid,status text,legacy_access_enabled boolean DEFAULT false);
      INSERT INTO public.tenants VALUES('${id(1)}'),('${id(2)}');
      INSERT INTO public.tenant_memberships(id,tenant_id,status) VALUES('${id(3)}','${id(1)}','active'),('${id(4)}','${id(2)}','active');`)
    sql(readFileSync(resolve(__dirname, '../../supabase/migrations/202611140001_academy_workspace.sql'), 'utf8'))
    sql(readFileSync(resolve(__dirname, '../../supabase/migrations/202611230002_academy_workspace_actor_validation.sql'), 'utf8'))
    assert.throws(() => sql(`SELECT public.save_academy_workspace('${id(1)}','${id(3)}',-1,'{}');`), /Command failed/)
    assert.equal(sql('SELECT count(*) FROM public.academy_workspaces;'), '0')
    const save = state => `SELECT public.save_academy_workspace('${id(1)}','${id(3)}',0,'${JSON.stringify(state)}'::jsonb);`
    const results = await Promise.all([concurrent(save({ writer: 1 })), concurrent(save({ writer: 2 }))])
    const parsed = results.map(JSON.parse)
    assert.equal(parsed.filter(result => result.revision === 1 && !result.conflict).length, 1)
    assert.equal(parsed.filter(result => result.conflict).length, 1)
    assert.equal(sql('SELECT revision FROM public.academy_workspaces;'), '1')
    assert.throws(() => sql(`SELECT public.save_academy_workspace('${id(1)}','${id(4)}',1,'{}');`), /Command failed/)
    assert.throws(() => sql(`SET ROLE authenticated; SELECT public.save_academy_workspace('${id(1)}','${id(3)}',1,'{}');`), /Command failed/)
    assert.throws(() => sql('SET ROLE authenticated; SELECT * FROM public.academy_workspaces;'), /Command failed/)
    assert.equal(sql(`SELECT count(*) FROM public.academy_workspaces WHERE tenant_id='${id(2)}';`), '0')
    assert.equal(JSON.parse(sql(`SELECT public.save_academy_workspace('${id(1)}','${id(3)}',1,'{"reloaded":true}');`)).revision, 2)
    assert.equal(sql("SELECT state->>'reloaded' FROM public.academy_workspaces;"), 'true')
    // Upgrade from the previously installed functions; no old overload remains.
    sql(readFileSync(resolve(__dirname, '../../supabase/migrations/202611230003_academy_workspace_auth_source.sql'), 'utf8'))
    assert.equal(sql("SELECT to_regprocedure('public.save_academy_workspace(uuid,uuid,bigint,jsonb)') IS NULL;"), 't')
    sql(`INSERT INTO public.tenant_memberships VALUES
      ('${id(5)}','${id(1)}','unclaimed',true),('${id(6)}','${id(1)}','invited',true),
      ('${id(7)}','${id(1)}','active',true),('${id(8)}','${id(1)}','unclaimed',false),
      ('${id(9)}','${id(1)}','suspended',true),('${id(10)}','${id(1)}','deactivated',true);`)
    sql('GRANT SELECT, UPDATE ON public.tenant_memberships TO service_role;')
    let revision = 2
    const call = (actor, source, expected = revision, state = '{}') => `SELECT public.save_academy_workspace('${id(1)}','${id(actor)}',${expected},'${state}'::jsonb,${source === null ? 'NULL' : `'${source}'`});`
    for (const [actor, source] of [[3,'supabase'],[5,'legacy'],[6,'legacy'],[7,'legacy']]) {
      assert.equal(JSON.parse(sql(`SET ROLE service_role; ${call(actor, source)}`).split('\n').at(-1)).revision, ++revision)
    }
    for (const [actor, source] of [[3,'legacy'],[4,'supabase'],[5,'supabase'],[6,'supabase'],[8,'legacy'],[9,'legacy'],[10,'legacy'],[9,'supabase'],[10,'supabase'],[3,'unknown'],[3,null]]) {
      assert.throws(() => sql(call(actor, source)), /Command failed/)
      assert.equal(Number(sql('SELECT revision FROM public.academy_workspaces;')), revision)
    }
    assert.throws(() => sql(call(3, 'supabase', -1)), /Command failed/)
    for (const role of ['anon','authenticated']) assert.throws(() => sql(`SET ROLE ${role}; ${call(3,'supabase')}`), /Command failed/)
    assert.equal(JSON.parse(sql(call(3,'supabase',revision-1))).conflict,true)
    const contenders = await Promise.all([concurrent(call(3,'supabase')),concurrent(call(5,'legacy'))])
    assert.equal(contenders.map(JSON.parse).filter(result => !result.conflict).length,1)
    assert.equal(Number(sql('SELECT revision FROM public.academy_workspaces;')),++revision)
    sql(`UPDATE public.tenant_memberships SET legacy_access_enabled=false WHERE id='${id(5)}';`)
    assert.throws(() => sql(call(5,'legacy')),/Command failed/)
    assert.equal(Number(sql('SELECT revision FROM public.academy_workspaces;')),revision)
    // Application rollback needs its matching RPC. Rehearse without dropping data:
    // restore the active-only four-argument function, then re-upgrade in place.
    const beforeRollback = sql('SELECT row_to_json(w) FROM public.academy_workspaces w;')
    const priorFunction = readFileSync(resolve(__dirname, '../../supabase/migrations/202611230002_academy_workspace_actor_validation.sql'), 'utf8')
    sql(`BEGIN; DROP FUNCTION public.save_academy_workspace(uuid,uuid,bigint,jsonb,text);\n${priorFunction.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '')}\nCOMMIT;`)
    assert.equal(sql('SELECT row_to_json(w) FROM public.academy_workspaces w;'),beforeRollback)
    assert.equal(sql("SELECT to_regprocedure('public.save_academy_workspace(uuid,uuid,bigint,jsonb,text)') IS NULL;"),'t')
    assert.equal(sql("SELECT has_function_privilege('authenticated','public.save_academy_workspace(uuid,uuid,bigint,jsonb)','EXECUTE');"),'f')
    assert.equal(JSON.parse(sql(`SET ROLE service_role; SELECT public.save_academy_workspace('${id(1)}','${id(3)}',${revision},'{"rollbackWriter":true}');`).split('\n').at(-1)).revision,++revision)
    const afterRollbackWrite = sql('SELECT row_to_json(w) FROM public.academy_workspaces w;')
    sql(readFileSync(resolve(__dirname, '../../supabase/migrations/202611230003_academy_workspace_auth_source.sql'), 'utf8'))
    assert.equal(sql('SELECT row_to_json(w) FROM public.academy_workspaces w;'),afterRollbackWrite)
    assert.equal(JSON.parse(sql(call(3,'supabase',revision-1))).conflict,true)
    assert.equal(sql("SELECT state->>'rollbackWriter' FROM public.academy_workspaces;"),'true')
    console.log('PASS: matching-RPC rollback and re-upgrade preserve rows, revisions, ACL and intervening writes')
    console.log('PASS: historical upgrade, auth-source policy, retired-legacy/suspended/deactivated/foreign denial, service-only ACL, concurrent CAS and persisted revisions')
  } finally { if (created) run(['rm', '--force', name]) }
})().catch(error => { console.error(error); process.exitCode = 1 })