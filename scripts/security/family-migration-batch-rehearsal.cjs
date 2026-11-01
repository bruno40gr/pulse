/* eslint-disable @typescript-eslint/no-require-imports -- Disposable local PostgreSQL, synthetic data only. */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')
const { randomBytes } = require('node:crypto')
const socket = [join(homedir(), '.docker/run/docker.sock'), '/var/run/docker.sock'].find(existsSync)
assert.ok(socket, 'Local Docker Desktop is required; remote Docker is not accepted')
const name = `pulse-family-plan-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync('docker', ['--host', `unix://${socket}`, ...args], { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] })
const wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
// The postgres image runs a temporary server during initdb that can accept a
// query and then stop, so every statement tolerates the startup window.
const transient = /PGSQL\.5432|No such file or directory|starting up|the database system is (shutting down|starting up)/
const sql = input => {
  for (let attempt = 0; ; attempt++) {
    try { return run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input).trim() }
    catch (error) {
      if (attempt < 60 && transient.test(String(error.stderr || ''))) { wait(); continue }
      throw error
    }
  }
}
let created = false
try {
  const image = run(['image', 'inspect', 'postgres:17', '--format', '{{.Id}}']).trim()
  run(['create', '--pull=never', '--name', name, '--network', 'none', '--memory', '512m', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-e', `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`, image])
  created = true
  run(['start', name])
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try { sql('SELECT 1;'); ready = true; break }
    catch { wait() }
  }
  assert.ok(ready, 'Disposable database must become ready')
  sql(`CREATE TABLE plan_ledger(tenant text NOT NULL, key text NOT NULL, fingerprint text NOT NULL, PRIMARY KEY(tenant,key));
    CREATE TABLE staged_links(tenant text NOT NULL, student text NOT NULL, manager text NOT NULL, PRIMARY KEY(tenant,student,manager));
    CREATE TABLE audit(tenant text NOT NULL, key text NOT NULL, PRIMARY KEY(tenant,key));
    CREATE FUNCTION stage_link(t text,k text,f text,s text,m text) RETURNS void LANGUAGE plpgsql AS $$
    DECLARE prior text; BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended(t,0));
      SELECT fingerprint INTO prior FROM plan_ledger WHERE tenant=t AND key=k;
      IF prior IS NOT NULL THEN
        IF prior<>f THEN RAISE EXCEPTION 'plan conflict'; END IF;
        RETURN;
      END IF;
      INSERT INTO plan_ledger VALUES(t,k,f);
      INSERT INTO staged_links VALUES(t,s,m);
      INSERT INTO audit VALUES(t,k);
    END $$;`)
  const stage = "SELECT stage_link('synthetic-school','link:one','fingerprint-one','student','manager');"
  sql(stage); sql(stage)
  assert.equal(sql('SELECT count(*) FROM plan_ledger;'), '1')
  assert.equal(sql('SELECT count(*) FROM staged_links;'), '1')
  assert.equal(sql('SELECT count(*) FROM audit;'), '1')
  assert.throws(() => sql("SELECT stage_link('synthetic-school','link:one','changed','student','manager');"))
  assert.throws(() => sql("BEGIN; SELECT stage_link('synthetic-school','link:two','two','student2','manager'); SELECT stage_link('synthetic-school','link:one','conflict','student','manager'); COMMIT;"))
  assert.equal(sql('SELECT count(*) FROM staged_links;'), '1', 'Failed transaction rolls back every staged link and audit row')
  sql("SELECT stage_link('other-school','link:one','independent','student','manager');")
  assert.equal(sql('SELECT count(*) FROM staged_links;'), '2', 'Ledger keys are tenant scoped')
  console.log('PASS: isolated PostgreSQL staging-ledger rehearsal; replay, conflict rejection, atomic rollback, audit and tenant-scoped keys. No production writer or relationship-schema validation claimed.')
} finally {
  if (created) run(['rm', '-fv', name])
}