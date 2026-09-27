import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ConfirmationType = 'invite' | 'recovery'

function safeDestination(type: ConfirmationType, value: FormDataEntryValue | null) {
  if (type === 'invite') return '/claim'
  return value === '/claim' || value === '/reset-password' ? value : '/reset-password'
}

function failureDestination(request: Request, type: ConfirmationType | null, message: string) {
  const pathname = type === 'invite' ? '/login' : '/forgot-password'
  const url = new URL(pathname, request.url)
  url.searchParams.set('error', message)
  return url
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null)
  const tokenHash = formData?.get('token_hash')
  const rawType = formData?.get('type')
  const type = rawType === 'invite' || rawType === 'recovery' ? rawType : null

  if (typeof tokenHash !== 'string' || !tokenHash || !type) {
    return NextResponse.redirect(failureDestination(request, type, 'This email link is invalid. Request a new one and try again.'), 303)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    return NextResponse.redirect(failureDestination(request, type, 'This email link is invalid or expired. Request a new one and try again.'), 303)
  }

  return NextResponse.redirect(new URL(safeDestination(type, formData?.get('next') || null), request.url), 303)
}