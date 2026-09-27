-- Migration 014: Add Mae Strider now and schedule Alex Bird for October 5, 2026.
--
-- Mae uses her existing Headliner person and verified email. Alex has no
-- existing person record and no supplied email, so this migration creates his
-- staff identity without inventing an address. Both receive unclaimed Admin
-- memberships; no Auth users or invitations are created.
--
-- Legacy shared-login eligibility remains controlled by lib/teachers.ts:
-- Mae is available immediately, while Alex is hidden until 2026-10-05 in the
-- America/Los_Angeles time zone.

BEGIN;

DO $$
DECLARE
  headliner_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  mae_person_id CONSTANT UUID := 'bbcd4340-15f5-49b8-bb69-d84c44aef353';
  admin_role_id UUID;
  conflicting_alex_count INTEGER;
  alex_person_id UUID;
BEGIN
  SELECT id
  INTO admin_role_id
  FROM public.roles
  WHERE tenant_id = headliner_tenant_id
    AND key = 'admin';

  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Migration 014 aborted: Headliner Admin role is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE id = mae_person_id
      AND tenant_id = headliner_tenant_id
      AND lower(trim(first_name)) = 'mae'
      AND lower(trim(last_name)) = 'strider'
      AND lower(trim(email)) = 'naadams2006@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Migration 014 aborted: Mae Strider no longer matches the reconciled person and email.';
  END IF;

  UPDATE public.people
  SET custom_fields = COALESCE(custom_fields, '{}'::JSONB) || jsonb_build_object(
    'staff_status', 'active',
    'staff_start_date', '2026-09-26'
  )
  WHERE id = mae_person_id
    AND tenant_id = headliner_tenant_id;

  INSERT INTO public.instructors (tenant_id, person_id)
  SELECT headliner_tenant_id, mae_person_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.instructors
    WHERE tenant_id = headliner_tenant_id
      AND person_id = mae_person_id
  );

  INSERT INTO public.tenant_memberships (
    tenant_id,
    person_id,
    role_id,
    status,
    legacy_access_enabled
  )
  VALUES (
    headliner_tenant_id,
    mae_person_id,
    admin_role_id,
    'unclaimed',
    true
  )
  ON CONFLICT (tenant_id, person_id) DO NOTHING;

  SELECT count(*)
  INTO conflicting_alex_count
  FROM public.people
  WHERE tenant_id = headliner_tenant_id
    AND lower(trim(first_name)) = 'alex'
    AND lower(trim(last_name)) = 'bird';

  IF conflicting_alex_count <> 0 THEN
    RAISE EXCEPTION 'Migration 014 aborted: an Alex Bird person appeared after reconciliation; review before onboarding.';
  END IF;

  INSERT INTO public.people (
    tenant_id,
    first_name,
    last_name,
    custom_fields
  )
  VALUES (
    headliner_tenant_id,
    'Alex',
    'Bird',
    jsonb_build_object(
      'staff_status', 'active',
      'staff_start_date', '2026-10-05'
    )
  )
  RETURNING id INTO alex_person_id;

  INSERT INTO public.instructors (tenant_id, person_id)
  SELECT headliner_tenant_id, alex_person_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.instructors
    WHERE tenant_id = headliner_tenant_id
      AND person_id = alex_person_id
  );

  INSERT INTO public.tenant_memberships (
    tenant_id,
    person_id,
    role_id,
    status,
    legacy_access_enabled
  )
  VALUES (
    headliner_tenant_id,
    alex_person_id,
    admin_role_id,
    'unclaimed',
    true
  )
  ON CONFLICT (tenant_id, person_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.instructors
    WHERE tenant_id = headliner_tenant_id
      AND person_id = mae_person_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE tenant_id = headliner_tenant_id
      AND person_id = mae_person_id
      AND role_id = admin_role_id
      AND status = 'unclaimed'
  ) THEN
    RAISE EXCEPTION 'Migration 014 aborted: Mae Strider onboarding verification failed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.instructors
    WHERE tenant_id = headliner_tenant_id
      AND person_id = alex_person_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE tenant_id = headliner_tenant_id
      AND person_id = alex_person_id
      AND role_id = admin_role_id
      AND status = 'unclaimed'
  ) THEN
    RAISE EXCEPTION 'Migration 014 aborted: Alex Bird onboarding verification failed.';
  END IF;
END;
$$;

COMMIT;