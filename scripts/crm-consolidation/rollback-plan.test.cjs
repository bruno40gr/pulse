const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rollbackPlan } = require('./rollback-plan.cjs');
const { tables } = require('./transfer.cjs');
const base = () => ({
  format: 'odeon-crm-snapshot-v1',
  tenants: [{ id: 'school', name: 'Synthetic', is_demo: false }],
  tables: Object.fromEntries(tables.map(t => [t, []])),
});
test('unchanged snapshot and row order produce an empty plan', () => {
  const b = base();
  b.tables.crm_contacts = [{ id: 'a', tenant_id: 'school' }, { id: 'b', tenant_id: 'school' }];
  const source = structuredClone(b); source.tables.crm_contacts.reverse();
  const p = rollbackPlan(b, source, b);
  assert.equal(p.executable, false);
  for (const t of tables) assert.deepEqual(p.changes[t], { insert: [], update: [], deleteIds: [] });
});
test('plans post-switch additions, updates and deletions without mutating inputs', () => {
  const b = base();
  b.tables.crm_contacts = [{ id: 'a', tenant_id: 'school', notes: 'before' }, { id: 'b', tenant_id: 'school', notes: null }];
  const d = structuredClone(b);
  d.tables.crm_contacts = [{ id: 'a', tenant_id: 'school', notes: 'after' }, { id: 'c', tenant_id: 'school', notes: null }];
  d.tables.lead_intakes = [{ id: 'lead', tenant_id: 'school', contact_id: 'c' }];
  d.tables.lead_events = [{ id: 'event', tenant_id: 'school', contact_id: 'c', lead_intake_id: 'lead' }];
  const original = structuredClone(d), p = rollbackPlan(b, b, d);
  assert.equal(p.changes.crm_contacts.update[0].notes, 'after');
  assert.deepEqual(p.changes.crm_contacts.deleteIds, ['b']);
  assert.equal(p.changes.lead_events.insert.length, 1);
  p.changes.crm_contacts.insert[0].notes = 'mutated plan';
  assert.deepEqual(d, original);
});
test('refuses source changes including independent additions', () => {
  const b = base(), s = base();
  s.tables.crm_contacts.push({ id: 'late', tenant_id: 'school' });
  assert.throws(() => rollbackPlan(b, s, b), /Source changed/);
});
test('refuses changed row columns and ownership', () => {
  const b = base();
  b.tenants.push({ id: 'other', name: 'Other', is_demo: true });
  b.tables.crm_contacts = [{ id: 'a', tenant_id: 'school', notes: null }];
  const d = structuredClone(b);
  delete d.tables.crm_contacts[0].notes;
  assert.throws(() => rollbackPlan(b, b, d), /columns/);
  d.tables.crm_contacts = [{ id: 'a', tenant_id: 'other', notes: null }];
  assert.throws(() => rollbackPlan(b, b, d), /tenant changed/);
});
test('refuses duplicate IDs, tenant changes and dangling/cross-tenant relations', () => {
  const b = base(), d = base();
  d.tables.crm_contacts = [{ id: 'a', tenant_id: 'school' }, { id: 'a', tenant_id: 'school' }];
  assert.throws(() => rollbackPlan(b, b, d), /duplicate/);
  d.tables.crm_contacts = [];
  d.tables.lead_intakes = [{ id: 'l', tenant_id: 'school', contact_id: 'missing' }];
  assert.throws(() => rollbackPlan(b, b, d), /related/);
  d.tables.lead_intakes = [];
  d.tenants[0].is_demo = true;
  assert.throws(() => rollbackPlan(b, b, d), /Tenant inventory/);
  const multi = base(); multi.tenants.push({ id: 'other', name: 'Other', is_demo: true });
  const cross = structuredClone(multi);
  cross.tables.crm_contacts = [{ id: 'c', tenant_id: 'other' }];
  cross.tables.lead_intakes = [{ id: 'l', tenant_id: 'school', contact_id: 'c' }];
  assert.throws(() => rollbackPlan(multi, multi, cross), /related/);
});