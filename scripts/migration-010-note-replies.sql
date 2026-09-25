-- Migration 010: Threaded replies for dashboard sticky notes.
-- Run this in the Supabase SQL Editor after migrations 007 and 009.

CREATE TABLE IF NOT EXISTS public.note_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_replies_tenant_note_created
  ON public.note_replies (tenant_id, note_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_replies TO service_role;