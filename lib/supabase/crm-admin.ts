import { createClient } from '@supabase/supabase-js'

export const crmSupabaseAdmin = createClient(
  process.env.CRM_SUPABASE_URL!,
  process.env.CRM_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
