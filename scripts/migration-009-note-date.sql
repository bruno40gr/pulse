-- Migration 009: Organize dashboard sticky notes by board date.
-- Run this in the Supabase SQL Editor (public schema).

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note_date DATE;

UPDATE public.notes
SET note_date = created_at::date
WHERE note_date IS NULL;

ALTER TABLE public.notes
  ALTER COLUMN note_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN note_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_tenant_date_board
  ON public.notes (tenant_id, note_date, completed_at, pinned DESC, updated_at DESC);