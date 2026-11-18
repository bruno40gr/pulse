export type ConversationSignature = { company: string; phone: string; logoUrl: string; companyLogoUrl?: string; name?: string; title?: string; personal?: boolean }

export function emailFooterOptions(html: string, savedLogo?: string, companyLogo?: string, includeSignature = true, includeLogo = !!savedLogo) {
  const url = companyLogo || savedLogo || ''
  const logoUrl = /^https:\/\/[^\s]+$/i.test(url) ? url : ''
  const text = html.replace(/<img\b[^>]*>/gi, '')
  return { logoUrl, hasSignature: !!text.replace(/<[^>]*>/g, '').trim(), html: (includeSignature ? text : '') + (includeLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Company logo" width="176" style="display:block">` : '') }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function conversationSignatureHtml(settings: ConversationSignature, senderName: string) {
  if (settings.personal) {
    const name = settings.name ? `<strong>${escapeHtml(settings.name)}</strong>` : ''
    const role = settings.title ? escapeHtml(settings.title) : ''
    const logo = /^https:\/\/[^\s]+$/i.test(settings.logoUrl) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Company logo" width="176" style="display:block">` : ''
    const phone = settings.phone ? `<p>${escapeHtml(settings.phone)}</p>` : ''
    return `${name || role ? `<p${logo ? ' style="margin:0 0 8px"' : ''}>${[name, role].filter(Boolean).join('<br>')}</p>` : ''}${logo}${phone}`
  }
  const logo = /^https:\/\/[^\s]+$/i.test(settings.logoUrl) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.company)}" width="176">` : ''
  return `<p><strong>${escapeHtml(settings.name || senderName)}</strong>${settings.title ? `<br>${escapeHtml(settings.title)}` : ''}${settings.company ? `<br>${escapeHtml(settings.company)}` : ''}${settings.phone ? `<br>${escapeHtml(settings.phone)}` : ''}</p>${logo}`
}