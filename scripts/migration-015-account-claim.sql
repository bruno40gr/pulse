-- Migration 015: Atomic activation for invited personal staff accounts.
-- Applying this migration does not enable migration mode or set rollout dates.

BEGIN;

-- Validate only audit links changed by the current statement. PostgreSQL applies
-- separate ON DELETE SET NULL updates for actor and target foreign keys; checking
-- an unchanged sibling link during that cascade can otherwise block membership
-- deletion while preserving immutable audit history.
CREATE OR REPLACE FUNCTION public.odeon_validate_account_audit_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_tenant_id UUID;
  target_tenant_id UUID;
BEGIN
  IF NEW.actor_membership_id IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.actor_membership_id IS DISTINCT FROM OLD.actor_membership_id
    )
  THEN
    SELECT tenant_id
    INTO actor_tenant_id
    FROM public.tenant_memberships
    WHERE id = NEW.actor_membership_id;

    IF actor_tenant_id IS NULL OR actor_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Audit actor must belong to the audit tenant.';
    END IF;
  END IF;

  IF NEW.target_membership_id IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.target_membership_id IS DISTINCT FROM OLD.target_membership_id
    )
  THEN
    SELECT tenant_id
    INTO target_tenant_id
    FROM public.tenant_memberships
    WHERE id = NEW.target_membership_id;

    IF target_tenant_id IS NULL OR target_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Audit target must belong to the audit tenant.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.odeon_activate_membership_claim(
  p_auth_user_id UUID,
  p_email TEXT,
  p_email_verified_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (membership_id UUID, tenant_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_membership public.tenant_memberships%ROWTYPE;
  person_email TEXT;
BEGIN
  SELECT membership.*
  INTO claimed_membership
  FROM public.tenant_memberships AS membership
  WHERE membership.auth_user_id = p_auth_user_id
  FOR UPDATE;

  IF claimed_membership.id IS NULL THEN
    RAISE EXCEPTION 'No invited staff membership is linked to this Auth user.';
  END IF;

  IF claimed_membership.status = 'active' THEN
    RETURN QUERY SELECT claimed_membership.id, claimed_membership.tenant_id;
    RETURN;
  END IF;

  IF claimed_membership.status <> 'invited' THEN
    RAISE EXCEPTION 'This staff membership cannot be claimed from its current state.';
  END IF;

  SELECT lower(trim(person.email))
  INTO person_email
  FROM public.people AS person
  WHERE person.id = claimed_membership.person_id
    AND person.tenant_id = claimed_membership.tenant_id;

  IF person_email IS NULL OR person_email <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'The authenticated email does not match the invited staff membership.';
  END IF;

  UPDATE public.tenant_memberships
  SET
    status = 'active',
    activated_at = COALESCE(activated_at, now()),
    email_verified_at = COALESCE(email_verified_at, p_email_verified_at),
    legacy_access_enabled = false,
    suspended_at = NULL,
    deactivated_at = NULL
  WHERE id = claimed_membership.id;

  INSERT INTO public.account_audit_events (
    tenant_id,
    actor_membership_id,
    target_membership_id,
    event_type,
    metadata
  ) VALUES (
    claimed_membership.tenant_id,
    claimed_membership.id,
    claimed_membership.id,
    'membership.claimed',
    jsonb_build_object('auth_user_id', p_auth_user_id, 'email', lower(trim(p_email)))
  );

  RETURN QUERY SELECT claimed_membership.id, claimed_membership.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.odeon_activate_membership_claim(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_activate_membership_claim(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMIT;