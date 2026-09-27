-- Migration 011: ODEON staff account, role, permission, and audit foundation.
--
-- This migration is additive. It does not change the current shared-code login
-- flow, create Supabase Auth users, or activate the account transition.
--
-- Initial Headliner policy (September 26, 2026):
--   - Bruno Wong and Lorena Rudha are Owners.
--   - Every other active instructor is an Admin.
--   - Owner and Admin receive the same permissions for now.
--   - Permissions remain configurable for future role refinement.
--   - Admin-initiated invitations are allowed.
--   - Email verification is not required for access.
--   - Emergency legacy access after cutoff is not allowed.
--   - Migration dates remain unset until rollout is tested and approved.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Updated-at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.odeon_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Permission catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_.]*$'),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.permissions (key, description)
VALUES
  ('accounts.manage', 'Invite, activate, suspend, restore, and deactivate staff accounts.'),
  ('roles.manage', 'Create roles and change role permission assignments.'),
  ('staff.read', 'View staff records and account status.'),
  ('staff.manage', 'Create and update staff records.'),
  ('contacts.read', 'View contacts, students, account holders, and related records.'),
  ('contacts.manage', 'Create, update, import, and archive contact records.'),
  ('contacts.delete', 'Delete or reset contact data.'),
  ('leads.read', 'View leads and job applications.'),
  ('leads.manage', 'Create and update leads, applications, and follow-up data.'),
  ('leads.delete', 'Delete lead records.'),
  ('notes.read', 'View internal notes and replies.'),
  ('notes.manage', 'Create, update, complete, reply to, and delete internal notes.'),
  ('communications.read', 'View conversations, campaigns, and communication history.'),
  ('communications.send', 'Send SMS, email, campaigns, and calls.'),
  ('communications.configure', 'Manage communication-provider credentials and settings.'),
  ('tenant_settings.read', 'View tenant-wide configuration.'),
  ('tenant_settings.manage', 'Change tenant-wide configuration, branding, and custom fields.'),
  ('audit.read', 'View security and account audit history.'),
  ('data_migrations.run', 'Run approved data migrations, backfills, and seed operations.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 3. Tenant roles and role-permission mappings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

DROP TRIGGER IF EXISTS roles_set_updated_at ON public.roles;
CREATE TRIGGER roles_set_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant
  ON public.roles (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON public.role_permissions (permission_id, role_id);

-- Seed only the two roles needed now. Additional roles can be created later
-- through configuration without changing the authorization schema.
INSERT INTO public.roles (tenant_id, key, name, description, is_system)
SELECT
  tenant.id,
  role_seed.key,
  role_seed.name,
  role_seed.description,
  true
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    ('owner', 'Owner', 'Initial elevated role. Functionally identical to Admin for now.'),
    ('admin', 'Admin', 'Broad platform access. Functionally identical to Owner for now.')
) AS role_seed(key, name, description)
ON CONFLICT (tenant_id, key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true;

-- Owner and Admin intentionally receive every current permission. Changing
-- this later requires only role-permission configuration, not route rewrites.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.key IN ('owner', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Tenant memberships
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'invited', 'active', 'suspended', 'deactivated')),
  legacy_access_enabled BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, person_id),
  UNIQUE (auth_user_id)
);

CREATE OR REPLACE FUNCTION public.odeon_validate_membership_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  person_tenant_id UUID;
  role_tenant_id UUID;
BEGIN
  SELECT tenant_id
  INTO person_tenant_id
  FROM public.people
  WHERE id = NEW.person_id;

  IF person_tenant_id IS NULL OR person_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Membership person must belong to the membership tenant.';
  END IF;

  SELECT tenant_id
  INTO role_tenant_id
  FROM public.roles
  WHERE id = NEW.role_id;

  IF role_tenant_id IS NULL OR role_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Membership role must belong to the membership tenant.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_memberships_validate_links ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_validate_links
BEFORE INSERT OR UPDATE OF tenant_id, person_id, role_id
ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_membership_links();

DROP TRIGGER IF EXISTS tenant_memberships_set_updated_at ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_set_updated_at
BEFORE UPDATE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

CREATE OR REPLACE FUNCTION public.odeon_preserve_tenant_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_role_key TEXT;
  new_role_key TEXT;
  old_counts_as_owner BOOLEAN;
  new_counts_as_owner BOOLEAN;
  remaining_owner_count INTEGER;
BEGIN
  -- Serialize Owner-removal checks within a tenant so concurrent updates cannot
  -- each observe the other Owner and remove both.
  PERFORM pg_advisory_xact_lock(hashtext(OLD.tenant_id::TEXT));

  SELECT key INTO old_role_key FROM public.roles WHERE id = OLD.role_id;
  old_counts_as_owner := old_role_key = 'owner'
    AND OLD.status IN ('unclaimed', 'invited', 'active');

  IF TG_OP = 'DELETE' THEN
    new_counts_as_owner := false;
  ELSE
    SELECT key INTO new_role_key FROM public.roles WHERE id = NEW.role_id;
    new_counts_as_owner := new_role_key = 'owner'
      AND NEW.status IN ('unclaimed', 'invited', 'active');
  END IF;

  IF old_counts_as_owner AND NOT new_counts_as_owner THEN
    SELECT count(*)
    INTO remaining_owner_count
    FROM public.tenant_memberships AS membership
    JOIN public.roles AS role ON role.id = membership.role_id
    WHERE membership.tenant_id = OLD.tenant_id
      AND membership.id <> OLD.id
      AND membership.status IN ('unclaimed', 'invited', 'active')
      AND role.key = 'owner';

    IF remaining_owner_count = 0 THEN
      RAISE EXCEPTION 'You cannot remove the last Owner.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_memberships_preserve_owner ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_preserve_owner
BEFORE UPDATE OF role_id, status ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.odeon_preserve_tenant_owner();

DROP TRIGGER IF EXISTS tenant_memberships_preserve_owner_on_delete ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_preserve_owner_on_delete
BEFORE DELETE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.odeon_preserve_tenant_owner();

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
  ON public.tenant_memberships (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_person
  ON public.tenant_memberships (person_id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_role
  ON public.tenant_memberships (role_id);

-- Seed unclaimed memberships for active Headliner instructors. The account is
-- not activated and no Auth user is created by this migration.
WITH headliner AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
), active_people AS (
  SELECT DISTINCT
    instructor.tenant_id,
    person.id AS person_id,
    lower(trim(person.first_name)) AS first_name,
    lower(trim(person.last_name)) AS last_name
  FROM public.instructors AS instructor
  JOIN public.people AS person
    ON person.id = instructor.person_id
   AND person.tenant_id = instructor.tenant_id
  JOIN headliner
    ON headliner.tenant_id = instructor.tenant_id
  WHERE COALESCE(person.custom_fields ->> 'staff_status', 'active') <> 'sunset'
), assigned_roles AS (
  SELECT
    active_person.tenant_id,
    active_person.person_id,
    CASE
      WHEN (active_person.first_name = 'bruno' AND active_person.last_name = 'wong')
        OR (active_person.first_name = 'lorena' AND active_person.last_name = 'rudha')
      THEN 'owner'
      ELSE 'admin'
    END AS role_key
  FROM active_people AS active_person
)
INSERT INTO public.tenant_memberships (
  tenant_id,
  person_id,
  role_id,
  status,
  legacy_access_enabled
)
SELECT
  assigned_role.tenant_id,
  assigned_role.person_id,
  role.id,
  'unclaimed',
  true
FROM assigned_roles AS assigned_role
JOIN public.roles AS role
  ON role.tenant_id = assigned_role.tenant_id
 AND role.key = assigned_role.role_key
ON CONFLICT (tenant_id, person_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Tenant account-transition settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_account_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  migration_enabled BOOLEAN NOT NULL DEFAULT false,
  transition_starts_at TIMESTAMPTZ,
  legacy_access_ends_at TIMESTAMPTZ,
  allow_emergency_legacy_override BOOLEAN NOT NULL DEFAULT false,
  require_email_verification BOOLEAN NOT NULL DEFAULT false,
  allow_admin_invitations BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    legacy_access_ends_at IS NULL
    OR transition_starts_at IS NULL
    OR legacy_access_ends_at > transition_starts_at
  )
);

DROP TRIGGER IF EXISTS tenant_account_settings_set_updated_at ON public.tenant_account_settings;
CREATE TRIGGER tenant_account_settings_set_updated_at
BEFORE UPDATE ON public.tenant_account_settings
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

INSERT INTO public.tenant_account_settings (
  tenant_id,
  migration_enabled,
  transition_starts_at,
  legacy_access_ends_at,
  allow_emergency_legacy_override,
  require_email_verification,
  allow_admin_invitations
)
SELECT
  id,
  false,
  NULL,
  NULL,
  false,
  false,
  true
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Account audit events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  target_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.]*$'),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

DROP TRIGGER IF EXISTS account_audit_events_validate_links ON public.account_audit_events;
CREATE TRIGGER account_audit_events_validate_links
BEFORE INSERT OR UPDATE OF tenant_id, actor_membership_id, target_membership_id
ON public.account_audit_events
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_account_audit_links();

CREATE INDEX IF NOT EXISTS idx_account_audit_events_tenant_created
  ON public.account_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_audit_events_target_created
  ON public.account_audit_events (target_membership_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Stable authorship for Notes
-- ---------------------------------------------------------------------------

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS created_by_membership_id UUID
    REFERENCES public.tenant_memberships(id) ON DELETE SET NULL;

ALTER TABLE public.note_replies
  ADD COLUMN IF NOT EXISTS created_by_membership_id UUID
    REFERENCES public.tenant_memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_created_by_membership
  ON public.notes (created_by_membership_id);

CREATE INDEX IF NOT EXISTS idx_note_replies_created_by_membership
  ON public.note_replies (created_by_membership_id);

CREATE OR REPLACE FUNCTION public.odeon_validate_note_membership_author()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  author_tenant_id UUID;
BEGIN
  IF NEW.created_by_membership_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id
  INTO author_tenant_id
  FROM public.tenant_memberships
  WHERE id = NEW.created_by_membership_id;

  IF author_tenant_id IS NULL OR author_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Note author membership must belong to the note tenant.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_validate_membership_author ON public.notes;
CREATE TRIGGER notes_validate_membership_author
BEFORE INSERT OR UPDATE OF tenant_id, created_by_membership_id
ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_note_membership_author();

DROP TRIGGER IF EXISTS note_replies_validate_membership_author ON public.note_replies;
CREATE TRIGGER note_replies_validate_membership_author
BEFORE INSERT OR UPDATE OF tenant_id, created_by_membership_id
ON public.note_replies
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_note_membership_author();

-- ---------------------------------------------------------------------------
-- 8. Security posture
-- ---------------------------------------------------------------------------

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_account_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.permissions FROM anon, authenticated;
REVOKE ALL ON public.roles FROM anon, authenticated;
REVOKE ALL ON public.role_permissions FROM anon, authenticated;
REVOKE ALL ON public.tenant_memberships FROM anon, authenticated;
REVOKE ALL ON public.tenant_account_settings FROM anon, authenticated;
REVOKE ALL ON public.account_audit_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_account_settings TO service_role;
GRANT SELECT, INSERT ON public.account_audit_events TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run after applying the migration)
-- ---------------------------------------------------------------------------
--
-- SELECT key, description FROM public.permissions ORDER BY key;
--
-- SELECT role.tenant_id, role.key, count(role_permission.permission_id) AS permission_count
-- FROM public.roles AS role
-- LEFT JOIN public.role_permissions AS role_permission ON role_permission.role_id = role.id
-- GROUP BY role.tenant_id, role.key
-- ORDER BY role.tenant_id, role.key;
--
-- SELECT
--   person.first_name,
--   person.last_name,
--   role.key AS role,
--   membership.status,
--   membership.auth_user_id,
--   membership.legacy_access_enabled
-- FROM public.tenant_memberships AS membership
-- JOIN public.people AS person ON person.id = membership.person_id
-- JOIN public.roles AS role ON role.id = membership.role_id
-- WHERE membership.tenant_id = '00000000-0000-0000-0000-000000000001'
-- ORDER BY person.first_name, person.last_name;
--
-- SELECT *
-- FROM public.tenant_account_settings
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Rollback guidance
-- ---------------------------------------------------------------------------
-- This migration should be rolled back only before runtime code writes account
-- data. Drop the two Notes foreign-key columns first, then account audit events,
-- account settings, memberships, role mappings, roles, and permissions. Finally
-- drop the validation and updated-at functions if no other migration uses them.
-- Do not use a destructive rollback after account claiming begins; write a
-- forward corrective migration instead.