/* eslint-disable @typescript-eslint/no-require-imports -- Disposable local DB; no env files or production access. */
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const assert = require('node:assert/strict')
const name = `pulse-parity-${process.pid}`
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = text => run(['exec', '-i', name, 'psql', '-X', '-At', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], text)
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const tenant = uuid(1), foreign = uuid(2), actor = uuid(3), account = uuid(4), manager = uuid(5), person = uuid(6), student = uuid(7)
const migration = file => readFileSync(resolve(__dirname, '../../supabase/migrations', file), 'utf8')
let created = false
try {
  run(['run', '--detach', '--rm', '--name', name, '--network', 'none', '--memory', '512m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']); created = true
  let ready = false
  for (let count = 0; count < 50; count++) {
    // The image starts a temporary socket-only server during initialization.
    // Wait for TCP so subsequent SQL cannot race its shutdown.
    try { run(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100) }
  }
  assert.ok(ready)
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE people(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants,first_name text,last_name text,email text,phone text,date_of_birth date,custom_fields jsonb);
    CREATE TABLE accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants,name text,email text,phone text);
    CREATE TABLE students(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants,person_id uuid REFERENCES people,account_id uuid REFERENCES accounts,client_status text,is_minor boolean,message_routing text);
    CREATE TABLE instructors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,person_id uuid REFERENCES people);
    CREATE TABLE student_accounts(student_id uuid REFERENCES students,account_id uuid REFERENCES accounts,relationship text,is_primary boolean,UNIQUE(student_id,account_id));
    CREATE TABLE band_profiles(tenant_id uuid,band_name text,status text,coach_person_id uuid,PRIMARY KEY(tenant_id,band_name));
    CREATE TABLE band_memberships(tenant_id uuid,band_name text,person_id uuid,membership text,UNIQUE(tenant_id,band_name,person_id));
    -- Production has no enrollments.band_name: labels live in custom_fields.
    CREATE TABLE enrollments(tenant_id uuid NOT NULL,session_name text,custom_fields jsonb DEFAULT '{}'::jsonb);
    INSERT INTO tenants VALUES('${tenant}'),('${foreign}');
    INSERT INTO accounts(id,tenant_id,name) VALUES('${account}','${tenant}','Original'),('${manager}','${tenant}','Additional'),('${uuid(50)}','${foreign}','Foreign');
    INSERT INTO people(id,tenant_id,first_name) VALUES('${person}','${tenant}','Student'),('${uuid(51)}','${foreign}','Foreign');
    INSERT INTO students(id,tenant_id,person_id,account_id) VALUES('${student}','${tenant}','${person}','${account}');`)
  sql(migration('202611210003_band_creation_drafts.sql'))
  sql(migration('202611210004_contact_family_management.sql'))
  sql(`CREATE TABLE account_holders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,account_id uuid,person_id uuid,relationship text,is_primary boolean);`)
  sql(migration('202611210005_account_manager_people.sql'))
  const state = { id: uuid(10), institution: 'music', kind: 'group', data: { id: uuid(10), formation: true, name: 'Durable Band', description: 'Saved description', leader: '', memberIds: [person] } }
  const band = (revision, complete, record = state) => `SELECT save_band_creation_draft('${tenant}','${actor}',${revision},'${JSON.stringify(record)}'::jsonb,${complete});`
  assert.equal(JSON.parse(sql(band(0, false))).revision, 1)
  assert.equal(JSON.parse(sql(band(0, false))).conflict, true)
  assert.equal(sql(`SELECT state->'data'->>'description' FROM band_creation_drafts;`), 'Saved description')
  assert.equal(JSON.parse(sql(band(1, true))).completed, true)
  assert.equal(JSON.parse(sql(band(1, true))).completed, true)
  assert.equal(sql('SELECT count(*) FROM band_profiles;'), '1')
  assert.equal(sql('SELECT membership FROM band_memberships;'), 'prospect')
  assert.throws(() => sql(band(0, true, { ...state, id: uuid(11), data: { ...state.data, id: uuid(11) } })))
  assert.throws(() => sql(band(0, false, { ...state, id: uuid(12), data: { ...state.data, id: uuid(12), memberIds: [uuid(51)] } })))
  // Exercise both real enrollment label locations, including case-insensitive
  // collisions and tenant isolation. Failed completion must not leave a draft.
  sql(`INSERT INTO enrollments(tenant_id,session_name,custom_fields) VALUES
    ('${tenant}','Legacy Session','{}'),
    ('${tenant}','Different Session','{"band_name":"Legacy Label"}'),
    ('${foreign}','Foreign Session','{"band_name":"Foreign Label"}');`)
  for (const [n, name] of [[13, 'legacy session'], [14, 'LEGACY LABEL']]) {
    const record = { ...state, id: uuid(n), data: { ...state.data, id: uuid(n), name } }
    assert.throws(() => sql(band(0, true, record)), /Band already exists/)
    assert.equal(sql(`SELECT count(*) FROM band_creation_drafts WHERE id='${uuid(n)}';`), '0')
    assert.equal(sql(`SELECT count(*) FROM band_profiles WHERE lower(band_name)=lower('${name}');`), '0')
  }
  const isolated = { ...state, id: uuid(15), data: { ...state.data, id: uuid(15), name: 'Foreign Label' } }
  assert.equal(JSON.parse(sql(band(0, true, isolated))).completed, true)
  const change = (op, payload) => `SELECT change_contact_family('${tenant}','${actor}','${uuid(op)}','${JSON.stringify(payload)}'::jsonb);`
  const link = { kind: 'link-account', account_id: account, person_id: person, manager_account_id: manager, relationship: 'Parent / guardian', expected_revision: 0, fields: {} }
  assert.equal(JSON.parse(sql(change(20, link))).saved, true)
  assert.equal(JSON.parse(sql(change(20, link))).saved, true)
  assert.equal(sql('SELECT communication_enabled FROM student_accounts;'), 'f')
  assert.equal(sql('SELECT family_revision FROM students;'), '1')
  assert.throws(() => sql(change(21, link)))
  assert.throws(() => sql(change(22, { ...link, expected_revision: 1, manager_account_id: uuid(50) })))
  assert.throws(() => sql(change(23, { ...link, kind: 'unlink-child', expected_revision: 1 })))
  sql(change(24, { ...link, kind: 'dependent-relationship', account_id: manager, relationship: 'Other', expected_revision: 1 }))
  sql(change(25, { ...link, kind: 'unlink-child', account_id: manager, expected_revision: 2 }))
  assert.equal(sql('SELECT count(*) FROM student_accounts;'), '0')
  assert.equal(sql(`SELECT account_id FROM students WHERE id='${student}';`), account)
  const child = { kind: 'child', account_id: account, relationship: 'Child', fields: { first_name: 'New', last_name: 'Dependent', date_of_birth: '2016-01-01' } }
  sql(change(26, child)); sql(change(26, child))
  assert.equal(sql('SELECT count(*) FROM students;'), '2')
  assert.equal(sql(`SELECT message_routing FROM students WHERE person_id<>'${person}';`), 'account_holder')
  assert.throws(() => sql(`SET ROLE authenticated; SELECT change_contact_family('${tenant}','${actor}','${uuid(27)}','{}');`))
  const managerChange = (op, change) => `SELECT change_account_manager('${tenant}','${actor}','${uuid(op)}','${JSON.stringify(change)}'::jsonb);`
  const managerLink = { kind: 'manager-link', account_id: manager, person_id: person, fields: {} }
  sql(managerChange(60, managerLink)); sql(managerChange(60, managerLink))
  assert.equal(sql('SELECT count(*) FROM account_holders;'), '1')
  assert.equal(sql('SELECT is_primary FROM account_holders;'), 'f')
  assert.equal(sql(`SELECT account_id FROM students WHERE id='${student}';`), account)
  assert.throws(() => sql(managerChange(61, { ...managerLink, person_id: uuid(51) })))
  assert.throws(() => sql(managerChange(62, { ...managerLink, account_id: uuid(50) })))
  const createManager = { kind: 'manager-create', account_id: manager, fields: { first_name: 'New', last_name: 'Manager' } }
  sql(managerChange(63, createManager)); sql(managerChange(63, createManager))
  assert.equal(sql('SELECT count(*) FROM accounts;'), '3')
  assert.equal(sql('SELECT count(*) FROM account_holders;'), '2')
  sql(managerChange(64, { ...managerLink, kind: 'manager-unlink' }))
  assert.equal(sql('SELECT count(*) FROM account_holders;'), '1')
  sql(`UPDATE account_holders SET is_primary=true;`)
  assert.throws(() => sql(managerChange(65, { kind: 'manager-unlink', account_id: manager, person_id: JSON.parse(sql(managerChange(63, createManager))).personId })))
  assert.throws(() => sql(`SET ROLE authenticated; SELECT change_account_manager('${tenant}','${actor}','${uuid(66)}','{}');`))
  console.log('PASS: production-shaped enrollment schema, session/JSON label collisions and tenant isolation, draft save/reload, conflict, atomic completion/retry, duplicate names, foreign members, family idempotency/stale updates, routing isolation, primary-link protection, dependent creation and role grants')
} finally {
  if (created) run(['rm', '-fv', name])
}