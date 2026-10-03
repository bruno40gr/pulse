-- Migration 022: Minimal funded-student assignment and reusable funding programs.

BEGIN;

ALTER TABLE public.funding_cases
  ALTER COLUMN service_description DROP NOT NULL;

ALTER TABLE public.student_payers
  ALTER COLUMN coverage_percent DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.odeon_onboard_funding_case(
  p_tenant_id UUID,
  p_membership_id UUID,
  p_input JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  student_record public.students; organization_record public.funding_organizations;
  profile_record public.funding_profile_versions; contact_record public.funding_organization_contacts;
  legacy_payer public.payers; legacy_link public.student_payers; created_case public.funding_cases;
  organization_input JSONB; profile_input JSONB; case_input JSONB; source_input JSONB; contact_input JSONB;
  normalized_name TEXT; organization_name TEXT; organization_type TEXT; source_type_value TEXT;
  organization_created BOOLEAN := false;
  initial_next_step TEXT;
  initial_workflow_status TEXT;
BEGIN
  organization_input := COALESCE(p_input->'organization', '{}'::JSONB);
  profile_input := COALESCE(p_input->'profile', '{}'::JSONB);
  case_input := COALESCE(p_input->'case', '{}'::JSONB);
  source_input := COALESCE(p_input->'source', '{}'::JSONB);
  contact_input := COALESCE(p_input->'contact', '{}'::JSONB);
  SELECT * INTO student_record FROM public.students WHERE id = (p_input->>'student_id')::UUID AND tenant_id = p_tenant_id;
  IF student_record.id IS NULL THEN RAISE EXCEPTION 'Student was not found for this tenant.'; END IF;
  PERFORM 1 FROM public.tenant_memberships WHERE id = p_membership_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding actor was not found for this tenant.'; END IF;

  IF NULLIF(organization_input->>'id', '') IS NOT NULL THEN
    SELECT * INTO organization_record FROM public.funding_organizations
      WHERE id = (organization_input->>'id')::UUID AND tenant_id = p_tenant_id AND archived_at IS NULL;
    IF organization_record.id IS NULL THEN RAISE EXCEPTION 'Funding organization was not found for this tenant.'; END IF;
  ELSE
    organization_name := trim(COALESCE(organization_input->>'name', ''));
    IF organization_name = '' THEN RAISE EXCEPTION 'Funding organization name is required.'; END IF;
    normalized_name := regexp_replace(lower(organization_name), '[^a-z0-9]+', '', 'g');
    organization_type := COALESCE(NULLIF(trim(organization_input->>'organization_type'), ''), 'other');
    INSERT INTO public.payers (tenant_id, name, type, program_name, is_active)
      VALUES (p_tenant_id, organization_name, organization_type, NULLIF(trim(profile_input->>'program_name'), ''), true)
      RETURNING * INTO legacy_payer;
    INSERT INTO public.funding_organizations (tenant_id, name, normalized_name, organization_type, legacy_payer_id, created_by_membership_id)
      VALUES (p_tenant_id, organization_name, normalized_name, organization_type, legacy_payer.id, p_membership_id)
      RETURNING * INTO organization_record;
    organization_created := true;
  END IF;

  IF organization_record.legacy_payer_id IS NULL THEN
    INSERT INTO public.payers (tenant_id, name, type, program_name, is_active)
      VALUES (p_tenant_id, organization_record.name, organization_record.organization_type, NULLIF(trim(profile_input->>'program_name'), ''), true)
      RETURNING * INTO legacy_payer;
    UPDATE public.funding_organizations SET legacy_payer_id = legacy_payer.id WHERE id = organization_record.id;
    organization_record.legacy_payer_id := legacy_payer.id;
  ELSE
    SELECT * INTO legacy_payer FROM public.payers WHERE id = organization_record.legacy_payer_id;
  END IF;

  IF NULLIF(organization_input->>'profile_version_id', '') IS NOT NULL THEN
    SELECT * INTO profile_record FROM public.funding_profile_versions
      WHERE id = (organization_input->>'profile_version_id')::UUID AND tenant_id = p_tenant_id
        AND funding_organization_id = organization_record.id;
    IF profile_record.id IS NULL THEN RAISE EXCEPTION 'Funding program was not found for this organization.'; END IF;
  ELSIF NOT organization_created THEN
    SELECT * INTO profile_record FROM public.funding_profile_versions
      WHERE tenant_id = p_tenant_id AND funding_organization_id = organization_record.id AND status = 'active';
    IF profile_record.id IS NULL THEN
      SELECT * INTO profile_record FROM public.odeon_create_funding_profile_version(
        p_tenant_id, organization_record.id, profile_input,
        COALESCE(NULLIF(trim(profile_input->>'change_note'), ''), 'Initial funding program setup.'), p_membership_id
      );
    END IF;
  ELSE
    SELECT * INTO profile_record FROM public.odeon_create_funding_profile_version(
      p_tenant_id, organization_record.id, profile_input,
      COALESCE(NULLIF(trim(profile_input->>'change_note'), ''), 'Initial funding program setup.'), p_membership_id
    );
  END IF;

  IF length(trim(COALESCE(contact_input->>'name', ''))) > 0 THEN
    INSERT INTO public.funding_organization_contacts (
      tenant_id, funding_organization_id, name, role, email, phone, contact_type, notes, created_by_membership_id
    ) VALUES (
      p_tenant_id, organization_record.id, trim(contact_input->>'name'), NULLIF(trim(contact_input->>'role'), ''),
      NULLIF(trim(contact_input->>'email'), ''), NULLIF(trim(contact_input->>'phone'), ''),
      COALESCE(NULLIF(trim(contact_input->>'contact_type'), ''), 'general'), NULLIF(trim(contact_input->>'notes'), ''), p_membership_id
    ) RETURNING * INTO contact_record;
    INSERT INTO public.funding_profile_version_contacts (
      tenant_id, funding_profile_version_id, funding_organization_contact_id, purpose, routing_snapshot
    ) VALUES (
      p_tenant_id, profile_record.id, contact_record.id,
      COALESCE(NULLIF(trim(contact_input->>'purpose'), ''), 'general'),
      jsonb_build_object('name', contact_record.name, 'role', contact_record.role, 'email', contact_record.email,
        'phone', contact_record.phone, 'contact_type', contact_record.contact_type)
    );
  END IF;

  INSERT INTO public.student_payers (student_id, payer_id, coverage_percent, coverage_cap, start_date, end_date, notes)
  VALUES (
    student_record.id, organization_record.legacy_payer_id,
    (case_input->>'coverage_percent')::INTEGER, (case_input->>'coverage_cap')::NUMERIC,
    (case_input->>'authorization_start_date')::DATE, (case_input->>'authorization_end_date')::DATE,
    NULLIF(trim(case_input->>'case_instructions'), '')
  ) ON CONFLICT (student_id, payer_id) DO UPDATE SET
    coverage_percent = EXCLUDED.coverage_percent, coverage_cap = EXCLUDED.coverage_cap,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, notes = EXCLUDED.notes
  RETURNING * INTO legacy_link;

  initial_next_step := COALESCE(
    NULLIF(trim(case_input->>'next_step'), ''),
    CASE
      WHEN NULLIF(trim(case_input->>'service_description'), '') IS NULL THEN 'Add service details'
      WHEN NULLIF(trim(case_input->>'authorization_reference'), '') IS NULL THEN 'Add authorization or purchase order'
      WHEN NULLIF(trim(case_input->>'authorization_start_date'), '') IS NULL THEN 'Add coverage dates'
      ELSE ''
    END
  );
  initial_workflow_status := CASE
    WHEN COALESCE(case_input->>'lifecycle_status', 'active') = 'blocked' THEN 'needs_review'
    WHEN initial_next_step <> '' AND NULLIF(trim(case_input->>'next_step'), '') IS NULL THEN 'needs_review'
    ELSE 'active'
  END;

  source_type_value := COALESCE(NULLIF(trim(source_input->>'type'), ''), 'manual');
  INSERT INTO public.funding_cases (
    tenant_id, student_id, payer_id, student_payer_id, funding_organization_id,
    onboarding_profile_version_id, current_profile_version_id, program_type, service_description,
    workflow_status, lifecycle_status, blocker_type, waiting_on, next_step, next_step_options, due_date,
    authorization_reference, authorization_start_date, authorization_end_date, authorized_amount,
    coverage_cap, coverage_percent, service_codes, case_instructions, profile_overrides,
    invoice_cadence, submission_route, payment_method, instructions,
    source_type, source_reference, source_row_key, source_metadata, created_by_membership_id
  ) VALUES (
    p_tenant_id, student_record.id, organization_record.legacy_payer_id, legacy_link.id, organization_record.id,
    profile_record.id, profile_record.id, organization_record.organization_type,
    NULLIF(trim(case_input->>'service_description'), ''),
    initial_workflow_status,
    COALESCE(NULLIF(case_input->>'lifecycle_status', ''), 'active'), NULLIF(case_input->>'blocker_type', ''),
    COALESCE(NULLIF(case_input->>'waiting_on', ''), 'Vendor'), initial_next_step,
    COALESCE(case_input->'next_step_options', '[]'::JSONB), (case_input->>'due_date')::DATE,
    NULLIF(trim(case_input->>'authorization_reference'), ''), (case_input->>'authorization_start_date')::DATE,
    (case_input->>'authorization_end_date')::DATE, (case_input->>'authorized_amount')::NUMERIC,
    (case_input->>'coverage_cap')::NUMERIC, (case_input->>'coverage_percent')::INTEGER,
    COALESCE(case_input->'service_codes', '[]'::JSONB), NULLIF(trim(case_input->>'case_instructions'), ''),
    COALESCE(case_input->'profile_overrides', '{}'::JSONB), profile_record.payment_terms->>'invoice_cadence',
    profile_record.recipient_routing, profile_record.organization_rules->>'payment_method',
    COALESCE(NULLIF(trim(case_input->>'case_instructions'), ''), profile_record.submission_config->>'instructions'),
    source_type_value, NULLIF(trim(source_input->>'reference'), ''), NULLIF(trim(source_input->>'row_key'), ''),
    COALESCE(source_input->'metadata', '{}'::JSONB), p_membership_id
  ) RETURNING * INTO created_case;

  INSERT INTO public.funding_case_events (
    tenant_id, funding_case_id, event_type, title, detail, metadata, created_by_membership_id
  ) VALUES (
    p_tenant_id, created_case.id, 'case.onboarded', 'Funded student added',
    'Assigned the student to ' || COALESCE(profile_record.program_name, organization_record.name) || '.',
    jsonb_build_object('source_type', source_type_value, 'organization_id', organization_record.id,
      'profile_version_id', profile_record.id, 'profile_version', profile_record.version_number), p_membership_id
  );
  RETURN created_case.id;
END;
$$;

REVOKE ALL ON FUNCTION public.odeon_onboard_funding_case(UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_onboard_funding_case(UUID,UUID,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.odeon_create_funding_program(
  p_tenant_id UUID,
  p_membership_id UUID,
  p_input JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  organization_record public.funding_organizations;
  payer_record public.payers;
  profile_record public.funding_profile_versions;
  contact_record public.funding_organization_contacts;
  contact_input JSONB;
  organization_name TEXT;
  normalized_name TEXT;
BEGIN
  PERFORM 1 FROM public.tenant_memberships WHERE id = p_membership_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding actor was not found for this tenant.'; END IF;

  organization_name := trim(COALESCE(p_input->>'organization_name', ''));
  IF organization_name = '' THEN RAISE EXCEPTION 'Funding organization name is required.'; END IF;
  IF trim(COALESCE(p_input->>'program_name', '')) = '' THEN RAISE EXCEPTION 'Funding program name is required.'; END IF;
  normalized_name := regexp_replace(lower(organization_name), '[^a-z0-9]+', '', 'g');

  INSERT INTO public.payers (tenant_id, name, type, program_name, is_active)
  VALUES (
    p_tenant_id, organization_name,
    COALESCE(NULLIF(trim(p_input->>'organization_type'), ''), 'other'),
    trim(p_input->>'program_name'), true
  ) RETURNING * INTO payer_record;

  INSERT INTO public.funding_organizations (
    tenant_id, name, normalized_name, organization_type, legacy_payer_id, created_by_membership_id
  ) VALUES (
    p_tenant_id, organization_name, normalized_name,
    COALESCE(NULLIF(trim(p_input->>'organization_type'), ''), 'other'),
    payer_record.id, p_membership_id
  ) RETURNING * INTO organization_record;

  SELECT * INTO profile_record FROM public.odeon_create_funding_profile_version(
    p_tenant_id,
    organization_record.id,
    jsonb_build_object(
      'program_name', trim(p_input->>'program_name'),
      'recipient_routing', NULLIF(trim(p_input->>'recipient_routing'), ''),
      'payment_terms', COALESCE(p_input->'payment_terms', '{}'::JSONB),
      'submission_config', COALESCE(p_input->'submission_config', '{}'::JSONB),
      'organization_rules', COALESCE(p_input->'organization_rules', '{}'::JSONB),
      'onboarding_requirements', COALESCE(p_input->'onboarding_requirements', '{}'::JSONB),
      'required_documents', COALESCE(p_input->'required_documents', '[]'::JSONB),
      'invoice_requirements', COALESCE(p_input->'invoice_requirements', '{}'::JSONB),
      'workflow_rules', COALESCE(p_input->'workflow_rules', '{}'::JSONB),
      'field_metadata', COALESCE(p_input->'field_metadata', '{}'::JSONB),
      'verified', COALESCE((p_input->>'verified')::BOOLEAN, false)
    ),
    'Initial funding program setup.',
    p_membership_id
  );

  contact_input := COALESCE(p_input->'contact', '{}'::JSONB);
  IF length(trim(COALESCE(contact_input->>'name', ''))) > 0 THEN
    INSERT INTO public.funding_organization_contacts (
      tenant_id, funding_organization_id, name, role, email, phone, contact_type, notes, created_by_membership_id
    ) VALUES (
      p_tenant_id, organization_record.id, trim(contact_input->>'name'),
      NULLIF(trim(contact_input->>'role'), ''), NULLIF(trim(contact_input->>'email'), ''),
      NULLIF(trim(contact_input->>'phone'), ''), 'program_support',
      NULLIF(trim(contact_input->>'notes'), ''), p_membership_id
    ) RETURNING * INTO contact_record;

    INSERT INTO public.funding_profile_version_contacts (
      tenant_id, funding_profile_version_id, funding_organization_contact_id, purpose, routing_snapshot
    ) VALUES (
      p_tenant_id, profile_record.id, contact_record.id, 'program_support',
      jsonb_build_object('name', contact_record.name, 'role', contact_record.role, 'email', contact_record.email, 'phone', contact_record.phone)
    );
  END IF;

  RETURN organization_record.id;
END;
$$;

REVOKE ALL ON FUNCTION public.odeon_create_funding_program(UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_create_funding_program(UUID,UUID,JSONB) TO service_role;

COMMIT;