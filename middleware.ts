import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, getAccessScope, readAccessSession } from '@/lib/access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAccountAdministrator } from '@/lib/request-context'
import { DEFAULT_TENANT } from '@/lib/tenant'
import { findLoginMembership } from '@/lib/membership-logins'

export async function middleware(request: NextRequest) {
  const startedAt = Date.now()
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.hostname
  )
    ?.split(':')[0]
    ?.toLowerCase()
  const pathname = request.nextUrl.pathname
  const isBetaPath = pathname === '/odeon-demo' || pathname.startsWith('/odeon-demo/') || pathname === '/beta' || pathname.startsWith('/beta/')
  // Read-only website delivery authenticates its own server token; public assets
  // independently verify that the image belongs to currently published content.
  if (request.method === 'GET' && (pathname === '/api/website-content/public' || pathname === '/api/website-content/public/assets')) return NextResponse.next({ request })
  // Static, non-personal fallback avatar must also load through image optimization.
  if (pathname === '/avatars/staff-default.svg' || /^\/avatars\/staging-(owner|admin|staff|assistant|tester)\.svg$/.test(pathname)) return NextResponse.next({ request })
  // Twilio cannot present a Pulse session. These handlers authenticate requests
  // using Twilio's signed webhook headers, so bypass session middleware entirely.
  // The internal reconciliation handler separately requires a strong bearer secret.
  if (pathname === '/api/twilio/webhook' || pathname === '/api/twilio/status' || pathname === '/api/calls/status'
    || pathname === '/api/internal/sms-reconcile' || pathname === '/api/internal/gmail-sync') {
    return NextResponse.next({ request })
  }
  // RSVP capture is public; the guest-list endpoint remains session protected.
  if (pathname === '/api/event-rsvps/public' && request.method === 'POST') return NextResponse.next({ request })
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

  // These identity paths are independent. Run both complete checks concurrently;
  // do not cache either identity, skip status checks, or add database requests.
  const personalAccess = (async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) return null
    const membership = await findLoginMembership(authData.user.id)
    return membership?.status === 'active' ? membership : null
  })()
  const legacyAccess = (async () => {
    const legacySession = await readAccessSession(request.cookies.get(ACCESS_COOKIE_NAME)?.value)
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
    return { legacySession, legacyAuthorized }
  })()
  const [personalMembership, { legacySession, legacyAuthorized }] = await Promise.all([personalAccess, legacyAccess])

  if (request.method === 'GET' && /^\/api\/(leads|contacts)\/[^/]+$/.test(pathname)) {
    console.info('[slidepanel][middleware]', { pathname, durationMs: Date.now() - startedAt })
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
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (isBetaPath || pathname === '/dashboard/design' || pathname.startsWith('/dashboard/design/')
    || pathname === '/dashboard/website-content' || pathname.startsWith('/dashboard/website-content/')
    || pathname === '/content-studio-prototype' || pathname.startsWith('/content-studio-prototype/')) {
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

  if (isBetaPath) {
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow')
    supabaseResponse.headers.set('Cache-Control', 'private, no-store')
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}