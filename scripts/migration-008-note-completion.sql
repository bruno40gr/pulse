-- Migration 008: Persist dashboard note completion state.
-- Run this in the Supabase SQL Editor (public schema).

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;