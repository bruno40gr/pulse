-- Migration 018: CharterFlow funded cases and manual invoice-status workflow.
-- Additive and idempotent. Reuses the existing students, payers, and
-- student_payers model; the two payer foundation tables are created only when
-- an environment has not yet applied historical Migration 001.

BEGIN;

CREATE TABLE IF NOT EXISTS public.payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  program_name TEXT,
  funding_terms TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  coverage_percent INTEGER DEFAULT 100 CHECK (coverage_percent BETWEEN 0 AND 100),
  coverage_cap NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, payer_id)
);

CREATE INDEX IF NOT EXISTS idx_payers_tenant ON public.payers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_payers_student ON public.student_payers (student_id);
CREATE INDEX IF NOT EXISTS idx_student_payers_payer ON public.student_payers (payer_id);

INSERT INTO public.permissions (key, description)
VALUES
  ('funding.read', 'View funded cases, invoices, status history, and funding activity.'),
  ('funding.manage', 'Create and update funded cases, invoices, and manual invoice statuses.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.key IN ('owner', 'admin')
  AND permission.key IN ('funding.read', 'funding.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.funding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE RESTRICT,
  student_payer_id UUID NOT NULL REFERENCES public.student_payers(id) ON DELETE RESTRICT,
  program_type TEXT NOT NULL,
  service_description TEXT NOT NULL,
  workflow_status TEXT NOT NULL DEFAULT 'active'
    CHECK (workflow_status IN ('needs_review', 'waiting', 'active', 'paid')),
  waiting_on TEXT NOT NULL DEFAULT 'Vendor'
    CHECK (waiting_on IN ('Vendor', 'Family', 'Funder')),
  next_step TEXT NOT NULL DEFAULT '',
  next_step_options JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(next_step_options) = 'array'),
  due_date DATE,
  authorization_reference TEXT,
  invoice_cadence TEXT,
  submission_route TEXT,
  payment_method TEXT,
  instructions TEXT,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_payer_id)
);

CREATE TABLE IF NOT EXISTS public.funding_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_case_id UUID NOT NULL REFERENCES public.funding_cases(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  issued_on DATE,
  due_on DATE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'overdue', 'rejected', 'paid')),
  paid_on DATE,
  rejection_evidence TEXT,
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, funding_case_id, invoice_number),
  CHECK (status <> 'rejected' OR length(trim(COALESCE(rejection_evidence, ''))) > 0),
  CHECK (status <> 'paid' OR paid_on IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.funding_invoice_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_invoice_id UUID NOT NULL REFERENCES public.funding_invoices(id) ON DELETE CASCADE,
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('draft', 'pending', 'overdue', 'rejected', 'paid')),
  to_status TEXT NOT NULL CHECK (to_status IN ('draft', 'pending', 'overdue', 'rejected', 'paid')),
  evidence TEXT,
  note TEXT,
  changed_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_status <> 'rejected' OR length(trim(COALESCE(evidence, ''))) > 0)
);

CREATE TABLE IF NOT EXISTS public.funding_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_case_id UUID NOT NULL REFERENCES public.funding_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_cases_tenant_status ON public.funding_cases (tenant_id, workflow_status, due_date);
CREATE INDEX IF NOT EXISTS idx_funding_cases_student ON public.funding_cases (tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_funding_invoices_case ON public.funding_invoices (tenant_id, funding_case_id, due_on DESC);
CREATE INDEX IF NOT EXISTS idx_funding_invoices_status ON public.funding_invoices (tenant_id, status, due_on);
CREATE INDEX IF NOT EXISTS idx_funding_invoice_events_invoice ON public.funding_invoice_status_events (tenant_id, funding_invoice_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_case_events_case ON public.funding_case_events (tenant_id, funding_case_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.odeon_validate_funding_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  linked_tenant UUID;
  linked_student UUID;
  linked_payer UUID;
BEGIN
  IF TG_TABLE_NAME = 'funding_cases' THEN
    SELECT tenant_id INTO linked_tenant FROM public.students WHERE id = NEW.student_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Funding case student must belong to the case tenant.';
    END IF;
    SELECT tenant_id INTO linked_tenant FROM public.payers WHERE id = NEW.payer_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Funding case payer must belong to the case tenant.';
    END IF;
    SELECT student_id, payer_id INTO linked_student, linked_payer
    FROM public.student_payers WHERE id = NEW.student_payer_id;
    IF linked_student IS NULL OR linked_student <> NEW.student_id OR linked_payer <> NEW.payer_id THEN
      RAISE EXCEPTION 'Funding case must use the matching student-payer association.';
    END IF;
  ELSIF TG_TABLE_NAME = 'funding_invoices' THEN
    SELECT tenant_id INTO linked_tenant FROM public.funding_cases WHERE id = NEW.funding_case_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Funding invoice must belong to the case tenant.';
    END IF;
  ELSIF TG_TABLE_NAME = 'funding_invoice_status_events' THEN
    SELECT tenant_id INTO linked_tenant FROM public.funding_invoices WHERE id = NEW.funding_invoice_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Invoice status event must belong to the invoice tenant.';
    END IF;
  ELSE
    SELECT tenant_id INTO linked_tenant FROM public.funding_cases WHERE id = NEW.funding_case_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Funding case event must belong to the case tenant.';
    END IF;
  END IF;

  IF NEW.created_by_membership_id IS NOT NULL THEN
    SELECT tenant_id INTO linked_tenant FROM public.tenant_memberships WHERE id = NEW.created_by_membership_id;
    IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Funding author must belong to the record tenant.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_cases_validate_links ON public.funding_cases;
CREATE TRIGGER funding_cases_validate_links BEFORE INSERT OR UPDATE ON public.funding_cases
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_links();
DROP TRIGGER IF EXISTS funding_invoices_validate_links ON public.funding_invoices;
CREATE TRIGGER funding_invoices_validate_links BEFORE INSERT OR UPDATE ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_links();
DROP TRIGGER IF EXISTS funding_case_events_validate_links ON public.funding_case_events;
CREATE TRIGGER funding_case_events_validate_links BEFORE INSERT OR UPDATE ON public.funding_case_events
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_links();

CREATE OR REPLACE FUNCTION public.odeon_validate_funding_status_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE linked_tenant UUID; actor_tenant UUID;
BEGIN
  SELECT tenant_id INTO linked_tenant FROM public.funding_invoices WHERE id = NEW.funding_invoice_id;
  IF linked_tenant IS NULL OR linked_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Invoice status event must belong to the invoice tenant.';
  END IF;
  IF NEW.changed_by_membership_id IS NOT NULL THEN
    SELECT tenant_id INTO actor_tenant FROM public.tenant_memberships WHERE id = NEW.changed_by_membership_id;
    IF actor_tenant IS NULL OR actor_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Status actor must belong to the event tenant.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_invoice_events_validate_links ON public.funding_invoice_status_events;
CREATE TRIGGER funding_invoice_events_validate_links BEFORE INSERT ON public.funding_invoice_status_events
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_funding_status_event();

DROP TRIGGER IF EXISTS funding_cases_set_updated_at ON public.funding_cases;
CREATE TRIGGER funding_cases_set_updated_at BEFORE UPDATE ON public.funding_cases
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();
DROP TRIGGER IF EXISTS funding_invoices_set_updated_at ON public.funding_invoices;
CREATE TRIGGER funding_invoices_set_updated_at BEFORE UPDATE ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();
DROP TRIGGER IF EXISTS payers_set_updated_at ON public.payers;
CREATE TRIGGER payers_set_updated_at BEFORE UPDATE ON public.payers
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

CREATE OR REPLACE FUNCTION public.odeon_initialize_funding_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE case_status TEXT;
BEGIN
  INSERT INTO public.funding_invoice_status_events (
    tenant_id, funding_invoice_id, from_status, to_status, evidence, changed_by_membership_id
  ) VALUES (
    NEW.tenant_id, NEW.id, NULL, NEW.status, NEW.rejection_evidence, NEW.created_by_membership_id
  );

  SELECT CASE
    WHEN bool_or(status IN ('draft','overdue','rejected')) THEN 'needs_review'
    WHEN bool_or(status = 'pending') THEN 'waiting'
    WHEN count(*) > 0 AND bool_and(status = 'paid') THEN 'paid'
    ELSE 'active'
  END INTO case_status
  FROM public.funding_invoices
  WHERE funding_case_id = NEW.funding_case_id AND tenant_id = NEW.tenant_id;

  UPDATE public.funding_cases SET workflow_status = case_status WHERE id = NEW.funding_case_id;
  INSERT INTO public.funding_case_events (
    tenant_id, funding_case_id, event_type, title, detail, metadata, created_by_membership_id
  ) VALUES (
    NEW.tenant_id, NEW.funding_case_id, 'invoice.created',
    'Invoice ' || replace(initcap(NEW.status), '_', ' '), NEW.rejection_evidence,
    jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number, 'to_status', NEW.status),
    NEW.created_by_membership_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_invoices_initialize ON public.funding_invoices;
CREATE TRIGGER funding_invoices_initialize AFTER INSERT ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_initialize_funding_invoice();

CREATE OR REPLACE FUNCTION public.odeon_change_funding_invoice_status(
  p_tenant_id UUID,
  p_invoice_id UUID,
  p_to_status TEXT,
  p_evidence TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_membership_id UUID DEFAULT NULL
) RETURNS public.funding_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invoice public.funding_invoices; previous_status TEXT; allowed BOOLEAN; case_status TEXT;
BEGIN
  SELECT * INTO invoice FROM public.funding_invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding invoice not found.' USING ERRCODE = 'P0002'; END IF;
  previous_status := invoice.status;
  IF p_to_status NOT IN ('draft','pending','overdue','rejected','paid') THEN RAISE EXCEPTION 'Invalid invoice status.'; END IF;
  IF previous_status = p_to_status THEN RAISE EXCEPTION 'Invoice already has that status.'; END IF;
  allowed := CASE previous_status
    WHEN 'draft' THEN p_to_status = 'pending'
    WHEN 'pending' THEN p_to_status IN ('draft','overdue','rejected','paid')
    WHEN 'overdue' THEN p_to_status IN ('pending','rejected','paid')
    WHEN 'rejected' THEN p_to_status IN ('draft','pending')
    WHEN 'paid' THEN p_to_status = 'pending'
    ELSE false END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invoice cannot move from % to %.', previous_status, p_to_status; END IF;
  IF (p_to_status = 'rejected' OR previous_status = 'paid') AND length(trim(COALESCE(p_evidence,''))) = 0 THEN
    RAISE EXCEPTION 'Evidence is required for this status change.';
  END IF;
  IF p_to_status = 'paid' AND p_paid_on IS NULL THEN RAISE EXCEPTION 'Paid date is required.'; END IF;
  UPDATE public.funding_invoices SET status=p_to_status,
    paid_on=CASE WHEN p_to_status='paid' THEN p_paid_on ELSE NULL END,
    rejection_evidence=CASE WHEN p_to_status='rejected' THEN trim(p_evidence) ELSE NULL END
    WHERE id=invoice.id RETURNING * INTO invoice;
  INSERT INTO public.funding_invoice_status_events
    (tenant_id,funding_invoice_id,from_status,to_status,evidence,note,changed_by_membership_id)
  VALUES (p_tenant_id,invoice.id,previous_status,p_to_status,NULLIF(trim(COALESCE(p_evidence,'')),''),
    NULLIF(trim(COALESCE(p_note,'')),''),p_membership_id);
  SELECT CASE
    WHEN bool_or(status IN ('draft','overdue','rejected')) THEN 'needs_review'
    WHEN bool_or(status = 'pending') THEN 'waiting'
    WHEN count(*) > 0 AND bool_and(status = 'paid') THEN 'paid'
    ELSE 'active'
  END INTO case_status
  FROM public.funding_invoices
  WHERE funding_case_id = invoice.funding_case_id AND tenant_id = p_tenant_id;
  UPDATE public.funding_cases SET workflow_status=case_status WHERE id=invoice.funding_case_id;
  INSERT INTO public.funding_case_events
    (tenant_id,funding_case_id,event_type,title,detail,metadata,created_by_membership_id)
  VALUES (p_tenant_id,invoice.funding_case_id,'invoice.status_changed',
    'Invoice ' || replace(initcap(p_to_status),'_',' '),
    COALESCE(NULLIF(trim(COALESCE(p_note,'')),''),NULLIF(trim(COALESCE(p_evidence,'')),'')),
    jsonb_build_object('invoice_id',invoice.id,'invoice_number',invoice.invoice_number,
      'from_status',previous_status,'to_status',p_to_status),p_membership_id);
  RETURN invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.odeon_change_funding_invoice_status(UUID,UUID,TEXT,TEXT,TEXT,DATE,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_change_funding_invoice_status(UUID,UUID,TEXT,TEXT,TEXT,DATE,UUID) TO service_role;

ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_invoice_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_case_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payers, public.student_payers, public.funding_cases, public.funding_invoices,
  public.funding_invoice_status_events, public.funding_case_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payers, public.student_payers, public.funding_cases,
  public.funding_invoices TO service_role;
GRANT SELECT, INSERT ON public.funding_invoice_status_events, public.funding_case_events TO service_role;

COMMIT;