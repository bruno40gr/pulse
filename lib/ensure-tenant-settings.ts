import { supabaseAdmin } from '@/lib/supabase/admin'

const TENANT_SETTINGS_DDL = `
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
`

/**
 * Ensure the tenant_settings table exists, creating it if necessary.
 * Uses the exec_sql RPC (same mechanism as /api/migrate). Safe to call
 * repeatedly; swallows errors so callers can fall back to defaults.
 */
export async function ensureTenantSettingsTable(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: TENANT_SETTINGS_DDL })
    if (error) {
      console.warn('ensureTenantSettingsTable: exec_sql failed:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('ensureTenantSettingsTable: RPC unavailable:', (e as Error).message)
    return false
  }
}