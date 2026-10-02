import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { data, error } = await supabaseAdmin
      .from('funding_organizations')
      .select('*, profiles:funding_profile_versions(*), contacts:funding_organization_contacts(*)')
      .eq('tenant_id', access.tenantId)
      .order('name')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[funding][organizations][list]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}