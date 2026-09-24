import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE_NAME, readAccessSession } from '@/lib/access'

export async function middleware(request: NextRequest) {
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.hostname
  )
    ?.split(':')[0]
    ?.toLowerCase()
  const pathname = request.nextUrl.pathname
  const isPublicPath = pathname === '/login'
    || pathname.startsWith('/api/access/')
    || pathname === '/api/intake'
    || pathname === '/api/twilio/webhook'
  const session = await readAccessSession(request.cookies.get(ACCESS_COOKIE_NAME)?.value)

  if (pathname.startsWith('/api/') && !isPublicPath && !session) {
    return NextResponse.json({ error: 'Pulse access required.' }, { status: 401 })
  }

  if (!isPublicPath && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (host === 'heycohen.headlinerma.com' && pathname === '/') {
    return NextResponse.rewrite(new URL('/dashboard', request.url))
  }

  if (host === 'leads.headlinerma.com' && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard/leads', request.url))
  }

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

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}