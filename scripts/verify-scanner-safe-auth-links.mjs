import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.PULSE_TEST_BASE_URL || 'http://127.0.0.1:3000'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function postConfirmation({ tokenHash, type, next }) {
  const body = new URLSearchParams({ token_hash: tokenHash, type, next })
  return fetch(`${BASE_URL}/api/account/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const email = `pulse-scanner-safe-${suffix}@mailinator.com`
const inviteEmail = `pulse-scanner-invite-${suffix}@mailinator.com`
const password = `Scanner-${suffix}-A9!`
const userIds = []

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  userIds.push(created.user.id)

  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${BASE_URL}/reset-password` },
  })
  if (generateError) throw generateError
  const tokenHash = generated.properties.hashed_token
  assert(tokenHash, 'Supabase did not return a recovery token hash.')

  const confirmationUrl = `${BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&redirect_to=${encodeURIComponent(`${BASE_URL}/reset-password`)}`
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const scan = await fetch(confirmationUrl, { redirect: 'manual' })
    assert(scan.status === 200, `Scanner GET ${attempt} expected 200; received ${scan.status}.`)
    const html = await scan.text()
    assert(html.includes('Continue to reset password'), `Scanner GET ${attempt} did not render the inert confirmation page.`)
    assert(!scan.headers.get('set-cookie'), `Scanner GET ${attempt} unexpectedly created an Auth session.`)
  }

  const redeemed = await postConfirmation({ tokenHash, type: 'recovery', next: '/reset-password' })
  assert(redeemed.status === 303, `Explicit confirmation expected 303; received ${redeemed.status}.`)
  assert(new URL(redeemed.headers.get('location'), BASE_URL).pathname === '/reset-password', 'Recovery confirmation redirected to an unsafe destination.')
  assert(redeemed.headers.get('set-cookie')?.includes('sb-'), 'Explicit confirmation did not issue Supabase session cookies.')

  const replay = await postConfirmation({ tokenHash, type: 'recovery', next: '/reset-password' })
  assert(replay.status === 303, `Token replay expected 303; received ${replay.status}.`)
  const replayUrl = new URL(replay.headers.get('location'), BASE_URL)
  assert(replayUrl.pathname === '/forgot-password' && replayUrl.searchParams.has('error'), 'Used token was not rejected safely.')

  const unsafe = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${BASE_URL}/reset-password` },
  })
  if (unsafe.error) throw unsafe.error
  const unsafeResponse = await postConfirmation({
    tokenHash: unsafe.data.properties.hashed_token,
    type: 'recovery',
    next: 'https://attacker.example/',
  })
  assert(new URL(unsafeResponse.headers.get('location'), BASE_URL).pathname === '/reset-password', 'Confirmation accepted an external redirect.')

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email: inviteEmail,
    options: { redirectTo: `${BASE_URL}/claim` },
  })
  if (invite.error) throw invite.error
  userIds.push(invite.data.user.id)
  const inviteTokenHash = invite.data.properties.hashed_token
  const inviteUrl = `${BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(inviteTokenHash)}&type=invite&redirect_to=${encodeURIComponent(`${BASE_URL}/claim`)}`
  const inviteScan = await fetch(inviteUrl, { redirect: 'manual' })
  assert(inviteScan.status === 200, `Invite scanner GET expected 200; received ${inviteScan.status}.`)
  assert((await inviteScan.text()).includes('Continue to claim account'), 'Invite scanner GET did not render the inert claim confirmation page.')
  assert(!inviteScan.headers.get('set-cookie'), 'Invite scanner GET unexpectedly created an Auth session.')

  const acceptedInvite = await postConfirmation({ tokenHash: inviteTokenHash, type: 'invite', next: 'https://attacker.example/' })
  assert(acceptedInvite.status === 303, `Explicit invite confirmation expected 303; received ${acceptedInvite.status}.`)
  assert(new URL(acceptedInvite.headers.get('location'), BASE_URL).pathname === '/claim', 'Invite confirmation did not force the claim destination.')
  assert(acceptedInvite.headers.get('set-cookie')?.includes('sb-'), 'Invite confirmation did not issue Supabase session cookies.')

  console.log(`PASS: scanner-safe Auth confirmation completed against ${BASE_URL}.`)
  console.log('PASS: recovery and invite GETs are inert, POST redeems once, replay is rejected, cookies are issued, and redirects are allowlisted.')
} finally {
  for (const userId of userIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
  }
}