BEGIN;

-- Service-only review staging and recoverable preimages. Never exposed to browsers.
CREATE TABLE public.subscription_reconciliation_runs (
  id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source_sha256 text NOT NULL,
  source_date date NOT NULL,
  expected_rows integer NOT NULL CHECK (expected_rows > 0),
  expected_fingerprint text NOT NULL,
  applied_at timestamptz,
  backup jsonb,
  result jsonb
);
CREATE TABLE public.subscription_reconciliation_rows (
  run_id text NOT NULL REFERENCES public.subscription_reconciliation_runs(id),
  subscription_id uuid NOT NULL,
  client_id uuid NOT NULL,
  staff_source_id uuid NOT NULL,
  teacher_person_id uuid NOT NULL REFERENCES public.people(id),
  service_name text NOT NULL,
  plan_name text NOT NULL,
  instrument text NOT NULL,
  service_type text NOT NULL,
  level integer CHECK (level > 0),
  duration integer CHECK (duration > 0),
  status text NOT NULL CHECK (status IN ('active','pending')),
  PRIMARY KEY(run_id, subscription_id)
);
ALTER TABLE public.subscription_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_reconciliation_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_reconciliation_runs, public.subscription_reconciliation_rows FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.subscription_reconciliation_runs, public.subscription_reconciliation_rows TO service_role;

CREATE UNIQUE INDEX enrollments_source_subscription_identity
  ON public.enrollments(tenant_id, (custom_fields->>'subscription_id'))
  WHERE custom_fields->>'subscription_id' IS NOT NULL;

CREATE FUNCTION public.apply_subscription_reconciliation(p_run text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.subscription_reconciliation_runs; current_fingerprint text; archived integer; inserted integer; created_students integer;
BEGIN
  SELECT * INTO STRICT r FROM public.subscription_reconciliation_runs WHERE id=p_run FOR UPDATE;
  IF r.applied_at IS NOT NULL THEN RETURN r.result; END IF;
  -- Freeze identity/assignment inputs as well as enrollment writes during the repair.
  LOCK TABLE public.subscription_reconciliation_rows IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.people,public.students,public.instructors,public.enrollments IN SHARE ROW EXCLUSIVE MODE;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'')) INTO current_fingerprint
    FROM public.enrollments e WHERE tenant_id=r.tenant_id;
  IF current_fingerprint<>r.expected_fingerprint THEN RAISE EXCEPTION 'Enrollment state changed since review'; END IF;
  IF (SELECT count(*) FROM public.subscription_reconciliation_rows WHERE run_id=p_run)<>r.expected_rows THEN RAISE EXCEPTION 'Incomplete source snapshot'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.subscription_reconciliation_rows x WHERE x.run_id=p_run AND (
      (SELECT count(*) FROM public.people p WHERE p.tenant_id=r.tenant_id AND p.custom_fields->>'external_id'=x.client_id::text)<>1
      OR (SELECT count(*) FROM public.people p JOIN public.instructors i ON i.person_id=p.id AND i.tenant_id=p.tenant_id
          WHERE p.tenant_id=r.tenant_id AND p.id=x.teacher_person_id
          AND lower(coalesce(p.custom_fields->>'staff_status','active')) NOT IN ('sunset','inactive','ended','archived'))<>1
    )
  ) THEN RAISE EXCEPTION 'Missing, ambiguous, foreign or inactive identity'; END IF;
  IF EXISTS (
    SELECT p.id FROM public.people p JOIN public.students s ON s.person_id=p.id AND s.tenant_id=p.tenant_id
    WHERE p.tenant_id=r.tenant_id AND p.custom_fields->>'external_id' IN
      (SELECT client_id::text FROM public.subscription_reconciliation_rows WHERE run_id=p_run)
    GROUP BY p.id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Ambiguous student role'; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments e WHERE e.tenant_id=r.tenant_id AND e.custom_fields->>'subscription_id' IN
    (SELECT subscription_id::text FROM public.subscription_reconciliation_rows WHERE run_id=p_run))
    THEN RAISE EXCEPTION 'Source subscription already linked; review a versioned update'; END IF;

  UPDATE public.subscription_reconciliation_runs SET backup=jsonb_build_object(
    'enrollments',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.enrollments e WHERE e.tenant_id=r.tenant_id),'[]'::jsonb),
    'student_ids',coalesce((SELECT jsonb_agg(s.id ORDER BY s.id) FROM public.students s WHERE s.tenant_id=r.tenant_id),'[]'::jsonb)
  ) WHERE id=p_run;
  -- A staff member can also be a learner. Preserve their existing person identity.
  -- No account is guessed from a payer name; missing family links remain unassigned.
  INSERT INTO public.students(tenant_id,person_id,client_status)
    SELECT DISTINCT r.tenant_id,p.id,'active' FROM public.subscription_reconciliation_rows x
    JOIN public.people p ON p.tenant_id=r.tenant_id AND p.custom_fields->>'external_id'=x.client_id::text
    WHERE x.run_id=p_run AND NOT EXISTS(SELECT 1 FROM public.students s WHERE s.person_id=p.id AND s.tenant_id=r.tenant_id);
  GET DIAGNOSTICS created_students=ROW_COUNT;
  -- Keep every historical teacher/attendance field unchanged; only currentness changes.
  UPDATE public.enrollments e SET status='ended',custom_fields=coalesce(e.custom_fields,'{}'::jsonb)||jsonb_build_object(
    'status','ended','superseded_by_subscription_snapshot',p_run)
    FROM public.students s,public.people p
    WHERE e.tenant_id=r.tenant_id AND s.tenant_id=r.tenant_id AND p.tenant_id=r.tenant_id
      AND e.student_id=s.id AND s.person_id=p.id AND e.custom_fields->>'subscription_id' IS NULL
      AND p.custom_fields->>'external_id' IN (SELECT client_id::text FROM public.subscription_reconciliation_rows WHERE run_id=p_run);
  GET DIAGNOSTICS archived=ROW_COUNT;
  INSERT INTO public.enrollments(tenant_id,student_id,instructor_person_id,instrument,service_type,plan_name,status,custom_fields)
    SELECT r.tenant_id,s.id,x.teacher_person_id,x.instrument,x.service_type,x.plan_name,x.status,
      jsonb_build_object('subscription_id',x.subscription_id,'source_client_id',x.client_id,'source_staff_id',x.staff_source_id,
        'source_date',r.source_date,'source_sha256',r.source_sha256,'reconciliation_run',p_run,
        'appointment_class_name',x.service_name,'level',x.level,'duration',x.duration,'status',x.status,
        'instructor',concat_ws(' ',teacher.first_name,teacher.last_name))
    FROM public.subscription_reconciliation_rows x
    JOIN public.people p ON p.tenant_id=r.tenant_id AND p.custom_fields->>'external_id'=x.client_id::text
    JOIN public.students s ON s.tenant_id=r.tenant_id AND s.person_id=p.id
    JOIN public.people teacher ON teacher.tenant_id=r.tenant_id AND teacher.id=x.teacher_person_id
    WHERE x.run_id=p_run;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted<>r.expected_rows THEN RAISE EXCEPTION 'Incomplete reconciliation'; END IF;
  UPDATE public.subscription_reconciliation_runs SET applied_at=now(),result=jsonb_build_object(
    'subscriptions',inserted,'historical_enrollments_preserved',archived,'student_roles_created',created_students,
    'post_apply_fingerprint',(SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text,'')) FROM public.enrollments e WHERE e.tenant_id=r.tenant_id))
    WHERE id=p_run RETURNING result INTO r.result;
  RETURN r.result;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_reconciliation(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_reconciliation(text) TO service_role;
COMMIT;