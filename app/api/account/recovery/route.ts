import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function appOrigin(request: Request) {
  const configured = process.env.PULSE_APP_URL?.trim()
  return configured ? configured.replace(/\/$/, '') : new URL(request.url).origin
}

export async function POST(request: Request) {
  const genericResponse = NextResponse.json({ ok: true })

  try {
    const body = await request.json().catch(() => null)
    const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return genericResponse

    const { data: people, error: peopleError } = await supabaseAdmin
      .from('people')
      .select('id')
      .ilike('email', email)
    if (peopleError || !people?.length) return genericResponse

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, auth_user_id')
      .in('person_id', people.map(person => person.id))
      .eq('status', 'active')
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership?.auth_user_id) return genericResponse

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(membership.auth_user_id)
    if (authUserError || authUser.user.email?.trim().toLowerCase() !== email) return genericResponse

    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin(request)}/auth/callback?next=/reset-password`,
    })
    return genericResponse
  } catch {
    return genericResponse
  }
}