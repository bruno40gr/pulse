import { PROTOTYPE_LOGO } from '@/lib/conversations-prototype'

/** Browser-only mock HTML subset. Never treat this as a production email sanitizer. */
export function sanitizePrototypeHtml(html: string, trustedImageUrls: string[] = []): string {
  const source = document.createElement('template')
  source.innerHTML = html
  const allowed = new Set(['P', 'BR', 'DIV', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'A', 'IMG'])
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'VIDEO', 'AUDIO', 'LINK', 'META', 'BASE', 'TEMPLATE'])
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
    if (!(node instanceof Element) || blocked.has(node.tagName)) return
    const imageSource = node.getAttribute('src') || ''
    if (node.tagName === 'IMG' && imageSource !== PROTOTYPE_LOGO && !(trustedImageUrls.includes(imageSource) && /^https:\/\/[^\s]+$/i.test(imageSource))) return
    const clean = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment()
    if (clean instanceof HTMLImageElement) {
      clean.src = imageSource
      clean.alt = node.getAttribute('alt') || 'Company logo'
      clean.width = 176
      clean.height = 45
    }
    if (clean instanceof HTMLAnchorElement) {
      const href = node.getAttribute('href')?.trim() || ''
      if (/^(https?:\/\/|mailto:)[^\s]+$/i.test(href)) clean.setAttribute('href', href)
      clean.setAttribute('rel', 'noreferrer noopener')
      clean.setAttribute('target', '_blank')
    }
    for (const child of Array.from(node.childNodes)) copy(child, clean)
    parent.appendChild(clean)
  }
  const output = document.createElement('div')
  for (const child of Array.from(source.content.childNodes)) copy(child, output)
  return output.innerHTML
}

export function prototypeHtmlText(html: string, trustedImageUrls: string[] = []) {
  const source = document.createElement('div')
  source.innerHTML = sanitizePrototypeHtml(html, trustedImageUrls)
  for (const br of Array.from(source.querySelectorAll('br'))) br.replaceWith('\n')
  for (const block of Array.from(source.querySelectorAll('p,div,li,blockquote,h1,h2,h3'))) block.append('\n')
  return (source.textContent || '').trim()
}

export function prototypePreviewDocument(html: string, trustedImageUrls: string[] = []) {
  const imageOrigins = [...new Set(trustedImageUrls.filter(url => /^https:\/\/[^\s]+$/i.test(url)).map(url => { try { return new URL(url).origin } catch { return '' } }))].join(' ')
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: ${imageOrigins}; base-uri 'none'; form-action 'none'"><style>body{font:14px/1.7 Arial,sans-serif;color:#282828;padding:8px 16px;overflow-wrap:anywhere}p{margin:0 0 12px}a{color:#9b2335}img{max-width:100%;height:auto}body{margin:0}blockquote{border-left:3px solid #ddd;padding-left:12px}</style></head><body>${sanitizePrototypeHtml(html, trustedImageUrls)}</body></html>`
}
