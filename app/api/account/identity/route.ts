import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { supabaseAdmin } from '@/lib/supabase/admin'

const responseOptions = { headers: { 'Cache-Control': 'private, no-store' } }

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { ...responseOptions, status: access.status })
  if (!access.context) return NextResponse.json({ fullName: 'Demo session', isDemo: true }, responseOptions)

  try {
    const { data: person, error } = await supabaseAdmin
      .from('people')
      .select('first_name, last_name')
      .eq('id', access.context.personId)
      .eq('tenant_id', access.tenantId)
      .maybeSingle()
    if (error) throw error

    const fullName = [person?.first_name?.trim(), person?.last_name?.trim()].filter(Boolean).join(' ')
      || access.context.legacyActor?.fullName?.trim()
    if (!fullName) return NextResponse.json({ error: 'Signed-in name is unavailable.' }, { ...responseOptions, status: 404 })

    return NextResponse.json({ fullName, isDemo: false }, responseOptions)
  } catch {
    return NextResponse.json({ error: 'Could not verify signed-in user.' }, { ...responseOptions, status: 503 })
  }
}