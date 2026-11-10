-- Additional authorized logins preserve the existing primary login and staff identity.
CREATE TABLE public.membership_login_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  login_email text NOT NULL UNIQUE CHECK (login_email = lower(trim(login_email))),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason text NOT NULL CHECK (length(trim(reason)) > 0)
);
CREATE INDEX membership_login_links_membership_idx ON public.membership_login_links(membership_id);
ALTER TABLE public.membership_login_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_login_links FROM anon, authenticated;
GRANT ALL ON public.membership_login_links TO service_role;
COMMENT ON TABLE public.membership_login_links IS
  'Service-managed explicit additional logins. No client writes or email-based auto-linking. Membership status and role remain authoritative.';