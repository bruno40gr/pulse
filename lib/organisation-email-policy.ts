export type OrganisationAlias = { email: string; name: string; membershipId: string; signatureText?: string }
export type OrganisationEmailSettings = { connection_id: string; display_name: string; signature_text?: string; aliases: OrganisationAlias[] }
export type OrganisationSender = { id: string; email: string; name: string; mine: boolean; signatureHtml?: string }
export type GoogleSendAs = { sendAsEmail: string; displayName?: string; verificationStatus?: string; isPrimary?: boolean; signature?: string }
const signatureHtml = (value?: string) => value?.trim() ? `<p>${value.trim().replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!).replace(/\r?\n/g, '<br>')}</p>` : ''

export function organisationDomain(email: string) {
  const domain = email.trim().toLowerCase().split('@')[1] || ''
  // Consumer mailboxes must never be made organisation senders by selecting them.
  if (!domain || ['gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'msn.com', 'me.com'].includes(domain)) throw new Error('Use your organisation’s shared email account, not a personal mailbox.')
  return domain
}

export function authorisedOrganisationSenders(settings: OrganisationEmailSettings, sharedEmail: string, membershipId: string, verified: GoogleSendAs[]): OrganisationSender[] {
  const domain = organisationDomain(sharedEmail)
  const shared: OrganisationSender = { id: sharedEmail, email: sharedEmail, name: settings.display_name, mine: false, signatureHtml: signatureHtml(settings.signature_text) || verified.find(alias => alias.sendAsEmail.toLowerCase() === sharedEmail)?.signature || '' }
  const aliases = settings.aliases.filter(alias => alias.membershipId === membershipId && alias.email.split('@')[1] === domain && alias.email !== sharedEmail)
    .filter(alias => verified.some(item => item.sendAsEmail.toLowerCase() === alias.email && item.verificationStatus === 'accepted'))
    .map(alias => ({ id: alias.email, email: alias.email, name: alias.name, mine: true, signatureHtml: signatureHtml(alias.signatureText) || verified.find(item => item.sendAsEmail.toLowerCase() === alias.email)?.signature || signatureHtml(settings.signature_text) }))
  return [...aliases, shared]
}