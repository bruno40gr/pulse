-- Migration 007: Admin quick notes (Google Keep style sticky notes)
-- Run this in the Supabase SQL Editor (public schema).

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_tenant ON notes(tenant_id, pinned, updated_at DESC);

-- The Notes API routes use the service_role key, so grant it read/write access.
-- (Raw SQL tables don't always inherit Supabase's default grants.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO service_role;
