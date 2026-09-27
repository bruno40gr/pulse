import { NextResponse } from 'next/server'
import { ACCESS_COOKIE_NAME, CLAIM_PROMPT_DISMISSED_COOKIE_NAME } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.json({ success: true })
  response.cookies.set(ACCESS_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  response.cookies.set(CLAIM_PROMPT_DISMISSED_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}