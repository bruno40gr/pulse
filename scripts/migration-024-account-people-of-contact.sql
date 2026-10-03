-- Migration 024: Reusable people of contact for customer accounts and
-- funded-student-specific contact assignments.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.funding_case_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_case_id UUID NOT NULL REFERENCES public.funding_cases(id) ON DELETE CASCADE,
  account_contact_id UUID NOT NULL REFERENCES public.account_contacts(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL DEFAULT 'family_contact'
    CHECK (purpose IN ('family_contact', 'coordinator_contact', 'authorization_contact', 'other')),
  relationship_snapshot TEXT,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funding_case_id, account_contact_id, purpose)
);

CREATE INDEX IF NOT EXISTS account_contacts_account_active
  ON public.account_contacts (tenant_id, account_id, is_active)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS funding_case_contacts_case
  ON public.funding_case_contacts (tenant_id, funding_case_id);

DROP TRIGGER IF EXISTS account_contacts_set_updated_at ON public.account_contacts;
CREATE TRIGGER account_contacts_set_updated_at
BEFORE UPDATE ON public.account_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

CREATE OR REPLACE FUNCTION public.odeon_account_contact_matches(
  p_tenant_id UUID,
  p_account_id UUID,
  p_student_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  matches BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE tenant_id = p_tenant_id
      AND account_id = p_account_id
      AND (p_student_id IS NULL OR id = p_student_id)
  ) INTO matches;
  IF matches THEN RETURN true; END IF;

  -- student_accounts is optional in this schema, so only consult it when it exists.
  -- Referencing it statically would fail every insert wherever the table is absent.
  IF to_regclass('public.student_accounts') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE $query$
    SELECT EXISTS (
      SELECT 1
      FROM public.student_accounts AS link
      JOIN public.students AS student ON student.id = link.student_id
      WHERE student.tenant_id = $1
        AND link.account_id = $2
        AND ($3::UUID IS NULL OR student.id = $3::UUID)
    )
  $query$ INTO matches USING p_tenant_id, p_account_id, p_student_id;
  RETURN matches;
END;
$$;

CREATE OR REPLACE FUNCTION public.odeon_validate_account_contact()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.odeon_account_contact_matches(NEW.tenant_id, NEW.account_id, NULL) THEN
    RAISE EXCEPTION 'Account contact must belong to a customer account in the same tenant.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_contacts_validate_links ON public.account_contacts;
CREATE TRIGGER account_contacts_validate_links
BEFORE INSERT OR UPDATE OF tenant_id, account_id
ON public.account_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_account_contact();

CREATE OR REPLACE FUNCTION public.odeon_validate_funding_case_contact()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  case_tenant UUID;
  case_student UUID;
  contact_account UUID;
BEGIN
  SELECT tenant_id, student_id INTO case_tenant, case_student
  FROM public.funding_cases WHERE id = NEW.funding_case_id;

  SELECT account_id INTO contact_account
  FROM public.account_contacts
  WHERE id = NEW.account_contact_id AND tenant_id = NEW.tenant_id AND archived_at IS NULL AND is_active = true;

  IF case_tenant IS NULL OR case_tenant <> NEW.tenant_id OR contact_account IS NULL THEN
    RAISE EXCEPTION 'Funding case contact must belong to the funding case tenant.';
  END IF;

  IF NOT public.odeon_account_contact_matches(NEW.tenant_id, contact_account, case_student) THEN
    RAISE EXCEPTION 'Funding case contact must belong to an account linked to the student.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_case_contacts_validate_links ON public.funding_case_contacts;
CREATE TRIGGER funding_case_contacts_validate_links
BEFORE INSERT OR UPDATE OF tenant_id, funding_case_id, account_contact_id
ON public.funding_case_contacts
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_case_contact();

ALTER TABLE public.account_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_contacts, public.funding_case_contacts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_contacts, public.funding_case_contacts TO service_role;

COMMIT;