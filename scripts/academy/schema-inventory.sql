-- Metadata only. No application rows, migration rows, function bodies, policy
-- expressions, defaults, view SQL or connection credentials are exported.
-- Definitions can embed private literals; request those separately after review.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
WITH relations AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS name, c.relkind,
    c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'supabase_migrations')
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
), entries AS (
  SELECT 'relation' AS kind, r.schema_name, r.name AS object_name,
    jsonb_build_object('relation_kind', r.relkind, 'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity) AS details
  FROM relations r
  UNION ALL
  SELECT 'column', r.schema_name, r.name,
    jsonb_build_object('name', a.attname, 'position', a.attnum,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
      'has_default', a.atthasdef, 'identity', a.attidentity, 'generated', a.attgenerated)
  FROM relations r JOIN pg_attribute a ON a.attrelid = r.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'constraint', r.schema_name, r.name,
    jsonb_build_object('name', k.conname, 'type', k.contype, 'validated', k.convalidated,
      'deferrable', k.condeferrable, 'initially_deferred', k.condeferred,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.ordinality)
        FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum),
      'referenced_schema', rn.nspname, 'referenced_relation', rc.relname,
      'referenced_columns', (SELECT jsonb_agg(a.attname ORDER BY u.ordinality)
        FROM unnest(k.confkey) WITH ORDINALITY u(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum),
      'update_action', k.confupdtype, 'delete_action', k.confdeltype)
  FROM relations r JOIN pg_constraint k ON k.conrelid = r.oid
  LEFT JOIN pg_class rc ON rc.oid = k.confrelid
  LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
  UNION ALL
  SELECT 'index', r.schema_name, r.name,
    jsonb_build_object('name', ic.relname, 'unique', i.indisunique,
      'primary', i.indisprimary, 'valid', i.indisvalid,
      'has_predicate', i.indpred IS NOT NULL, 'has_expressions', i.indexprs IS NOT NULL)
  FROM relations r JOIN pg_index i ON i.indrelid = r.oid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  UNION ALL
  SELECT 'policy', r.schema_name, r.name,
    jsonb_build_object('name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive,
      'roles', (SELECT jsonb_agg(CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid)::text END ORDER BY role_oid)
        FROM unnest(p.polroles) role_oid),
      'has_using', p.polqual IS NOT NULL, 'has_check', p.polwithcheck IS NOT NULL)
  FROM relations r JOIN pg_policy p ON p.polrelid = r.oid
  UNION ALL
  SELECT 'trigger', r.schema_name, r.name,
    jsonb_build_object('name', t.tgname, 'enabled', t.tgenabled,
      'function_schema', n.nspname, 'function_name', p.proname)
  FROM relations r JOIN pg_trigger t ON t.tgrelid = r.oid AND NOT t.tgisinternal
  JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace n ON n.oid = p.pronamespace
  UNION ALL
  SELECT 'function', n.nspname, p.proname,
    jsonb_build_object('argument_types', oidvectortypes(p.proargtypes),
      'security_definer', p.prosecdef, 'kind', p.prokind)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'table_grant', g.table_schema, g.table_name,
    jsonb_build_object('grantee', g.grantee, 'privilege', g.privilege_type, 'grantable', g.is_grantable)
  FROM information_schema.table_privileges g WHERE g.table_schema = 'public'
)
SELECT jsonb_build_object(
  'format_version', 1,
  'scope', jsonb_build_array('public', 'supabase_migrations'),
  'read_only', current_setting('transaction_read_only'),
  'server_version', current_setting('server_version'),
  'limitations', jsonb_build_array('No application or migration-history rows',
    'No expressions or executable definitions', 'Grants visible to executing role only',
    'Not a schema dump, authorization audit, source contract or migration approval'),
  'entries', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY kind, schema_name, object_name, details::text) FROM entries e), '[]'::jsonb)
);
ROLLBACK;