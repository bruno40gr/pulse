-- Run with psql -v ON_ERROR_STOP=1. Select the reviewed run beforehand using:
-- SET pulse.reconciliation_run = 'nov19-subscription-repair-v1';
-- Refuses rollback after any enrollment change; never destroys later bookings.
BEGIN;
DO $$
DECLARE
  r public.subscription_reconciliation_runs;
  current_fingerprint text;
BEGIN
  SELECT * INTO STRICT r FROM public.subscription_reconciliation_runs
    WHERE id=current_setting('pulse.reconciliation_run') FOR UPDATE;
  IF r.applied_at IS NULL OR r.backup IS NULL OR r.result->>'rolled_back_at' IS NOT NULL THEN
    RAISE EXCEPTION 'Run is not eligible for rollback';
  END IF;
  LOCK TABLE public.people,public.students,public.instructors,public.enrollments IN SHARE ROW EXCLUSIVE MODE;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'')) INTO current_fingerprint
    FROM public.enrollments e WHERE e.tenant_id=r.tenant_id;
  IF r.result->>'post_apply_fingerprint' IS NULL OR current_fingerprint<>r.result->>'post_apply_fingerprint' THEN
    RAISE EXCEPTION 'Enrollment state changed after repair; manual reviewed rollback required';
  END IF;
  DELETE FROM public.enrollments WHERE tenant_id=r.tenant_id AND custom_fields->>'reconciliation_run'=r.id;
  UPDATE public.enrollments e SET status=old.status,custom_fields=old.custom_fields
    FROM jsonb_populate_recordset(NULL::public.enrollments,r.backup->'enrollments') old
    WHERE e.id=old.id AND e.tenant_id=r.tenant_id;
  DELETE FROM public.students s WHERE s.tenant_id=r.tenant_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.backup->'student_ids') b(id) WHERE b.id=s.id::text)
    AND EXISTS (SELECT 1 FROM public.people p JOIN public.subscription_reconciliation_rows x
      ON x.run_id=r.id AND x.client_id::text=p.custom_fields->>'external_id'
      WHERE p.id=s.person_id AND p.tenant_id=r.tenant_id)
    AND NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.student_id=s.id);
  SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'')) INTO current_fingerprint
    FROM public.enrollments e WHERE e.tenant_id=r.tenant_id;
  IF current_fingerprint<>r.expected_fingerprint THEN RAISE EXCEPTION 'Rollback failed preimage verification'; END IF;
  UPDATE public.subscription_reconciliation_runs SET result=result||jsonb_build_object('rolled_back_at',now()) WHERE id=r.id;
END;
$$;
COMMIT;