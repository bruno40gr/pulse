-- Migration 002: Tenant settings (brand + pulse)
-- Run this in the Supabase SQL Editor or via the migrate API

-- The app auto-creates this table via the exec_sql RPC. If that RPC does not
-- exist yet, create it with the function below (required for self-healing DDL):
--   CREATE OR REPLACE FUNCTION exec_sql(sql text)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
--   BEGIN EXECUTE sql; END; $$;

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  brand_voice TEXT,
  brand_markdown TEXT,
  highlight_threshold INTEGER NOT NULL DEFAULT 3,
  focus_areas TEXT[] NOT NULL DEFAULT ARRAY['retention', 'billing', 'growth'],
  base_font_size INTEGER NOT NULL DEFAULT 16,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);