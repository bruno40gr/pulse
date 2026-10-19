export type GmailPart = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: GmailPart[] }
export type EmailLead = { id: string; contact_id: string; status: string; created_at: string; payload: Record<string, unknown> | null; crm_contacts: { email?: string | null } | { email?: string | null }[] | null }

export function emailAddresses(value: string): string[] {
  return [...new Set((value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(email => email.toLowerCase()))]
}

export function matchEmailLeads(leads: EmailLead[], recipients: string[], sentAt: string): EmailLead[] {
  const emails = new Set(recipients.map(email => email.toLowerCase()))
  return leads.filter(lead => {
    if (!['new', 'contacted', 'booked'].includes(lead.status) || lead.created_at > sentAt || lead.payload?.winback) return false
    const contact = Array.isArray(lead.crm_contacts) ? lead.crm_contacts[0] : lead.crm_contacts
    const values = [contact?.email, lead.payload?.email, lead.payload?.parent_email, lead.payload?.guardian_email, lead.payload?.account_holder_email]
    return values.some(value => typeof value === 'string' && emails.has(value.trim().toLowerCase()))
  })
}

function decode(data: string) { return Buffer.from(data, 'base64url').toString('utf8').slice(0, 50000) }
export function emailBody(part: GmailPart): string {
  const parts = [part, ...(part.parts || []).flatMap(child => flatten(child))].filter(item => !item.filename)
  const plain = parts.find(item => item.mimeType === 'text/plain' && item.body?.data)
  const html = parts.find(item => item.mimeType === 'text/html' && item.body?.data)
  const text = plain?.body?.data ? decode(plain.body.data) : html?.body?.data ? decode(html.body.data)
    .split(/<[^>]+(?:class|id)\s*=\s*["'][^"']*(?:gmail_quote|yahoo_quoted|divRplyFwdMsg)[^"']*["'][^>]*>/i)[0]
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''
  return text.split(/\nOn .{1,300}wrote:\s*\n|\n_{5,}\s*\n|\n-{2,}\s*Original Message\s*-{2,}|\nFrom:\s|\n>\s|\n--\s*\n/)[0].trim().slice(0, 12000)
}
function flatten(part: GmailPart): GmailPart[] { return [part, ...(part.parts || []).flatMap(flatten)] }

export function emailDecision(body: string): 'contacted' | 'booked' {
  // Conservative English-only rule; proposals, cancellations and questions never book.
  const text = body.toLowerCase().replace(/[’‘]/g, "'")
  if (/\?|\b(if|not|never|cancelled|canceled|tentative|maybe|would|could|might|pending|available|availability|please confirm|unconfirmed)\b/.test(text)) return 'contacted'
  // No arbitrary text between confirmation, date and time: unrelated office hours
  // or another sentence must never supply missing booking evidence.
  const confirmation = String.raw`\b(?:your|the)\s+(?:(?:trial|introductory|first|music|piano|guitar|voice)\s+)?(?:lesson|class|session|tour|appointment)\s+(?:is|has been)\s+(?:confirmed|booked|scheduled)`
  const date = String.raw`(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01]))`
  const time = String.raw`(?:0?[1-9]|1[0-2])(?::[0-5]\d)?\s*(?:am|pm|a\.m\.|p\.m\.)(?=$|[\s.,!;)])`
  const booking = new RegExp(String.raw`${confirmation}\s+(?:(?:for|on)\s+)?${date}\s+(?:at\s+)?${time}`)
  return booking.test(text) ? 'booked' : 'contacted'
}

export function emailNote(body: string, sentAt: string): string {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/Los_Angeles' }).format(new Date(sentAt))
  return `Email sent on ${date}\n\n“${body}”`
}