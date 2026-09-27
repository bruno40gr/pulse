-- Migration 002: Tenant settings (brand + pulse)
-- Historical migration retained for reference. New deployments should apply
-- migration-012-tenant-settings.sql, which includes current constraints,
-- grants, RLS, and updated-at behavior. Runtime DDL is no longer supported.

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