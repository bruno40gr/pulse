-- Migration 012: Deploy tenant-wide brand and Pulse settings.
--
-- This replaces the former request-time self-healing DDL path. Apply this
-- migration through the controlled Supabase SQL workflow before editing brand
-- or Pulse settings. Reads continue to use application defaults if the table
-- is not yet available.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  brand_voice TEXT,
  brand_markdown TEXT,
  highlight_threshold INTEGER NOT NULL DEFAULT 3 CHECK (highlight_threshold BETWEEN 1 AND 5),
  focus_areas TEXT[] NOT NULL DEFAULT ARRAY['retention', 'billing', 'growth'],
  base_font_size INTEGER NOT NULL DEFAULT 16 CHECK (base_font_size BETWEEN 14 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant
  ON public.tenant_settings (tenant_id);

DROP TRIGGER IF EXISTS tenant_settings_set_updated_at ON public.tenant_settings;
CREATE TRIGGER tenant_settings_set_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.odeon_set_updated_at();

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_settings TO service_role;

COMMIT;