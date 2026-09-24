import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canAccessTenant, getRequestActor } from '@/lib/access'

export async function GET(request: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_demo')
      .order('name', { ascending: true })
    if (error) throw error

    const actor = await getRequestActor(request)
    const visible = (data || []).filter((tenant) => canAccessTenant(actor, tenant.id))

    return NextResponse.json(visible)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}