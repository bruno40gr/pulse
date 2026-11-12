export type ConversationSignature = { company: string; phone: string; logoUrl: string; name?: string; title?: string; personal?: boolean }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function conversationSignatureHtml(settings: ConversationSignature, senderName: string) {
  if (settings.personal) {
    const name = settings.name ? `<strong>${escapeHtml(settings.name)}</strong>` : ''
    const role = settings.title ? escapeHtml(settings.title) : ''
    const logo = /^https:\/\/[^\s]+$/i.test(settings.logoUrl) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Company logo" width="176">` : ''
    const phone = settings.phone ? `<p>${escapeHtml(settings.phone)}</p>` : ''
    return `${name || role ? `<p>${[name, role].filter(Boolean).join('<br>')}</p>` : ''}${logo}${phone}`
  }
  const logo = /^https:\/\/[^\s]+$/i.test(settings.logoUrl) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.company)}" width="176">` : ''
  return `<p><strong>${escapeHtml(settings.name || senderName)}</strong>${settings.title ? `<br>${escapeHtml(settings.title)}` : ''}${settings.company ? `<br>${escapeHtml(settings.company)}` : ''}${settings.phone ? `<br>${escapeHtml(settings.phone)}` : ''}</p>${logo}`
}