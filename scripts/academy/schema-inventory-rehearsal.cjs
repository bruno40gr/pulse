/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local-only PostgreSQL metadata rehearsal. */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const socket = [path.join(homedir(), '.docker/run/docker.sock'), '/var/run/docker.sock'].find(existsSync)
assert.ok(socket, 'Start local Docker Desktop first; remote Docker contexts are not used')
const name = `odeon-academy-inventory-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync('docker', ['--host', `unix://${socket}`, ...args], {
  input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'],
})
const sql = input => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input).trim()
let created = false
try {
  const image = run(['image', 'inspect', 'postgres:17', '--format', '{{.Id}}']).trim()
  run(['create', '--pull=never', '--name', name, '--network', 'none', '--memory', '512m', '--cpus', '1',
    '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-e', `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`, image])
  created = true
  const config = JSON.parse(run(['inspect', name]))[0]
  assert.equal(config.HostConfig.NetworkMode, 'none')
  assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0)
  assert.ok(config.Mounts.every(mount => mount.Type === 'tmpfs'))
  run(['start', name])
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500) }
  }
  assert.ok(ready, 'Disposable PostgreSQL must become ready')
  sql(`CREATE TABLE public.students(id text PRIMARY KEY, private_note text DEFAULT 'PRIVATE_DEFAULT_SENTINEL');
    CREATE TABLE public.enrollments(id text PRIMARY KEY, student_id text REFERENCES public.students(id));
    INSERT INTO public.students VALUES ('fictional-student', 'PRIVATE_ROW_SENTINEL');
    INSERT INTO public.enrollments VALUES ('fictional-lesson', 'fictional-student');
    ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fictional_policy ON public.students USING (private_note <> 'PRIVATE_POLICY_SENTINEL');
    CREATE FUNCTION public.fictional_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.private_note := 'PRIVATE_FUNCTION_SENTINEL'; RETURN NEW; END $$;
    CREATE TRIGGER fictional_trigger BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.fictional_trigger();
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, statements text[]);
    INSERT INTO supabase_migrations.schema_migrations VALUES ('fictional-version', ARRAY['PRIVATE_MIGRATION_SENTINEL']);
    CREATE ROLE fictional_reader NOLOGIN;
    GRANT USAGE ON SCHEMA public TO fictional_reader;
    GRANT SELECT ON public.students TO fictional_reader;`)
  const inventory = readFileSync(path.join(__dirname, 'schema-inventory.sql'), 'utf8')
  const before = sql('SELECT row_to_json(s) FROM public.students s;')
  const output = sql(inventory)
  const report = JSON.parse(output)
  assert.equal(report.read_only, 'on')
  assert.equal(output.includes('PRIVATE_'), false, 'No row/default/policy/function/migration literals may leak')
  assert.equal(sql('SELECT row_to_json(s) FROM public.students s;'), before)
  assert.equal(sql(inventory), output, 'Repeat inventory is deterministic for unchanged schema')
  const entries = report.entries
  for (const kind of ['relation', 'column', 'constraint', 'index', 'policy', 'trigger', 'function', 'table_grant']) {
    assert.ok(entries.some(row => row.kind === kind), `Missing ${kind}`)
  }
  const fk = entries.find(row => row.kind === 'constraint' && row.object_name === 'enrollments' && row.details.type === 'f')
  assert.deepEqual(fk.details.columns, ['student_id'])
  assert.equal(fk.details.referenced_relation, 'students')
  assert.deepEqual(fk.details.referenced_columns, ['id'])
  const limited = JSON.parse(sql(`SET ROLE fictional_reader;\n${inventory}`))
  assert.equal(limited.read_only, 'on')
  assert.ok(limited.entries.some(row => row.kind === 'table_grant' && row.details.grantee === 'fictional_reader'))
  assert.throws(() => sql('BEGIN READ ONLY; INSERT INTO public.students(id) VALUES (\'forbidden\'); COMMIT;'))
  assert.equal(sql('SELECT count(*) FROM public.students;'), '1')
  console.log('PASS: metadata categories, FK columns, read-only execution, unchanged fixtures, deterministic output, restricted-role execution and private-literal exclusion.')
} finally {
  if (created) {
    run(['rm', '-fv', name])
    assert.equal(run(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}']).trim(), '')
    console.log('PASS: local container removed; ephemeral database discarded.')
  }
}