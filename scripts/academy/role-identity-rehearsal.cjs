/* eslint-disable @typescript-eslint/no-require-imports -- Local disposable PostgreSQL relationship experiment. */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')

const socket = [path.join(homedir(), '.docker/run/docker.sock'), '/var/run/docker.sock'].find(existsSync)
assert.ok(socket, 'Local Docker Desktop socket required; remote contexts are not used')
const name = `odeon-academy-roles-${process.pid}-${Date.now()}`
const run = (args, input) => execFileSync('docker', ['--host', `unix://${socket}`, ...args], {
  input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'],
})
const sql = input => run(['exec', '-i', name, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], input).trim()
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
  sql(readFileSync(path.join(__dirname, 'role-identity-fixture.sql'), 'utf8'))
  let checks = 0
  const check = (label, action) => { action(); checks++; console.log(`PASS: ${label}`) }
  const rejects = (query, code) => assert.throws(() => sql(query), error => String(error.stderr).includes(code))
  const snapshot = () => sql(`SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM fictional_roles.enrollments e;`)
  const original = snapshot()
  check('Alex has one person identity and independent staff/student roles', () => {
    assert.equal(sql(`SELECT count(*) FROM fictional_roles.people p
      JOIN fictional_roles.staff t ON (t.tenant_id,t.person_id)=(p.tenant_id,p.id)
      JOIN fictional_roles.students s ON (s.tenant_id,s.person_id)=(p.tenant_id,p.id)
      WHERE p.tenant_id='school-a' AND p.id='alex';`), '1')
  })
  check('Alex learns from Jordan and teaches Jordan on a separate enrollment', () => {
    assert.equal(sql(`SELECT instructor_person_id || ':' || instructor_id FROM fictional_roles.enrollments WHERE id='alex-learns-voice';`), 'jordan:staff-jordan')
    assert.equal(sql(`SELECT instructor_person_id || ':' || instructor_id FROM fictional_roles.enrollments WHERE id='jordan-learns-piano';`), 'alex:staff-alex')
  })
  check('Mismatched person/staff teacher pair is rejected', () => {
    rejects("UPDATE fictional_roles.enrollments SET instructor_id='staff-alex' WHERE id='alex-learns-voice';", '23503')
  })
  check('Person IDs cannot be substituted for staff IDs', () => {
    rejects("UPDATE fictional_roles.enrollments SET instructor_id='jordan' WHERE id='alex-learns-voice';", '23503')
  })
  check('Cross-tenant teacher and learner references are rejected', () => {
    rejects("UPDATE fictional_roles.enrollments SET instructor_person_id='remote',instructor_id='staff-remote' WHERE id='alex-learns-voice';", '23503')
    rejects("INSERT INTO fictional_roles.enrollments VALUES ('school-b','bad-learner','student-alex',NULL,NULL);", '23503')
  })
  check('Partial compatibility pairs are rejected; fully unassigned remains valid', () => {
    rejects("UPDATE fictional_roles.enrollments SET instructor_id=NULL WHERE id='alex-learns-voice';", '23514')
    rejects("UPDATE fictional_roles.enrollments SET instructor_person_id=NULL WHERE id='alex-learns-voice';", '23514')
    assert.equal(sql('SELECT count(*) FROM fictional_roles.enrollments WHERE instructor_person_id IS NULL AND instructor_id IS NULL;'), '1')
  })
  check('Referenced teacher identity remapping is rejected', () => {
    sql("INSERT INTO fictional_roles.people VALUES ('school-a','replacement');")
    rejects("UPDATE fictional_roles.staff SET person_id='replacement' WHERE id='staff-jordan';", '23503')
    rejects("UPDATE fictional_roles.staff SET person_id='alex' WHERE id='staff-jordan';", '23505')
    rejects("DELETE FROM fictional_roles.staff WHERE id='staff-jordan';", '23503')
  })
  check('A child constraint failure rolls back an earlier enrollment write', () => {
    rejects(`BEGIN;
      UPDATE fictional_roles.enrollments SET instructor_person_id='alex',instructor_id='staff-alex' WHERE id='alex-learns-voice';
      INSERT INTO fictional_roles.enrollments VALUES ('school-a','bad-child','student-alex','jordan','staff-alex'); COMMIT;`, '23503')
    assert.equal(snapshot(), original)
  })
  console.log(`${checks} relationship checks passed. Fictional constraints only; no application migration, RLS or permission behavior is established.`)
} finally {
  if (created) {
    run(['rm', '-fv', name])
    assert.equal(run(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}']).trim(), '')
    console.log('PASS: container removed and fictional database discarded.')
  }
}