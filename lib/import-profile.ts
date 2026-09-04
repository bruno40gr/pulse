import { supabaseAdmin } from '@/lib/supabase/admin'

export type ImportProfile = {
  column_mapping: Record<string, string>
  active_statuses: string[]
  inactive_statuses: string[]
}

export const DEFAULT_IMPORT_PROFILE: ImportProfile = {
  column_mapping: {},
  active_statuses: ['active', 'member'],
  inactive_statuses: ['inactive', 'cancelled', 'dropped'],
}

function normList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const list = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim().toLowerCase())
  return list.length > 0 ? list : null
}

/** Load the tenant's import profile, falling back to defaults if the table
 * doesn't exist yet (the migration is optional until the user runs it). */
export async function getImportProfile(tenantId: string): Promise<ImportProfile> {
  try {
    const { data, error } = await supabaseAdmin
      .from('import_profiles')
      .select('column_mapping, active_statuses, inactive_statuses')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_IMPORT_PROFILE }
    return {
      column_mapping: (data.column_mapping && typeof data.column_mapping === 'object' ? data.column_mapping : {}) as Record<string, string>,
      active_statuses: normList(data.active_statuses) ?? DEFAULT_IMPORT_PROFILE.active_statuses,
      inactive_statuses: normList(data.inactive_statuses) ?? DEFAULT_IMPORT_PROFILE.inactive_statuses,
    }
  } catch {
    return { ...DEFAULT_IMPORT_PROFILE }
  }
}

/** Upsert the tenant's import profile (resilient — no-op if the table is missing). */
export async function saveImportProfile(tenantId: string, profile: ImportProfile): Promise<void> {
  try {
    await supabaseAdmin.from('import_profiles').upsert({
      tenant_id: tenantId,
      column_mapping: profile.column_mapping || {},
      active_statuses: profile.active_statuses.length ? profile.active_statuses : DEFAULT_IMPORT_PROFILE.active_statuses,
      inactive_statuses: profile.inactive_statuses.length ? profile.inactive_statuses : DEFAULT_IMPORT_PROFILE.inactive_statuses,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
  } catch (e) {
    console.warn('saveImportProfile: table may not exist yet —', (e as Error).message)
  }
}

/** Classify a raw status string against the tenant's vocabulary. */
export function classifyStatus(status: string | null | undefined, profile: ImportProfile): 'active' | 'inactive' | 'unknown' {
  if (!status) return 'unknown'
  const s = status.trim().toLowerCase()
  if (profile.active_statuses.includes(s)) return 'active'
  if (profile.inactive_statuses.includes(s)) return 'inactive'
  return 'unknown'
}
