-- Deploy before enabling shared CC/BCC email. A reservation is never retried.
BEGIN;
CREATE TABLE IF NOT EXISTS public.group_email_operations (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  -- Historical actor snapshot, not a relationship: production membership keys
  -- are not guaranteed unique on id alone. Retain it even if staff are removed;
  -- deleting an actor must never delete the reservation and permit a resend.
  -- The server authorizes tenant membership before reserving an operation.
  membership_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  status text NOT NULL DEFAULT 'uncertain' CHECK (status IN ('uncertain', 'sent')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, operation_id)
);
ALTER TABLE public.group_email_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_email_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.group_email_operations TO service_role;
COMMENT ON TABLE public.group_email_operations IS
  'At-most-once shared email reservations. Uncertain operations must never be automatically retried or expired.';
COMMIT;