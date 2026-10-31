-- Focused schema-only catalog export from jbrntsxmibfldocsuslt.
-- No mailbox data or credentials. Other rehearsal tables remain repository fixtures.
CREATE TABLE public.gmail_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  connected_by uuid NOT NULL,
  capture_from timestamp with time zone NOT NULL DEFAULT now(),
  last_synced_at timestamp with time zone,
  sync_until timestamp with time zone,
  page_token text,
  lease_until timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  scopes text[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/gmail.readonly'::text],
  CONSTRAINT gmail_connections_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_connections_tenant_id_email_key UNIQUE (tenant_id, email),
  CONSTRAINT gmail_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);