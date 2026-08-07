import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_of_birth DATE;'
    })
    if (error) {
      // exec_sql may not exist — try raw SQL via REST
      const { error: rawError } = await supabaseAdmin
        .from('contacts')
        .select('date_of_birth')
        .limit(1)
      if (rawError && rawError.message.includes('date_of_birth')) {
        return NextResponse.json({ error: 'Column does not exist. Run manually: ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_of_birth DATE;' }, { status: 500 })
      }
      return NextResponse.json({ message: 'Column may already exist or RPC not available', detail: error.message })
    }
    return NextResponse.json({ message: 'Migration successful: date_of_birth column added' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}