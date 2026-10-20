-- Explicit public-facing signature settings, separate from internal workspace names/app logos.
-- Apply through the controlled migration workflow; never at request time.
BEGIN;
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS email_signature JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(email_signature) = 'object');
COMMIT;