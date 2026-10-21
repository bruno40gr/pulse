import { randomUUID } from 'node:crypto'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { decryptToken } from './security'
import { gmailGet, googleToken } from './google'
import type { GmailPart } from './rules'
import { emailAddresses } from './rules'
import { organisationEmailSettings } from '@/lib/organisation-email'

export type GmailConversationMessage = {
  id: string; threadId: string; internalDate: string; labelIds?: string[]
  payload: GmailPart & { headers?: { name: string; value: string }[] }
}
export type GmailConversationThread = { id: string; messages?: GmailConversationMessage[] }
export const gmailHeader = (message: GmailConversationMessage, name: string) =>
  message.payload.headers?.find(header => header.name.toLowerCase() === name.toLowerCase())?.value || ''

export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && !/[\r\n]/.test(value) && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
}

/** Opus1 notifications are archival/operational mail, not customer conversations.
 * See kb.opus1.io/client-automated-email-notifications and its BCC archival guide.
 * Inspect transport sender headers too: notification copies may use a customer's
 * address in From. Never inspect Reply-To or quoted bodies: real replies retain those.
 */
export function isOpusNotification(message: GmailConversationMessage): boolean {
  return ['From', 'Sender', 'Return-Path'].some(header => emailAddresses(gmailHeader(message, header)).some(address => {
    const domain = address.split('@')[1]
    return domain === 'notifications.opus1.io' || domain.endsWith('.notifications.opus1.io')
  }))
}

export function gmailConversationMessages(thread: GmailConversationThread): GmailConversationMessage[] {
  return (thread.messages || []).filter(message => !message.labelIds?.some(label => ['DRAFT', 'TRASH', 'SPAM'].includes(label)) && !isOpusNotification(message))
}

export function gmailMessageDirection(message: GmailConversationMessage, mailboxEmail: string): 'outbound' | 'inbound' {
  return message.labelIds?.includes('SENT') || emailAddresses(gmailHeader(message, 'From')).includes(mailboxEmail.toLowerCase()) ? 'outbound' : 'inbound'
}

/** A copied recipient is not the author of an incoming conversation. */
export function gmailMessageMatches(message: GmailConversationMessage, email: string, mailboxEmail?: string): boolean {
  const person = email.toLowerCase()
  if (mailboxEmail && gmailMessageDirection(message, mailboxEmail) === 'inbound') {
    return emailAddresses(gmailHeader(message, 'From')).includes(person)
  }
  return emailAddresses(`${gmailHeader(message, 'From')},${gmailHeader(message, 'To')},${gmailHeader(message, 'Cc')}`).includes(person)
}

export function gmailThreadMatches(thread: GmailConversationThread, email: string, mailboxEmail?: string) {
  return gmailConversationMessages(thread).some(message => gmailMessageMatches(message, email, mailboxEmail))
}

/** Prefer full plain text over snippet/lead-note extraction. Untrusted HTML is never rendered. */
export function gmailConversationBody(part: GmailPart): string {
  const parts = (node: GmailPart): GmailPart[] => [node, ...(node.parts || []).flatMap(parts)]
  const body = parts(part).find(node => !node.filename && node.mimeType === 'text/plain' && node.body?.data)?.body?.data
  if (body) return Buffer.from(body, 'base64url').toString('utf8').slice(0, 100000)
  return '[This email has no plain-text body. Open it in Gmail to view its HTML or attachments.]'
}

export async function conversationMailbox(tenantId: string, mailboxId: string, membershipId: string) {
  const shared = await organisationEmailSettings(tenantId, { readOnly: true })
  let query = crmSupabaseAdmin.from('gmail_connections')
    .select('id,email,refresh_token_ciphertext,scopes').eq('tenant_id', tenantId).eq('id', mailboxId)
  // Only the owner-selected shared mailbox is account-wide. Other existing
  // connections remain private/read-only and cannot be used to send.
  if (shared?.connection_id !== mailboxId) query = query.eq('connected_by', membershipId)
  const { data, error } = await query.maybeSingle()
  if (error || !data) throw new Error('Mailbox unavailable. Connect or reconnect your mailbox in Settings.')
  const token = await googleToken({ grant_type: 'refresh_token', refresh_token: decryptToken(data.refresh_token_ciphertext) })
  return { ...data, token: token.access_token }
}

/** Header-safe RFC 2822 MIME. Bcc is envelope metadata only and never returned to readers. */
export function gmailMime(input: { from: string; fromName?: string; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; html?: string; reply?: GmailConversationMessage }) {
  const addresses = [input.from, ...input.to, ...input.cc, ...input.bcc]
  if (!input.to.length || !addresses.every(validEmail) || /[\r\n]/.test(input.subject) || input.subject.length > 500 || !input.subject.trim() || !input.body.trim() || input.body.length > 100000) throw new Error('Invalid email content or recipients.')
  const headers = [
    `From: ${input.fromName ? `=?UTF-8?B?${Buffer.from(input.fromName).toString('base64')}?= <${input.from}>` : input.from}`, `To: ${input.to.join(', ')}`,
    ...(input.cc.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    ...(input.bcc.length ? [`Bcc: ${input.bcc.join(', ')}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,
    `Message-ID: <${randomUUID()}@${input.from.split('@')[1]}>`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
  ]
  if (input.reply) {
    const messageId = gmailHeader(input.reply, 'Message-ID')
    if (/^<[^<>\s]+>$/.test(messageId)) {
      headers.push(`In-Reply-To: ${messageId}`, `References: ${messageId}`)
    }
  }
  const encode = (text: string) => Buffer.from(text).toString('base64').match(/.{1,76}/g)?.join('\r\n') || ''
  if (input.html) {
    const boundary = `pulse_${randomUUID()}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    return [...headers, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encode(input.body),
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encode(input.html), `--${boundary}--`, ''].join('\r\n')
  }
  return [...headers, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encode(input.body)].join('\r\n')
}

export { gmailGet }