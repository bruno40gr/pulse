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
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.tenants(id uuid PRIMARY KEY);
      CREATE TABLE public.tenant_memberships(id uuid PRIMARY KEY,tenant_id uuid,status text);
      INSERT INTO public.tenants VALUES('${id(1)}'),('${id(2)}');
      INSERT INTO public.tenant_memberships VALUES('${id(3)}','${id(1)}','active'),('${id(4)}','${id(2)}','active');`)
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
    console.log('PASS: concurrent first saves allow exactly one winner, stale revisions reject, tenant actor isolation, browser-role denial and persistence/reload')
  } finally { if (created) run(['rm', '--force', name]) }
})().catch(error => { console.error(error); process.exitCode = 1 })