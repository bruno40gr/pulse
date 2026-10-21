-- Background-specific logos are deliberately not inferred from the legacy single logo.
BEGIN;
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS logo_on_white_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_on_dark_url TEXT;
COMMIT;