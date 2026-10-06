-- READ ONLY. Contains personal data in its output: never paste output in chat/Git.
-- Draft: execute against a live source only after explicit authorization.
-- One consistent transaction; this is a data snapshot, NOT a full database backup.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'format', 'odeon-crm-snapshot-v1',
  'tenants', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)
    FROM (SELECT id, name, is_demo FROM public.tenants) t),
  'tables', jsonb_build_object(
    'crm_contacts', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.crm_contacts t),
    'lead_intakes', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.lead_intakes t),
    'lead_events', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.lead_events t),
    'job_applications', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.job_applications t)
  )
) AS private_snapshot;
ROLLBACK;