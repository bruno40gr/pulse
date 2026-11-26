-- Additive shared library. Run separately through the approved migration workflow.
BEGIN;
CREATE TABLE public.shared_email_templates (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 200),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 500 AND subject !~ E'[\r\n]'),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 20000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX shared_email_templates_active_name ON public.shared_email_templates (tenant_id, lower(trim(name))) WHERE archived_at IS NULL;
ALTER TABLE public.shared_email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_email_templates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.shared_email_templates TO service_role;
-- No DELETE/TRUNCATE grants: removal is an archive, not a destructive delete.
COMMIT;