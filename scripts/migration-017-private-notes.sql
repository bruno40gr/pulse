-- Migration 017: Private dashboard notes with membership-based thread access.
-- Run this after migrations 011 and 016.

BEGIN;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.note_participants (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, membership_id)
);

CREATE INDEX IF NOT EXISTS idx_note_participants_membership_note
  ON public.note_participants (tenant_id, membership_id, note_id);

CREATE OR REPLACE FUNCTION public.odeon_validate_note_participant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  note_tenant_id UUID;
  note_is_private BOOLEAN;
  membership_tenant_id UUID;
BEGIN
  SELECT tenant_id, is_private INTO note_tenant_id, note_is_private FROM public.notes WHERE id = NEW.note_id;
  SELECT tenant_id INTO membership_tenant_id FROM public.tenant_memberships WHERE id = NEW.membership_id;

  IF note_tenant_id IS NULL OR note_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Private note participant must belong to the note tenant.';
  END IF;
  IF note_is_private IS NOT true THEN
    RAISE EXCEPTION 'Participants can only be attached to private notes.';
  END IF;
  IF membership_tenant_id IS NULL OR membership_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Private note participant membership must belong to the note tenant.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_participants_validate_links ON public.note_participants;
CREATE TRIGGER note_participants_validate_links
BEFORE INSERT OR UPDATE OF tenant_id, note_id, membership_id
ON public.note_participants
FOR EACH ROW EXECUTE FUNCTION public.odeon_validate_note_participant();

ALTER TABLE public.note_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.note_participants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_participants TO service_role;

COMMIT;