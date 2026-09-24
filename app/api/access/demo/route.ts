import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  createAccessSession,
  type PulseActor,
} from '@/lib/access'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''

    if (!tenantId) {
      return NextResponse.json({ error: 'Choose a demo account.' }, { status: 400 })
    }

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_demo')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      return NextResponse.json({ error: 'Demo account not found.' }, { status: 404 })
    }

    if (!tenant.is_demo) {
      return NextResponse.json({ error: 'This account is not a demo.' }, { status: 403 })
    }

    const actor: PulseActor = {
      instructorId: `demo-${tenant.id}`,
      personId: 'demo',
      fullName: 'Demo',
      displayName: 'Demo',
      access: { kind: 'demo', tenantId: tenant.id },
    }

    const response = NextResponse.json({ ok: true, tenantId: tenant.id })
    response.cookies.set(ACCESS_COOKIE_NAME, await createAccessSession(actor), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Could not enter demo.' }, { status: 500 })
  }
}