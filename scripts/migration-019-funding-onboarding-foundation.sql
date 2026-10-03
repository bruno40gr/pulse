-- Migration 019: Durable CharterFlow organization profiles and funded-case onboarding.
-- Keeps Migration 018 readable while moving all new onboarding writes to stable
-- funding organizations, immutable profile versions, and student-specific cases.

BEGIN;

CREATE TABLE IF NOT EXISTS public.funding_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  organization_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  legacy_payer_id UUID UNIQUE REFERENCES public.payers(id) ON DELETE SET NULL,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (tenant_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.funding_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_organization_id UUID NOT NULL REFERENCES public.funding_organizations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded', 'archived')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  change_note TEXT NOT NULL,
  program_name TEXT,
  organization_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(organization_rules) = 'object'),
  onboarding_requirements JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(onboarding_requirements) = 'object'),
  required_documents JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(required_documents) = 'array'),
  invoice_requirements JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(invoice_requirements) = 'object'),
  workflow_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(workflow_rules) = 'object'),
  payment_terms JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(payment_terms) = 'object'),
  recipient_routing TEXT,
  submission_config JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(submission_config) = 'object'),
  field_metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(field_metadata) = 'object'),
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  verified_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funding_organization_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS funding_profile_versions_one_active
  ON public.funding_profile_versions (funding_organization_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.funding_organization_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_organization_id UUID NOT NULL REFERENCES public.funding_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  contact_type TEXT NOT NULL DEFAULT 'general',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.funding_profile_version_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_profile_version_id UUID NOT NULL REFERENCES public.funding_profile_versions(id) ON DELETE CASCADE,
  funding_organization_contact_id UUID NOT NULL REFERENCES public.funding_organization_contacts(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL DEFAULT 'general',
  routing_priority INTEGER NOT NULL DEFAULT 0,
  routing_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(routing_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funding_profile_version_id, funding_organization_contact_id, purpose)
);

ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS funding_organization_id UUID REFERENCES public.funding_organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS onboarding_profile_version_id UUID REFERENCES public.funding_profile_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS current_profile_version_id UUID REFERENCES public.funding_profile_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS blocker_type TEXT,
  ADD COLUMN IF NOT EXISTS authorization_start_date DATE,
  ADD COLUMN IF NOT EXISTS authorization_end_date DATE,
  ADD COLUMN IF NOT EXISTS authorized_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS coverage_cap NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS coverage_percent INTEGER,
  ADD COLUMN IF NOT EXISTS service_codes JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS case_instructions TEXT,
  ADD COLUMN IF NOT EXISTS profile_overrides JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS source_row_key TEXT,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_lifecycle_status_check
    CHECK (lifecycle_status IN ('discovery', 'blocked', 'active', 'inactive', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_blocker_type_check
    CHECK (blocker_type IS NULL OR blocker_type IN ('vendor_approval_pending', 'student_linking_pending', 'document_task_pending', 'authorization_pending', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_coverage_percent_check
    CHECK (coverage_percent IS NULL OR coverage_percent BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_service_codes_array_check
    CHECK (jsonb_typeof(service_codes) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_profile_overrides_object_check
    CHECK (jsonb_typeof(profile_overrides) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.funding_cases ADD CONSTRAINT funding_cases_source_metadata_object_check
    CHECK (jsonb_typeof(source_metadata) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.funding_invoices
  ADD COLUMN IF NOT EXISTS funding_profile_version_id UUID REFERENCES public.funding_profile_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS case_configuration_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS generation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_pay_date DATE;

-- Migration 018 treated the compatibility student-payer link as permanent case
-- identity. Canonical identity is now student x funding organization, and an
-- archived case must not prevent a later active case for that relationship.
ALTER TABLE public.funding_cases
  DROP CONSTRAINT IF EXISTS funding_cases_tenant_id_student_payer_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS funding_cases_student_organization_unique
  ON public.funding_cases (tenant_id, student_id, funding_organization_id)
  WHERE funding_organization_id IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS funding_cases_source_row_unique
  ON public.funding_cases (tenant_id, source_type, source_reference, source_row_key)
  WHERE source_reference IS NOT NULL AND source_row_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS funding_organizations_tenant_status
  ON public.funding_organizations (tenant_id, status, name);
CREATE INDEX IF NOT EXISTS funding_profile_versions_organization
  ON public.funding_profile_versions (tenant_id, funding_organization_id, version_number DESC);
CREATE INDEX IF NOT EXISTS funding_contacts_organization
  ON public.funding_organization_contacts (tenant_id, funding_organization_id, is_active);

CREATE OR REPLACE FUNCTION public.odeon_prevent_funding_profile_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'superseded' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      NEW.status := 'superseded';
      NEW.effective_until := COALESCE(NEW.effective_until, now());
      IF (to_jsonb(NEW) - ARRAY['status','effective_until']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','effective_until']) THEN
        RAISE EXCEPTION 'Funding profile versions are immutable; create a new version.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Funding profile versions are immutable; create a new version.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_profile_versions_immutable ON public.funding_profile_versions;
CREATE TRIGGER funding_profile_versions_immutable
BEFORE UPDATE ON public.funding_profile_versions
FOR EACH ROW EXECUTE FUNCTION public.odeon_prevent_funding_profile_version_mutation();

CREATE OR REPLACE FUNCTION public.odeon_validate_funding_foundation_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_tenant UUID; linked_organization UUID; actor_tenant UUID;
BEGIN
  IF TG_TABLE_NAME = 'funding_profile_versions' THEN
    SELECT tenant_id INTO linked_tenant FROM public.funding_organizations WHERE id = NEW.funding_organization_id;
  ELSIF TG_TABLE_NAME = 'funding_organization_contacts' THEN
    SELECT tenant_id INTO linked_tenant FROM public.funding_organizations WHERE id = NEW.funding_organization_id;
  ELSE
    SELECT tenant_id, funding_organization_id INTO linked_tenant, linked_organization
      FROM public.funding_profile_versions WHERE id = NEW.funding_profile_version_id;
    IF linked_tenant = NEW.tenant_id THEN
      PERFORM 1 FROM public.funding_organization_contacts
        WHERE id = NEW.funding_organization_contact_id AND tenant_id = NEW.tenant_id
          AND funding_organization_id = linked_organization;
      IF NOT FOUND THEN RAISE EXCEPTION 'Profile contact must belong to the profile organization.'; END IF;
    END IF;
  END IF;
  IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Funding record links must belong to the same tenant.';
  END IF;
  IF TG_TABLE_NAME <> 'funding_profile_version_contacts' THEN
    IF NEW.created_by_membership_id IS NOT NULL THEN
      SELECT tenant_id INTO actor_tenant FROM public.tenant_memberships WHERE id = NEW.created_by_membership_id;
      IF actor_tenant IS NULL OR actor_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Funding author must belong to the record tenant.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_profile_versions_validate_links ON public.funding_profile_versions;
CREATE TRIGGER funding_profile_versions_validate_links BEFORE INSERT ON public.funding_profile_versions
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_foundation_links();
DROP TRIGGER IF EXISTS funding_organization_contacts_validate_links ON public.funding_organization_contacts;
CREATE TRIGGER funding_organization_contacts_validate_links BEFORE INSERT OR UPDATE ON public.funding_organization_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_foundation_links();
DROP TRIGGER IF EXISTS funding_profile_version_contacts_validate_links ON public.funding_profile_version_contacts;
CREATE TRIGGER funding_profile_version_contacts_validate_links BEFORE INSERT ON public.funding_profile_version_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_foundation_links();

-- Preserve any funded cases created before this migration. The audited production
-- tenant is empty, but other environments must not be left on the legacy model.
INSERT INTO public.funding_organizations (
  tenant_id, name, normalized_name, organization_type, legacy_payer_id, created_at, updated_at
)
SELECT payer.tenant_id, payer.name,
  regexp_replace(lower(payer.name), '[^a-z0-9]+', '', 'g'), payer.type, payer.id,
  payer.created_at, payer.updated_at
FROM public.payers AS payer
WHERE NOT EXISTS (
  SELECT 1 FROM public.funding_organizations AS organization WHERE organization.legacy_payer_id = payer.id
)
ON CONFLICT DO NOTHING;

INSERT INTO public.funding_profile_versions (
  tenant_id, funding_organization_id, version_number, status, change_note, program_name,
  organization_rules, payment_terms, recipient_routing, submission_config, created_at
)
SELECT organization.tenant_id, organization.id, 1, 'active',
  'Backfilled from the pre-versioned payer record.', payer.program_name,
  jsonb_strip_nulls(jsonb_build_object('payment_method', NULL)),
  jsonb_strip_nulls(jsonb_build_object('funding_terms', payer.funding_terms)),
  NULL, '{}'::JSONB, payer.created_at
FROM public.funding_organizations AS organization
JOIN public.payers AS payer ON payer.id = organization.legacy_payer_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.funding_profile_versions AS profile
  WHERE profile.funding_organization_id = organization.id
)
ON CONFLICT DO NOTHING;

WITH legacy_case_mapping AS (
  SELECT funding_case.id AS funding_case_id,
    organization.id AS funding_organization_id,
    profile.id AS funding_profile_version_id
  FROM public.funding_cases AS funding_case
  JOIN public.payers AS payer ON payer.id = funding_case.payer_id
  JOIN public.funding_organizations AS organization
    ON organization.tenant_id = payer.tenant_id
    AND (organization.legacy_payer_id = funding_case.payer_id
      OR organization.normalized_name = regexp_replace(lower(payer.name), '[^a-z0-9]+', '', 'g'))
  JOIN public.funding_profile_versions AS profile
    ON profile.funding_organization_id = organization.id AND profile.status = 'active'
  WHERE funding_case.funding_organization_id IS NULL
)
UPDATE public.funding_cases AS funding_case
SET funding_organization_id = mapping.funding_organization_id,
    onboarding_profile_version_id = mapping.funding_profile_version_id,
    current_profile_version_id = mapping.funding_profile_version_id,
    lifecycle_status = CASE WHEN funding_case.workflow_status = 'active' THEN 'active' ELSE 'blocked' END,
    blocker_type = CASE WHEN funding_case.workflow_status IN ('needs_review', 'waiting') THEN 'other' ELSE NULL END,
    source_type = 'migration',
    source_metadata = jsonb_build_object('legacy_payer_id', funding_case.payer_id, 'migration', '019')
FROM legacy_case_mapping AS mapping
WHERE mapping.funding_case_id = funding_case.id;

UPDATE public.funding_invoices AS invoice
SET funding_profile_version_id = funding_case.current_profile_version_id,
    case_configuration_snapshot = jsonb_build_object(
      'profile_version_id', funding_case.current_profile_version_id,
      'authorization_reference', funding_case.authorization_reference,
      'service_codes', funding_case.service_codes,
      'profile_overrides', funding_case.profile_overrides,
      'recipient_routing', COALESCE(funding_case.profile_overrides->>'recipient_routing', profile.recipient_routing),
      'submission_config', profile.submission_config,
      'backfilled_by_migration', '019'
    ),
    generation_snapshot = jsonb_build_object(
      'profile_version_id', funding_case.current_profile_version_id,
      'invoice_requirements', profile.invoice_requirements,
      'payment_terms', profile.payment_terms,
      'service_description', funding_case.service_description,
      'service_codes', funding_case.service_codes,
      'authorization_reference', funding_case.authorization_reference,
      'backfilled_by_migration', '019'
    )
FROM public.funding_cases AS funding_case
JOIN public.funding_profile_versions AS profile ON profile.id = funding_case.current_profile_version_id
WHERE invoice.funding_case_id = funding_case.id
  AND invoice.funding_profile_version_id IS NULL;

CREATE OR REPLACE FUNCTION public.odeon_create_funding_profile_version(
  p_tenant_id UUID,
  p_funding_organization_id UUID,
  p_profile JSONB,
  p_change_note TEXT,
  p_membership_id UUID
) RETURNS public.funding_profile_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_profile public.funding_profile_versions; created_profile public.funding_profile_versions; next_version INTEGER;
BEGIN
  PERFORM 1 FROM public.funding_organizations WHERE id = p_funding_organization_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding organization was not found for this tenant.'; END IF;
  IF length(trim(COALESCE(p_change_note, ''))) = 0 THEN RAISE EXCEPTION 'A profile change note is required.'; END IF;
  SELECT * INTO current_profile FROM public.funding_profile_versions
    WHERE tenant_id = p_tenant_id AND funding_organization_id = p_funding_organization_id AND status = 'active'
    FOR UPDATE;
  next_version := COALESCE(current_profile.version_number, 0) + 1;
  IF current_profile.id IS NOT NULL THEN
    UPDATE public.funding_profile_versions SET status = 'superseded', effective_until = now() WHERE id = current_profile.id;
  END IF;
  INSERT INTO public.funding_profile_versions (
    tenant_id, funding_organization_id, version_number, status, change_note, program_name,
    organization_rules, onboarding_requirements, required_documents, invoice_requirements,
    workflow_rules, payment_terms, recipient_routing, submission_config, field_metadata,
    created_by_membership_id, verified_by_membership_id, verified_at
  ) VALUES (
    p_tenant_id, p_funding_organization_id, next_version, 'active', trim(p_change_note), NULLIF(trim(p_profile->>'program_name'), ''),
    COALESCE(p_profile->'organization_rules', '{}'::JSONB), COALESCE(p_profile->'onboarding_requirements', '{}'::JSONB),
    COALESCE(p_profile->'required_documents', '[]'::JSONB), COALESCE(p_profile->'invoice_requirements', '{}'::JSONB),
    COALESCE(p_profile->'workflow_rules', '{}'::JSONB), COALESCE(p_profile->'payment_terms', '{}'::JSONB),
    NULLIF(trim(p_profile->>'recipient_routing'), ''), COALESCE(p_profile->'submission_config', '{}'::JSONB),
    COALESCE(p_profile->'field_metadata', '{}'::JSONB), p_membership_id,
    CASE WHEN COALESCE((p_profile->>'verified')::BOOLEAN, false) THEN p_membership_id ELSE NULL END,
    CASE WHEN COALESCE((p_profile->>'verified')::BOOLEAN, false) THEN now() ELSE NULL END
  ) RETURNING * INTO created_profile;
  UPDATE public.funding_cases
  SET current_profile_version_id = created_profile.id
  WHERE tenant_id = p_tenant_id
    AND funding_organization_id = p_funding_organization_id
    AND archived_at IS NULL;
  RETURN created_profile;
END;
$$;

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
    IF profile_record.id IS NULL THEN RAISE EXCEPTION 'Funding profile was not found for this organization.'; END IF;
  ELSIF NOT organization_created THEN
    SELECT * INTO profile_record FROM public.funding_profile_versions
      WHERE tenant_id = p_tenant_id AND funding_organization_id = organization_record.id AND status = 'active';
    IF profile_record.id IS NULL THEN
      SELECT * INTO profile_record FROM public.odeon_create_funding_profile_version(
        p_tenant_id, organization_record.id, profile_input,
        COALESCE(NULLIF(trim(profile_input->>'change_note'), ''), 'Initial profile created during case onboarding.'), p_membership_id
      );
    END IF;
  ELSE
    SELECT * INTO profile_record FROM public.odeon_create_funding_profile_version(
      p_tenant_id, organization_record.id, profile_input,
      COALESCE(NULLIF(trim(profile_input->>'change_note'), ''), 'Initial profile created during case onboarding.'), p_membership_id
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
    COALESCE((case_input->>'coverage_percent')::INTEGER, 100), (case_input->>'coverage_cap')::NUMERIC,
    (case_input->>'authorization_start_date')::DATE, (case_input->>'authorization_end_date')::DATE,
    NULLIF(trim(case_input->>'case_instructions'), '')
  ) ON CONFLICT (student_id, payer_id) DO UPDATE SET
    coverage_percent = EXCLUDED.coverage_percent, coverage_cap = EXCLUDED.coverage_cap,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, notes = EXCLUDED.notes
  RETURNING * INTO legacy_link;

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
    trim(case_input->>'service_description'),
    CASE WHEN COALESCE(case_input->>'lifecycle_status', 'active') = 'blocked' THEN 'needs_review' ELSE 'active' END,
    COALESCE(NULLIF(case_input->>'lifecycle_status', ''), 'active'), NULLIF(case_input->>'blocker_type', ''),
    COALESCE(NULLIF(case_input->>'waiting_on', ''), 'Vendor'), COALESCE(case_input->>'next_step', ''),
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
    p_tenant_id, created_case.id, 'case.onboarded', 'Funded case onboarded',
    'Linked the existing student to ' || organization_record.name || '.',
    jsonb_build_object('source_type', source_type_value, 'organization_id', organization_record.id,
      'profile_version_id', profile_record.id, 'profile_version', profile_record.version_number), p_membership_id
  );
  RETURN created_case.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.odeon_validate_canonical_funding_case_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE organization_tenant UUID; onboarding_tenant UUID; onboarding_organization UUID; current_tenant UUID; current_organization UUID;
BEGIN
  IF NEW.funding_organization_id IS NULL THEN RETURN NEW; END IF;
  SELECT tenant_id INTO organization_tenant FROM public.funding_organizations WHERE id = NEW.funding_organization_id;
  IF organization_tenant IS NULL OR organization_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Funding organization must belong to the case tenant.';
  END IF;
  SELECT tenant_id, funding_organization_id INTO onboarding_tenant, onboarding_organization
    FROM public.funding_profile_versions WHERE id = NEW.onboarding_profile_version_id;
  SELECT tenant_id, funding_organization_id INTO current_tenant, current_organization
    FROM public.funding_profile_versions WHERE id = NEW.current_profile_version_id;
  IF onboarding_tenant <> NEW.tenant_id OR onboarding_organization <> NEW.funding_organization_id
    OR current_tenant <> NEW.tenant_id OR current_organization <> NEW.funding_organization_id THEN
    RAISE EXCEPTION 'Funding case profiles must belong to the case organization and tenant.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_cases_validate_canonical_links ON public.funding_cases;
CREATE TRIGGER funding_cases_validate_canonical_links
BEFORE INSERT OR UPDATE OF tenant_id, funding_organization_id, onboarding_profile_version_id, current_profile_version_id
ON public.funding_cases FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_canonical_funding_case_links();

CREATE OR REPLACE FUNCTION public.odeon_prepare_funding_invoice_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_record public.funding_cases; profile_record public.funding_profile_versions;
BEGIN
  SELECT * INTO case_record FROM public.funding_cases WHERE id = NEW.funding_case_id AND tenant_id = NEW.tenant_id;
  IF case_record.id IS NULL THEN RAISE EXCEPTION 'Funding invoice must belong to the case tenant.'; END IF;
  IF NEW.funding_profile_version_id IS NULL THEN NEW.funding_profile_version_id := case_record.current_profile_version_id; END IF;
  IF NEW.funding_profile_version_id IS NOT NULL THEN
    SELECT * INTO profile_record FROM public.funding_profile_versions WHERE id = NEW.funding_profile_version_id;
    IF profile_record.tenant_id <> NEW.tenant_id OR profile_record.funding_organization_id <> case_record.funding_organization_id THEN
      RAISE EXCEPTION 'Invoice profile version must belong to the case organization.';
    END IF;
  END IF;
  NEW.case_configuration_snapshot := jsonb_build_object(
    'profile_version_id', NEW.funding_profile_version_id, 'authorization_reference', case_record.authorization_reference,
    'service_codes', case_record.service_codes, 'profile_overrides', case_record.profile_overrides,
    'recipient_routing', COALESCE(case_record.profile_overrides->>'recipient_routing', profile_record.recipient_routing),
    'submission_config', COALESCE(profile_record.submission_config, '{}'::JSONB)
  );
  NEW.generation_snapshot := jsonb_build_object(
    'profile_version_id', NEW.funding_profile_version_id,
    'invoice_requirements', COALESCE(profile_record.invoice_requirements, '{}'::JSONB),
    'payment_terms', COALESCE(profile_record.payment_terms, '{}'::JSONB),
    'service_description', case_record.service_description,
    'service_codes', case_record.service_codes,
    'authorization_reference', case_record.authorization_reference
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.odeon_initialize_funding_invoice()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_status TEXT;
BEGIN
  INSERT INTO public.funding_invoice_status_events
    (tenant_id, funding_invoice_id, from_status, to_status, evidence, changed_by_membership_id)
  VALUES (NEW.tenant_id, NEW.id, NULL, NEW.status, NEW.rejection_evidence, NEW.created_by_membership_id);
  case_status := CASE WHEN NEW.status IN ('draft','overdue','rejected') THEN 'needs_review'
    WHEN NEW.status = 'pending' THEN 'waiting' WHEN NEW.status = 'paid' THEN 'paid' ELSE 'active' END;
  UPDATE public.funding_cases SET workflow_status = case_status WHERE id = NEW.funding_case_id;
  INSERT INTO public.funding_case_events
    (tenant_id, funding_case_id, event_type, title, detail, metadata, created_by_membership_id)
  VALUES (NEW.tenant_id, NEW.funding_case_id, 'invoice.created', 'Invoice created', NEW.invoice_number,
    jsonb_build_object('invoice_id', NEW.id, 'status', NEW.status, 'profile_version_id', NEW.funding_profile_version_id), NEW.created_by_membership_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_invoice_prepare_snapshot ON public.funding_invoices;
CREATE TRIGGER funding_invoice_prepare_snapshot BEFORE INSERT ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_prepare_funding_invoice_snapshot();
-- Migration 018 used the plural trigger name. Remove it before installing the
-- canonical trigger so invoice initialization runs exactly once.
DROP TRIGGER IF EXISTS funding_invoices_initialize ON public.funding_invoices;
DROP TRIGGER IF EXISTS funding_invoice_initialize ON public.funding_invoices;
CREATE TRIGGER funding_invoice_initialize AFTER INSERT ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_initialize_funding_invoice();

DROP TRIGGER IF EXISTS funding_organizations_set_updated_at ON public.funding_organizations;
CREATE TRIGGER funding_organizations_set_updated_at BEFORE UPDATE ON public.funding_organizations
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();
DROP TRIGGER IF EXISTS funding_contacts_set_updated_at ON public.funding_organization_contacts;
CREATE TRIGGER funding_contacts_set_updated_at BEFORE UPDATE ON public.funding_organization_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

ALTER TABLE public.funding_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_organization_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_profile_version_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_organizations, public.funding_profile_versions,
  public.funding_organization_contacts, public.funding_profile_version_contacts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_organizations, public.funding_organization_contacts TO service_role;
GRANT SELECT, INSERT ON public.funding_profile_versions, public.funding_profile_version_contacts TO service_role;
REVOKE ALL ON FUNCTION public.odeon_create_funding_profile_version(UUID,UUID,JSONB,TEXT,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.odeon_onboard_funding_case(UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_create_funding_profile_version(UUID,UUID,JSONB,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.odeon_onboard_funding_case(UUID,UUID,JSONB) TO service_role;

COMMIT;