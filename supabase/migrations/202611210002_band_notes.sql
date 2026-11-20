-- Internal staff band notes reuse notes, replies, participants and tasks.
BEGIN;

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS band_name TEXT;
ALTER TABLE public.notes ADD CONSTRAINT notes_band_profile_fk
  FOREIGN KEY (tenant_id, band_name)
  REFERENCES public.band_profiles (tenant_id, band_name)
  ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_notes_band
  ON public.notes (tenant_id, band_name, created_at DESC) WHERE band_name IS NOT NULL;

-- These tables are accessed through server-authorized APIs, never portal clients.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes, public.note_replies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes, public.note_replies TO service_role;

COMMENT ON COLUMN public.notes.band_name IS
  'Internal band context; tenant-scoped profile FK follows band renames. Null retains general notes.';
COMMIT;