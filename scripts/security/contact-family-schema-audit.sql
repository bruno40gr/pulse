-- Run manually in the intended production Supabase SQL Editor after confirming
-- its project identity. Metadata only: no customer rows, secrets, expressions,
-- migration history, policy bodies, defaults, function bodies or writes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
WITH wanted(name) AS (
  VALUES ('people'), ('students'), ('accounts'), ('student_accounts'),
    ('account_holders'), ('account_contacts'), ('tenant_memberships')
), relations AS (
  SELECT w.name, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity
  FROM wanted w
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = w.name
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
)
SELECT jsonb_build_object(
  'read_only', current_setting('transaction_read_only'),
  'scope', 'public family/contact relationship metadata only',
  'limitations', jsonb_build_array('Not a recipient authorization policy audit',
    'No records, definitions, policy expressions or applied migration history',
    'Does not establish customer relationships, consent or production readiness'),
  'relations', (SELECT jsonb_agg(jsonb_build_object(
    'name', r.name, 'present', r.oid IS NOT NULL, 'kind', r.relkind,
    'rls_enabled', r.relrowsecurity, 'rls_forced', r.relforcerowsecurity,
    'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
    'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', k.conname, 'type', k.contype, 'validated', k.convalidated,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.position)
        FROM unnest(k.conkey) WITH ORDINALITY u(attnum, position)
        JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum),
      'referenced_schema', rn.nspname, 'referenced_relation', rc.relname,
      'referenced_columns', (SELECT jsonb_agg(a.attname ORDER BY u.position)
        FROM unnest(k.confkey) WITH ORDINALITY u(attnum, position)
        JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum)
      ) ORDER BY k.conname)
      FROM pg_constraint k
      LEFT JOIN pg_class rc ON rc.oid = k.confrelid
      LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE k.conrelid = r.oid), '[]'::jsonb)
  ) ORDER BY r.name) FROM relations r)
);
ROLLBACK;