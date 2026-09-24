export const ACCESS_COOKIE_NAME = 'pulse_access'
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12

export type AccessScope =
  | { kind: 'headliner' }
  | { kind: 'demo'; tenantId: string }

export type PulseActor = {
  instructorId: string
  personId: string
  fullName: string
  displayName: string
  access?: AccessScope
}

type AccessSession = {
  actor: PulseActor
  expiresAt: number
}

const encoder = new TextEncoder()

function getSessionSecret() {
  return process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026'
}

function toBase64Url(value: string) {
  const bytes = encoder.encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function sign(value: string) {
  const secret = getSessionSecret()
  if (!secret) throw new Error('Pulse session secret is not configured.')
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  let binary = ''
  new Uint8Array(signature).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}

export function formatTeacherDisplayName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim().charAt(0).toUpperCase()}.`.trim()
}

export async function createAccessSession(actor: PulseActor) {
  const payload: AccessSession = {
    actor,
    expiresAt: Date.now() + ACCESS_COOKIE_MAX_AGE_SECONDS * 1000,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  return `${encodedPayload}.${await sign(encodedPayload)}`
}

export async function readAccessSession(value: string | undefined): Promise<AccessSession | null> {
  if (!value) return null
  const [encodedPayload, signature] = value.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = await sign(encodedPayload)
  if (!constantTimeEqual(signature, expectedSignature)) return null

  try {
    const session = JSON.parse(fromBase64Url(encodedPayload)) as AccessSession
    if (!session.actor?.instructorId || !session.actor?.displayName || session.expiresAt <= Date.now()) return null
    return session
  } catch {
    return null
  }
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined
  return cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

export async function getRequestActor(request: Request) {
  const session = await readAccessSession(getCookieValue(request.headers.get('cookie'), ACCESS_COOKIE_NAME))
  return session?.actor || null
}

export function getAccessScope(actor: PulseActor | null | undefined): AccessScope {
  if (actor?.access?.kind === 'demo' && actor.access.tenantId) return actor.access
  return { kind: 'headliner' }
}

export function canAccessTenant(actor: PulseActor | null | undefined, tenantId: string): boolean {
  const scope = getAccessScope(actor)
  if (scope.kind === 'headliner') return true
  return scope.tenantId === tenantId
}

export async function assertTenantAccess(
  request: Request,
  tenantId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const actor = await getRequestActor(request)
  if (!actor) return { ok: false, status: 401, error: 'Pulse access required.' }
  if (!canAccessTenant(actor, tenantId)) {
    return { ok: false, status: 403, error: 'You do not have access to this account.' }
  }
  return { ok: true }
}