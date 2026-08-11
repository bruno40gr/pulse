import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function isDemo(tenantId: string = DEFAULT_TENANT_ID): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('is_demo')
    .eq('id', tenantId)
    .single()
  return data?.is_demo ?? false
}