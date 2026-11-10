import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { findLoginMembership } from '@/lib/membership-logins'

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

    // A secondary login can intentionally differ from the staff contact email.
    // Resolve only an explicit link; never grant access because emails match.
    const { data: links, error: linksError } = await supabaseAdmin
      .from('membership_login_links').select('auth_user_id').eq('login_email', email).is('revoked_at', null)
    if (linksError) throw linksError
    for (const link of links || []) {
      const { data: candidate, error: candidateError } = await supabaseAdmin.auth.admin.getUserById(link.auth_user_id)
      if (candidateError || candidate.user.email?.trim().toLowerCase() !== email) continue
      const linkedMembership = await findLoginMembership(link.auth_user_id)
      if (linkedMembership?.status !== 'active') return genericResponse
      const { error: deliveryError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin(request)}/reset-password` })
      if (deliveryError) throw deliveryError
      return genericResponse
    }

    const { data: people, error: peopleError } = await supabaseAdmin
      .from('people')
      .select('id')
      .ilike('email', email)
    if (peopleError || !people?.length) return genericResponse

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, auth_user_id, status')
      .in('person_id', people.map(person => person.id))
      .in('status', ['invited', 'active'])
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership?.auth_user_id) return genericResponse

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(membership.auth_user_id)
    if (authUserError || authUser.user.email?.trim().toLowerCase() !== email) return genericResponse

    const { error: deliveryError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin(request)}${membership.status === 'invited' ? '/claim' : '/reset-password'}`,
    })
    if (deliveryError) throw deliveryError
    return genericResponse
  } catch {
    return NextResponse.json({ error: 'Unable to request a recovery email right now. Try again later or contact your administrator.' }, { status: 503 })
  }
}