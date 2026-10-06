-- DRAFT: reviewed against owner-supplied CRM definitions, not a live schema dump.
-- Do not run in production until backup, rehearsal, and cutover gates are met.
-- Deliberately fails if any destination CRM table already exists.
-- Does not replace public.tenants. Historical import must precede 02-triggers.sql.
BEGIN;

CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_kind TEXT NOT NULL DEFAULT 'lead',
  lifecycle_stage TEXT NOT NULL DEFAULT 'new',
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  intake_type TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'headliner-website',
  source_form TEXT NOT NULL,
  source_page TEXT,
  program_label TEXT,
  service_label TEXT,
  category TEXT NOT NULL DEFAULT 'untriaged',
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'normal',
  temperature TEXT NOT NULL DEFAULT 'warm',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  lead_intake_id UUID NOT NULL REFERENCES public.lead_intakes(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_label TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  positions TEXT[] NOT NULL DEFAULT '{}',
  experience TEXT,
  sight_reading TEXT,
  availability TEXT[] NOT NULL DEFAULT '{}',
  resume_link TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'normal',
  tags TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_contacts_tenant_email ON public.crm_contacts (tenant_id, email);
CREATE INDEX idx_crm_contacts_tenant_phone ON public.crm_contacts (tenant_id, phone);
CREATE INDEX idx_job_applications_tenant_status ON public.job_applications (tenant_id, status);
CREATE INDEX idx_lead_events_lead_intake_id ON public.lead_events (lead_intake_id);
CREATE INDEX idx_lead_intakes_contact_id ON public.lead_intakes (contact_id);
CREATE INDEX idx_lead_intakes_tenant_category ON public.lead_intakes (tenant_id, category);
CREATE INDEX idx_lead_intakes_tenant_status ON public.lead_intakes (tenant_id, status);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Backend-only access: do not reproduce broad source browser-role grants.
REVOKE ALL ON TABLE public.crm_contacts, public.lead_intakes,
  public.lead_events, public.job_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_contacts,
  public.lead_intakes, public.lead_events, public.job_applications TO service_role;

COMMIT;