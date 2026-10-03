-- Migration 023: Catalog provenance, organization roles, multi-entity programs,
-- and tenant requests for organizations that are not yet in the product catalog.

BEGIN;

ALTER TABLE public.funding_organizations
  ADD COLUMN IF NOT EXISTS catalog_key TEXT,
  ADD COLUMN IF NOT EXISTS catalog_provenance JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$ BEGIN
  ALTER TABLE public.funding_organizations ADD CONSTRAINT funding_organizations_catalog_provenance_object
    CHECK (jsonb_typeof(catalog_provenance) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS funding_organizations_tenant_catalog_unique
  ON public.funding_organizations (tenant_id, catalog_key)
  WHERE catalog_key IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS funding_organizations_catalog_lookup
  ON public.funding_organizations (tenant_id, catalog_key, status);

CREATE TABLE IF NOT EXISTS public.funding_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_organization_id UUID NOT NULL REFERENCES public.funding_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('funding_source', 'administrator', 'fms', 'vendor')),
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(provenance) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funding_organization_id, role)
);

CREATE TABLE IF NOT EXISTS public.funding_program_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  funding_profile_version_id UUID NOT NULL REFERENCES public.funding_profile_versions(id) ON DELETE CASCADE,
  funding_organization_id UUID NOT NULL REFERENCES public.funding_organizations(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('funding_source', 'administrator', 'fms', 'vendor')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funding_profile_version_id, funding_organization_id, role)
);

CREATE TABLE IF NOT EXISTS public.funding_organization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_name TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'reviewing', 'approved', 'declined')),
  requested_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  resolved_catalog_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill the legacy exclusive type into a non-exclusive role. Existing cases
-- continue pointing at their canonical organization and immutable profile.
INSERT INTO public.funding_organization_roles (tenant_id, funding_organization_id, role, provenance)
SELECT tenant_id, id,
  CASE
    WHEN organization_type = 'fms' THEN 'fms'
    WHEN organization_type IN ('regional_center', 'charter') THEN 'funding_source'
    ELSE 'administrator'
  END,
  jsonb_build_object('source', 'organization_type_backfill', 'migration', '023')
FROM public.funding_organizations
ON CONFLICT DO NOTHING;

INSERT INTO public.funding_program_organizations (
  tenant_id, funding_profile_version_id, funding_organization_id, role, is_primary
)
SELECT profile.tenant_id, profile.id, profile.funding_organization_id, role.role, true
FROM public.funding_profile_versions AS profile
JOIN public.funding_organization_roles AS role
  ON role.funding_organization_id = profile.funding_organization_id
ON CONFLICT DO NOTHING;

ALTER TABLE public.funding_organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_program_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_organization_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_organization_roles, public.funding_program_organizations,
  public.funding_organization_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_organization_roles,
  public.funding_program_organizations, public.funding_organization_requests TO service_role;

DROP TRIGGER IF EXISTS funding_organization_requests_set_updated_at ON public.funding_organization_requests;
CREATE TRIGGER funding_organization_requests_set_updated_at
BEFORE UPDATE ON public.funding_organization_requests
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

COMMIT;