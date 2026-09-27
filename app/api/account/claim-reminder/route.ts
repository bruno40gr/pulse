import { NextResponse } from 'next/server'
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  CLAIM_PROMPT_DISMISSED_COOKIE_NAME,
  getCookieValue,
  getRequestActor,
} from '@/lib/access'
import { maskAccountEmail, sendMembershipSetupEmail } from '@/lib/account-invitations'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { HEADLINER_TENANT_ID } from '@/lib/teachers'

async function dismissalValue(accessCookie: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessCookie))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function legacyClaimContext(request: Request) {
  const accessCookie = getCookieValue(request.headers.get('cookie'), ACCESS_COOKIE_NAME)
  const actor = await getRequestActor(request)
  if (!accessCookie || !actor || actor.access?.kind === 'demo') return null

  const { data: membership, error } = await supabaseAdmin
    .from('tenant_memberships')
    .select('id, tenant_id, status, legacy_access_enabled, person:people(first_name, email)')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .eq('person_id', actor.personId)
    .eq('legacy_access_enabled', true)
    .in('status', ['unclaimed', 'invited'])
    .maybeSingle()
  if (error) throw error
  if (!membership) return null

  const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
  const email = person?.email?.trim().toLowerCase() || ''
  return { actor, accessCookie, membership, email }
}


function personFirstName(person: { first_name?: string | null } | { first_name?: string | null }[] | null) {
  const record = Array.isArray(person) ? person[0] : person
  return record?.first_name?.trim() || ''
}

export async function GET(request: Request) {
  try {
    const context = await legacyClaimContext(request)
    if (!context) return NextResponse.json({ show: false })

    const dismissed = getCookieValue(request.headers.get('cookie'), CLAIM_PROMPT_DISMISSED_COOKIE_NAME)
      === await dismissalValue(context.accessCookie)
    return NextResponse.json({
      show: !dismissed,
      firstName: personFirstName(context.membership.person) || context.actor.displayName.split(' ')[0] || 'there',
      status: context.membership.status,
      maskedEmail: maskAccountEmail(context.email),
      hasEmail: Boolean(context.email),
      deadline: process.env.PULSE_ACCOUNT_CLAIM_DEADLINE_DISPLAY?.trim() || null,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Could not load account setup.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const context = await legacyClaimContext(request)
    if (!context) return NextResponse.json({ error: 'A shared-code session is required.' }, { status: 401 })
    const body = await request.json() as { action?: string }

    if (body.action === 'dismiss') {
      const response = NextResponse.json({ ok: true })
      response.cookies.set(CLAIM_PROMPT_DISMISSED_COOKIE_NAME, await dismissalValue(context.accessCookie), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
      })
      return response
    }

    if (body.action === 'send') {
      const result = await sendMembershipSetupEmail({
        request,
        tenantId: context.membership.tenant_id,
        membershipId: context.membership.id,
        actorMembershipId: context.membership.id,
        initiatedBy: 'staff',
        delivery: 'automatic',
      })
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ ok: true, status: result.status, resent: result.resent })
    }

    return NextResponse.json({ error: 'Choose a valid account setup action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Could not update account setup.' }, { status: 500 })
  }
}