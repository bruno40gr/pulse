-- Apply in the account database through the controlled migration workflow.
-- NULL uses the member's profile name; an explicitly empty name disables the sign-off.
BEGIN;
ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS email_signoff JSONB DEFAULT NULL
  CHECK (email_signoff IS NULL OR jsonb_typeof(email_signoff) = 'object');
COMMIT;