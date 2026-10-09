import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, getAccessScope, readAccessSession } from '@/lib/access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAccountAdministrator } from '@/lib/request-context'
import { DEFAULT_TENANT } from '@/lib/tenant'

export async function middleware(request: NextRequest) {
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.hostname
  )
    ?.split(':')[0]
    ?.toLowerCase()
  const pathname = request.nextUrl.pathname
  // Static, non-personal fallback avatar must also load through image optimization.
  if (pathname === '/avatars/staff-default.svg' || /^\/avatars\/staging-(owner|admin|staff|assistant|tester)\.svg$/.test(pathname)) return NextResponse.next({ request })
  // Twilio cannot present a Pulse session. These handlers authenticate requests
  // using Twilio's signed webhook headers, so bypass session middleware entirely.
  // The internal reconciliation handler separately requires a strong bearer secret.
  if (pathname === '/api/twilio/webhook' || pathname === '/api/twilio/status' || pathname === '/api/calls/status'
    || pathname === '/api/internal/sms-reconcile') {
    return NextResponse.next({ request })
  }
  const isPublicPath = pathname === '/login'
    || pathname === '/signup'
    || pathname === '/claim'
    || pathname === '/forgot-password'
    || pathname === '/reset-password'
    || pathname.startsWith('/auth/')
    || pathname === '/demo'
    || pathname.startsWith('/api/access/')
    || pathname === '/api/account/claim'
    || pathname === '/api/account/confirm'
    || pathname === '/api/account/recovery'
    || pathname === '/api/intake'
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options })
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set({ name, value, ...options })
          )
        },
      },
    }
  )

  const legacySession = await readAccessSession(request.cookies.get(ACCESS_COOKIE_NAME)?.value)
  const { data: authData } = await supabase.auth.getUser()
  const authUserId = authData.user?.id || null

  let personalMembership: { tenant_id: string } | null = null
  if (authUserId) {
    const { data } = await supabaseAdmin
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('auth_user_id', authUserId)
      .eq('status', 'active')
      .maybeSingle()
    personalMembership = data
  }

  let legacyAuthorized = false
  if (legacySession) {
    const scope = getAccessScope(legacySession.actor)
    if (scope.kind === 'demo') {
      legacyAuthorized = true
    } else {
      const { data } = await supabaseAdmin
        .from('tenant_memberships')
        .select('id')
        .eq('person_id', legacySession.actor.personId)
        .eq('legacy_access_enabled', true)
        .in('status', ['unclaimed', 'invited', 'active'])
        .maybeSingle()
      legacyAuthorized = Boolean(data)
    }
  }

  const isAuthorized = legacyAuthorized || Boolean(personalMembership)
  const requestedTenant = request.nextUrl.searchParams.get('tenant')

  if (pathname.startsWith('/api/') && personalMembership && requestedTenant && requestedTenant !== personalMembership.tenant_id) {
    return NextResponse.json({ error: 'You do not have access to this account.' }, { status: 403 })
  }

  if (pathname.startsWith('/api/') && !isPublicPath && !isAuthorized) {
    return NextResponse.json({ error: 'Pulse access required.' }, { status: 401 })
  }

  // Tenant isolation: a demo session may only read its own demo tenant.
  if (pathname.startsWith('/api/') && legacySession) {
    const scope = getAccessScope(legacySession.actor)
    if (scope.kind === 'demo') {
      if (requestedTenant && requestedTenant !== scope.tenantId) {
        return NextResponse.json({ error: 'You do not have access to this account.' }, { status: 403 })
      }
    }
  }

  if (!isPublicPath && !isAuthorized) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/dashboard/design' || pathname.startsWith('/dashboard/design/')) {
    const tenantId = requestedTenant || personalMembership?.tenant_id || DEFAULT_TENANT
    const designAccess = await requireAccountAdministrator(request, tenantId)
    if (!designAccess.ok) return NextResponse.redirect(new URL('/dashboard/settings', request.url))
  }

  if (host === 'heycohen.headlinerma.com' && pathname === '/') {
    return NextResponse.rewrite(new URL('/dashboard', request.url))
  }

  if (host === 'leads.headlinerma.com' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard/leads', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}