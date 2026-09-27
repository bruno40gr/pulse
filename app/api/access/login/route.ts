import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  CLAIM_PROMPT_DISMISSED_COOKIE_NAME,
  createAccessSession,
} from '@/lib/access'
import { getActiveTeachers, HEADLINER_TENANT_ID } from '@/lib/teachers'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ResponseCookie = {
  name: string
  value: string
  options: Parameters<NextResponse['cookies']['set']>[2]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''
    const instructorId = typeof body.instructorId === 'string' ? body.instructorId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const teachers = await getActiveTeachers()
    let teacher = teachers.find((candidate) => candidate.instructorId === instructorId)
    if (!teacher && name) {
      const normalized = name.toLowerCase()
      teacher = teachers.find(
        (candidate) =>
          candidate.fullName.toLowerCase() === normalized ||
          candidate.displayName.toLowerCase() === normalized
      )
    }
    if (!teacher) return NextResponse.json({ error: 'Choose a valid teacher.' }, { status: 400 })

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, status, auth_user_id, legacy_access_enabled, person:people(email)')
      .eq('tenant_id', HEADLINER_TENANT_ID)
      .eq('person_id', teacher.personId)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership || ['suspended', 'deactivated'].includes(membership.status)) {
      return NextResponse.json({ error: 'This staff account is not active.' }, { status: 403 })
    }

    const isClaimed = membership.status === 'active' && Boolean(membership.auth_user_id)
    if (isClaimed) {
      const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
      const email = person?.email?.trim().toLowerCase() || ''
      if (!email) return NextResponse.json({ error: 'This account needs help from an Owner or Admin.' }, { status: 409 })

      const responseCookies: ResponseCookie[] = []
      let responseHeaders: Record<string, string> = {}
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => [],
            setAll(cookies, headers) {
              responseCookies.push(...cookies as ResponseCookie[])
              responseHeaders = headers
            },
          },
        },
      )
      const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !signIn.user || signIn.user.id !== membership.auth_user_id) {
        return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
      }

      const response = NextResponse.json({ actor: teacher, authSource: 'personal', claimPrompt: false })
      response.cookies.set(ACCESS_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
      response.cookies.set(CLAIM_PROMPT_DISMISSED_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
      responseCookies.forEach(cookie => response.cookies.set(cookie.name, cookie.value, cookie.options))
      Object.entries(responseHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }

    if (!membership.legacy_access_enabled || !['unclaimed', 'invited'].includes(membership.status)) {
      return NextResponse.json({ error: 'This staff account is not active.' }, { status: 403 })
    }
    const expectedPassword = process.env.PULSE_SYSTEM_PASSWORD || '1478'
    if (password !== expectedPassword) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })

    const response = NextResponse.json({ actor: teacher, authSource: 'legacy', claimPrompt: true })
    response.cookies.set(ACCESS_COOKIE_NAME, await createAccessSession({ ...teacher, access: { kind: 'headliner' } }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    })
    response.cookies.set(CLAIM_PROMPT_DISMISSED_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
    return response
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Could not sign in.' }, { status: 500 })
  }
}