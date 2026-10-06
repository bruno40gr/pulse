// Pure, fail-closed rollback planner. No files, credentials, network or SQL execution.
// A plan is NOT authorization to write. Both databases must be quiescent.
const { isDeepStrictEqual } = require('node:util');
const { importSql, tables } = require('./transfer.cjs');

function indexed(snapshot) {
  importSql(snapshot); // Reuse format/duplicate-ID checks; generated SQL is discarded.
  if (snapshot.tenants.some(t => !t || typeof t.id !== 'string') ||
      new Set(snapshot.tenants.map(t => t.id)).size !== snapshot.tenants.length) {
    throw new Error('Invalid tenant inventory');
  }
  return Object.fromEntries(tables.map(t => [t, new Map(snapshot.tables[t].map(r => [r.id, r]))]));
}

function sameMap(a, b) {
  return a.size === b.size && [...a].every(([id, row]) => isDeepStrictEqual(row, b.get(id)));
}

function rollbackPlan(baseline, source, destination) {
  const base = indexed(baseline), old = indexed(source), next = indexed(destination);
  const tenants = x => new Map(x.tenants.map(t => [t.id, t]));
  if (!sameMap(tenants(baseline), tenants(source)) ||
      !sameMap(tenants(baseline), tenants(destination))) {
    throw new Error('Tenant inventory changed; manual review required');
  }
  for (const t of tables) {
    if (!sameMap(base[t], old[t])) {
      // Even disjoint source changes indicate writers were not frozen.
      throw new Error('Source changed since cutover; manual reconciliation required');
    }
  }
  const tenantIds = new Set(destination.tenants.map(t => t.id));
  for (const t of tables) for (const row of next[t].values()) {
    if (!tenantIds.has(row.tenant_id)) throw new Error('Unknown record tenant');
    const oldRow = base[t].get(row.id);
    if (oldRow && Object.keys(oldRow).sort().join(',') !== Object.keys(row).sort().join(',')) {
      throw new Error('Record columns changed');
    }
    if (oldRow && oldRow.tenant_id !== row.tenant_id) throw new Error('Record tenant changed');
  }
  function related(row, table, key, required) {
    if (row[key] == null) {
      if (required) throw new Error('Required relationship missing');
      return;
    }
    const parent = next[table].get(row[key]);
    if (!parent || parent.tenant_id !== row.tenant_id) throw new Error('Invalid related record');
  }
  for (const r of next.lead_intakes.values()) related(r, 'crm_contacts', 'contact_id', true);
  for (const r of next.job_applications.values()) related(r, 'crm_contacts', 'contact_id', false);
  for (const r of next.lead_events.values()) {
    related(r, 'lead_intakes', 'lead_intake_id', true);
    related(r, 'crm_contacts', 'contact_id', false);
  }
  const changes = Object.fromEntries(tables.map(t => [t, {
    insert: [...next[t]].filter(([id]) => !base[t].has(id)).map(([, r]) => structuredClone(r)),
    update: [...next[t]].filter(([id, r]) => base[t].has(id) && !isDeepStrictEqual(r, base[t].get(id))).map(([, r]) => structuredClone(r)),
    deleteIds: [...base[t].keys()].filter(id => !next[t].has(id)),
  }]));
  return {
    format: 'odeon-crm-rollback-plan-v1',
    executable: false,
    changes,
    requirements: ['Freeze both sides', 'Recheck baseline under locks',
      'Handle user triggers transactionally without disabling foreign keys',
      'Apply child deletions before parent deletions; parents before child inserts',
      'Reconcile every record before commit; restore trigger state'],
  };
}

module.exports = { rollbackPlan };