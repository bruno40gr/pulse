import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

function key() {
  const value = Buffer.from(process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '', 'base64')
  if (value.length !== 32) throw new Error('Gmail encryption key must be 32 random bytes encoded as base64.')
  return value
}
export function gmailConfigured() {
  try { key(); return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PULSE_APP_URL) } catch { return false }
}
export function encryptToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(item => item.toString('base64url')).join('.')
}
export function decryptToken(value: string) {
  const [iv, tag, ciphertext] = value.split('.').map(item => Buffer.from(item, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', key(), iv)
  cipher.setAuthTag(tag)
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8')
}
export function secretMatches(value: string, expected: string) {
  return Boolean(expected && Buffer.byteLength(value) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value), Buffer.from(expected)))
}
export function gmailRedirectUri() { return `${process.env.PULSE_APP_URL?.replace(/\/$/, '')}/api/gmail/callback` }