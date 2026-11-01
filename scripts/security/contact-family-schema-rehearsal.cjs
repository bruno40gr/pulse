/* eslint-disable @typescript-eslint/no-require-imports -- Disposable local PostgreSQL only; no environment files. */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const socket = [path.join(homedir(), '.docker/run/docker.sock'), '/var/run/docker.sock'].find(existsSync)
assert.ok(socket, 'Start local Docker Desktop; this rehearsal never uses remote Docker or production')
const name = `pulse-family-schema-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync('docker', ['--host', `unix://${socket}`, ...args], { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] })
const sql = input => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input).trim()
let created = false
try {
  const image = run(['image', 'inspect', 'postgres:17', '--format', '{{.Id}}']).trim()
  run(['create', '--pull=never', '--name', name, '--network', 'none', '--memory', '512m', '--cpus', '1', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-e', `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`, image])
  created = true
  run(['start', name])
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500) }
  }
  assert.ok(ready, 'Disposable database must become ready')
  sql(`CREATE TABLE public.people(id text PRIMARY KEY, private_note text DEFAULT 'PRIVATE_DEFAULT_SENTINEL');
    CREATE TABLE public.accounts(id text PRIMARY KEY);
    CREATE TABLE public.students(id text PRIMARY KEY, person_id text REFERENCES public.people(id), account_id text REFERENCES public.accounts(id));
    INSERT INTO public.people VALUES ('fixture', 'PRIVATE_ROW_SENTINEL');
    ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fictional_policy ON public.people USING (private_note <> 'PRIVATE_POLICY_SENTINEL');`)
  const query = readFileSync(path.join(__dirname, 'contact-family-schema-audit.sql'), 'utf8')
  const before = sql('SELECT row_to_json(p) FROM public.people p;')
  const output = sql(query), report = JSON.parse(output)
  assert.equal(report.read_only, 'on')
  assert.equal(output.includes('PRIVATE_'), false)
  assert.equal(report.relations.length, 7)
  assert.equal(report.relations.find(item => item.name === 'account_holders').present, false)
  const students = report.relations.find(item => item.name === 'students')
  assert.ok(students.constraints.some(item => item.referenced_relation === 'people' && item.columns[0] === 'person_id'))
  assert.ok(students.constraints.some(item => item.referenced_relation === 'accounts' && item.columns[0] === 'account_id'))
  assert.equal(sql('SELECT row_to_json(p) FROM public.people p;'), before)
  assert.equal(sql(query), output)
  assert.throws(() => sql("BEGIN READ ONLY; INSERT INTO public.people(id) VALUES ('forbidden'); COMMIT;"))
  console.log('PASS: read-only family metadata query, explicit missing relations, FK mapping, no private literals and unchanged records')
} finally {
  if (created) run(['rm', '-fv', name])
}