import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ACCESS_COOKIE_NAME, CLAIM_PROMPT_DISMISSED_COOKIE_NAME } from '@/lib/access'

type ResponseCookie = {
  name: string
  value: string
  options: Parameters<NextResponse['cookies']['set']>[2]
}

function requestCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  return cookieHeader.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const separatorIndex = part.indexOf('=')
    return {
      name: separatorIndex < 0 ? part : part.slice(0, separatorIndex),
      value: separatorIndex < 0 ? '' : decodeURIComponent(part.slice(separatorIndex + 1)),
    }
  })
}

async function authenticatedUser(request: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => requestCookies(request), setAll: () => {} } },
  )
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Open the invitation link again to continue.' }, { status: 401 })

    const { data: membership, error } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, tenant_id, status, auth_user_id, person:people(first_name, last_name, email)')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!membership) return NextResponse.json({ error: 'No staff invitation is linked to this account.' }, { status: 403 })

    const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
    if ((person?.email || '').trim().toLowerCase() !== (user.email || '').trim().toLowerCase()) {
      return NextResponse.json({ error: 'The invitation email does not match this staff account.' }, { status: 403 })
    }
    if (!['invited', 'active'].includes(membership.status)) {
      return NextResponse.json({ error: 'This staff account cannot be claimed.' }, { status: 409 })
    }

    return NextResponse.json({
      membershipId: membership.id,
      status: membership.status,
      email: user.email,
      name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim(),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request)
    if (!user?.email) return NextResponse.json({ error: 'Open the invitation link again to continue.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const password = body && typeof body.password === 'string' ? body.password : ''
    if (password.length < 10) return NextResponse.json({ error: 'Use at least 10 characters for your password.' }, { status: 400 })

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, tenant_id, status, person:people(email)')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership || membership.status !== 'invited') {
      return NextResponse.json({ error: membership?.status === 'active' ? 'This account is already active.' : 'This staff account cannot be claimed.' }, { status: 409 })
    }
    const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
    if ((person?.email || '').trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'The invitation email does not match this staff account.' }, { status: 403 })
    }

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password })
    if (passwordError) throw passwordError

    const responseCookies: ResponseCookie[] = []
    let responseHeaders: Record<string, string> = {}
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => requestCookies(request),
          setAll(cookies, headers) {
            responseCookies.push(...cookies as ResponseCookie[])
            responseHeaders = headers
          },
        },
      },
    )
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password })
    if (signInError || !signIn.user || signIn.user.id !== user.id) {
      return NextResponse.json({
        error: 'Your password was saved, but sign-in could not be completed. Open the invitation link again or return to sign in.',
      }, { status: 500 })
    }

    const emailVerifiedAt = user.email_confirmed_at || user.confirmed_at || null
    const { error: activationError } = await supabaseAdmin.rpc('odeon_activate_membership_claim', {
      p_auth_user_id: user.id,
      p_email: user.email,
      p_email_verified_at: emailVerifiedAt,
    })
    if (activationError) throw activationError

    const response = NextResponse.json({ ok: true, tenantId: membership.tenant_id })
    response.cookies.set(ACCESS_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
    response.cookies.set(CLAIM_PROMPT_DISMISSED_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
    responseCookies.forEach(cookie => response.cookies.set(cookie.name, cookie.value, cookie.options))
    Object.entries(responseHeaders).forEach(([key, value]) => response.headers.set(key, value))
    return response
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}