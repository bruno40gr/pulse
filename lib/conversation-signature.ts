export type ConversationSignature = { company: string; phone: string; logoUrl: string; name?: string; title?: string; personal?: boolean }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function conversationSignatureHtml(settings: ConversationSignature, senderName: string) {
  if (settings.personal) return settings.name ? `<p><strong>${escapeHtml(settings.name)}</strong>${settings.title ? `<br>${escapeHtml(settings.title)}` : ''}</p>` : ''
  const logo = /^https:\/\/[^\s]+$/i.test(settings.logoUrl) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.company)}" width="176">` : ''
  return `<p><strong>${escapeHtml(settings.name || senderName)}</strong>${settings.title ? `<br>${escapeHtml(settings.title)}` : ''}${settings.company ? `<br>${escapeHtml(settings.company)}` : ''}${settings.phone ? `<br>${escapeHtml(settings.phone)}` : ''}</p>${logo}`
}