// Offline schema-only rehearsal. Never restores customer records or loads .env.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const { privateDirectory, writeArtifact } = require('./private-artifacts.cjs');

let phase = 'preflight';
let diagnosticDirectory;

function main() {
  const archive = process.argv[2];
  if (!archive || !path.isAbsolute(archive)) throw new Error('Absolute private archive path required');
  privateDirectory(path.dirname(archive));
  diagnosticDirectory = path.dirname(archive);
  const stat = fs.lstatSync(archive);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) {
    throw new Error('Owner-only archive required');
  }
  const docker = fs.existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')
    ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker';
  const name = `odeon-main-sms-${process.pid}-${Date.now()}`;
  const run = (args, input) => execFileSync(docker, args, { input, encoding: 'utf8',
    stdio: ['pipe','pipe','pipe'], timeout: 180000,
    env: { ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString('hex') } });
  const sql = text => run(['exec','-i',name,'psql','-X','-q','-t','-A','-U','postgres',
    '-v','ON_ERROR_STOP=1'],text).trim();
  const script = file => sql(fs.readFileSync(path.join(__dirname,file),'utf8'));
  let started = false;
  try {
    run(['run','-d','--name',name,'--network','none','-e','POSTGRES_PASSWORD',
      '--mount',`type=bind,source=${archive},target=/backup.dump,readonly`,'postgres:17']);
    started = true;
    let ready = false;
    for (let i=0;i<60;i++) {
      try { run(['exec',name,'pg_isready','-U','postgres']); ready=true; break; }
      catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000); }
    }
    assert.ok(ready,'Local database not ready');
    sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth;');
    // Restore actual public/auth definitions, but not data, ownership or ACLs.
    phase = 'schema restore';
    run(['exec',name,'pg_restore','--schema-only','--schema=auth','--schema=public',
      '--no-owner','--no-privileges','--single-transaction','--exit-on-error',
      '-U','postgres','-d','postgres','/backup.dump']);
    phase = 'synthetic setup';
    const tenant = '90000000-0000-0000-0000-000000000001';
    const person = '90000000-0000-0000-0000-000000000002';
    sql(`INSERT INTO public.tenants(id,name,is_demo) VALUES('${tenant}','Synthetic SMS rehearsal',true);
      INSERT INTO public.people(id,tenant_id,first_name,last_name,phone)
      VALUES('${person}','${tenant}','Synthetic','SMS','+12025550111');`);
    script('04-capture-queue.sql');
    script('07-persist-captured-sms.sql');
    // Original ACLs intentionally not restored; fixture backend grants are explicit.
    sql('GRANT SELECT,INSERT ON public.messages TO service_role; GRANT SELECT,UPDATE ON public.people TO service_role; GRANT SELECT ON public.campaigns TO service_role;');
    const capture = (letter, body) => sql(`SET ROLE service_role;
      SELECT public.odeon_crm_capture('${tenant}','inbound_sms','SM${letter.repeat(32)}',
      '${JSON.stringify({message_sid:`SM${letter.repeat(32)}`,from_phone:'+12025550111',to_phone:'+12025550122',body})}'::jsonb);`);
    phase = 'SMS checks';
    const stop = capture('a','STOP');
    const start = capture('b','START');
    sql(`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${stop}');`);
    assert.equal(sql(`SELECT opted_out FROM public.people WHERE id='${person}';`),'t');
    sql(`SET ROLE service_role; SELECT public.odeon_crm_persist_captured_sms('${start}');
      SELECT public.odeon_crm_persist_captured_sms('${stop}');`);
    assert.equal(sql(`SELECT opted_out FROM public.people WHERE id='${person}';`),'f');
    assert.equal(sql('SELECT count(*) FROM public.messages;'),'2');
    assert.equal(sql(`SELECT bool_and(m.contact_id='${person}' AND m.created_at=q.received_at)
      FROM public.messages m JOIN public.odeon_crm_cutover_queue q ON q.id=m.id;`),'t');
    console.log('PASS: actual main public/auth schema-only restore; synthetic SMS/STOP/START and retry checks. Original ACLs and hosted services not tested.');
  } finally {
    if (started) run(['rm','-f','-v',name]);
  }
}
try { main(); } catch (error) {
  // Driver diagnostics can contain private schema literals; do not print them.
  if (diagnosticDirectory) {
    writeArtifact(diagnosticDirectory,`sms-rehearsal-${Date.now()}.log`,
      String(error.stderr || error.message || 'Unknown failure'));
  }
  console.error(`FAIL: offline main-schema SMS rehearsal at ${phase}; private diagnostics suppressed.`);
  process.exitCode = 1;
}