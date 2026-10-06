// SQL builder only. Does not load credentials, open connections, or write files.
// The only executable caller supplied here owns a disposable local database.
const { randomBytes } = require('node:crypto');
const tables = ['crm_contacts', 'lead_intakes', 'job_applications', 'lead_events'];

function importSql(snapshot) {
  if (!snapshot || snapshot.format !== 'odeon-crm-snapshot-v1' ||
      !Array.isArray(snapshot.tenants) || !snapshot.tables ||
      Object.keys(snapshot.tables).sort().join(',') !== [...tables].sort().join(',')) {
    throw new Error('Invalid snapshot format/table inventory');
  }
  for (const table of tables) {
    if (!Array.isArray(snapshot.tables[table])) throw new Error('Invalid table records');
    const ids = new Set();
    for (const row of snapshot.tables[table]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          typeof row.id !== 'string' || ids.has(row.id)) throw new Error('Invalid or duplicate record ID');
      ids.add(row.id);
    }
  }
  const json = JSON.stringify(snapshot);
  let tag;
  do { tag = `$snapshot_${randomBytes(16).toString('hex')}$`; } while (json.includes(tag));
  return `BEGIN;
SET LOCAL TIME ZONE 'UTC';
LOCK TABLE ${tables.map(t => `public.${t}`).join(', ')} IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE crm_transfer_snapshot (body jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO crm_transfer_snapshot VALUES (${tag}${json}${tag}::jsonb);
DO $verify$ DECLARE target text; row_value jsonb; occupied boolean; expected_keys text[]; actual_keys text[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM crm_transfer_snapshot s,
      jsonb_to_recordset(s.body->'tenants') AS source(id uuid, name text, is_demo boolean)
    LEFT JOIN public.tenants dest ON dest.id=source.id
    WHERE dest.id IS NULL OR dest.name IS DISTINCT FROM source.name
      OR dest.is_demo IS DISTINCT FROM source.is_demo
  ) THEN RAISE EXCEPTION 'Tenant inventory mismatch'; END IF;
  FOREACH target IN ARRAY ARRAY[${tables.map(t => `'${t}'`).join(',')}] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||target)::regclass AND NOT tgisinternal) THEN
      RAISE EXCEPTION 'Import requires destination without user triggers'; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', target) INTO occupied;
    IF occupied THEN RAISE EXCEPTION 'Destination must be empty'; END IF;
    SELECT array_agg(attname::text ORDER BY attname) INTO expected_keys FROM pg_attribute
      WHERE attrelid=('public.'||target)::regclass AND attnum>0 AND NOT attisdropped;
    FOR row_value IN SELECT jsonb_array_elements(body->'tables'->target) FROM crm_transfer_snapshot LOOP
      SELECT array_agg(key ORDER BY key) INTO actual_keys FROM jsonb_object_keys(row_value) key;
      IF actual_keys IS DISTINCT FROM expected_keys THEN RAISE EXCEPTION 'Record column inventory mismatch'; END IF;
    END LOOP;
  END LOOP;
END $verify$;
${tables.map(t => `INSERT INTO public.${t} SELECT records.* FROM crm_transfer_snapshot s,
  jsonb_populate_recordset(NULL::public.${t}, s.body->'tables'->'${t}') records;`).join('\n')}
DO $compare$ DECLARE target text; mismatch boolean;
BEGIN
  FOREACH target IN ARRAY ARRAY[${tables.map(t => `'${t}'`).join(',')}] LOOP
    EXECUTE format($query$
      WITH expected AS (
        SELECT to_jsonb(r) AS row FROM crm_transfer_snapshot s,
          jsonb_populate_recordset(NULL::public.%I, s.body->'tables'->%L) r
      ), actual AS (SELECT to_jsonb(r) AS row FROM public.%I r)
      SELECT EXISTS (
        (SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
        UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)
      )$query$, target, target, target) INTO mismatch;
    IF mismatch THEN RAISE EXCEPTION 'Full record reconciliation failed'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.lead_intakes l JOIN public.crm_contacts c ON c.id=l.contact_id WHERE l.tenant_id<>c.tenant_id)
    OR EXISTS (SELECT 1 FROM public.lead_events e JOIN public.lead_intakes l ON l.id=e.lead_intake_id WHERE e.tenant_id<>l.tenant_id)
    OR EXISTS (SELECT 1 FROM public.lead_events e JOIN public.crm_contacts c ON c.id=e.contact_id WHERE e.tenant_id<>c.tenant_id)
    OR EXISTS (SELECT 1 FROM public.job_applications a JOIN public.crm_contacts c ON c.id=a.contact_id WHERE a.tenant_id<>c.tenant_id)
  THEN RAISE EXCEPTION 'Cross-tenant relationship mismatch'; END IF;
END $compare$;
COMMIT;`;
}
module.exports = { importSql, tables };