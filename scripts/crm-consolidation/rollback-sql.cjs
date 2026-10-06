// SQL builder only: no credentials, files, connections or execution.
// Full replacement of the FOUR CRM tables only, guarded by an exact source baseline.
const { randomBytes } = require('node:crypto');
const { rollbackPlan } = require('./rollback-plan.cjs');
const { tables } = require('./transfer.cjs');

function rollbackSql(baseline, source, destination) {
  rollbackPlan(baseline, source, destination);
  const payload = JSON.stringify({ baseline, destination });
  let tag;
  do { tag = `$rollback_${randomBytes(16).toString('hex')}$`; } while (payload.includes(tag));
  const compare = (key) => `DO $compare$
  DECLARE target text; mismatch boolean; expected_keys text[]; actual_keys text[]; row_value jsonb;
  BEGIN
    IF EXISTS (SELECT 1 FROM crm_rollback_payload s,
      jsonb_to_recordset(s.body->'${key}'->'tenants') AS source(id uuid, name text, is_demo boolean)
      LEFT JOIN public.tenants dest ON dest.id=source.id
      WHERE dest.id IS NULL OR dest.name IS DISTINCT FROM source.name
        OR dest.is_demo IS DISTINCT FROM source.is_demo)
    THEN RAISE EXCEPTION 'Tenant inventory mismatch'; END IF;
    FOREACH target IN ARRAY ARRAY[${tables.map(t => `'${t}'`).join(',')}] LOOP
      SELECT array_agg(attname::text ORDER BY attname) INTO expected_keys FROM pg_attribute
        WHERE attrelid=('public.'||target)::regclass AND attnum>0 AND NOT attisdropped;
      FOR row_value IN SELECT jsonb_array_elements(body->'${key}'->'tables'->target) FROM crm_rollback_payload LOOP
        SELECT array_agg(k ORDER BY k) INTO actual_keys FROM jsonb_object_keys(row_value) k;
        IF actual_keys IS DISTINCT FROM expected_keys THEN RAISE EXCEPTION 'Record column inventory mismatch'; END IF;
      END LOOP;
      EXECUTE format($query$
        WITH expected AS (SELECT to_jsonb(r) AS row FROM crm_rollback_payload s,
          jsonb_populate_recordset(NULL::public.%I, s.body->'${key}'->'tables'->%L) r),
        actual AS (SELECT to_jsonb(r) AS row FROM public.%I r)
        SELECT EXISTS ((SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
          UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected))
        $query$, target, target, target) INTO mismatch;
      IF mismatch THEN RAISE EXCEPTION 'Rollback ${key} reconciliation failed'; END IF;
    END LOOP;
  END $compare$;`;
  return `BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.tenants IN SHARE MODE;
LOCK TABLE ${tables.map(t => `public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE crm_rollback_payload(body jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO crm_rollback_payload VALUES (${tag}${payload}${tag}::jsonb);
${compare('baseline')}
DO $triggers$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid IN (${tables.map(t => `'public.${t}'::regclass`).join(',')})
    AND NOT tgisinternal AND tgenabled <> 'O'
    AND NOT (tgname='odeon_crm_cutover_write_barrier' AND tgenabled='A'
      AND tgfoid=(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='odeon_crm_cutover_refuse_write'
          AND p.pronargs=0)))
  THEN RAISE EXCEPTION 'Unexpected trigger state'; END IF;
END $triggers$;
CREATE TEMP TABLE crm_rollback_barriers ON COMMIT DROP AS
  SELECT tgrelid FROM pg_trigger WHERE tgrelid IN (${tables.map(t => `'public.${t}'::regclass`).join(',')})
    AND tgname='odeon_crm_cutover_write_barrier' AND tgenabled='A';
${tables.map(t => `ALTER TABLE public.${t} DISABLE TRIGGER USER;`).join('\n')}
${[...tables].reverse().map(t => `DELETE FROM public.${t};`).join('\n')}
${tables.map(t => `INSERT INTO public.${t} SELECT r.* FROM crm_rollback_payload s,
  jsonb_populate_recordset(NULL::public.${t}, s.body->'destination'->'tables'->'${t}') r;`).join('\n')}
${compare('destination')}
${tables.map(t => `ALTER TABLE public.${t} ENABLE TRIGGER USER;`).join('\n')}
DO $restore_barriers$ DECLARE target regclass; BEGIN
  FOR target IN SELECT tgrelid::regclass FROM crm_rollback_barriers LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ALWAYS TRIGGER odeon_crm_cutover_write_barrier',target);
  END LOOP;
END $restore_barriers$;
COMMIT;`;
}

module.exports = { rollbackSql };