import { newStudioDraft, publishErrors, type StudioDraft } from './content-studio-prototype'

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const assetPath = (tenant: string, id: string) => `/api/website-content/assets?tenant=${tenant}&id=${id}`

export function contentAssetId(value: string, tenant: string): string | null {
  if (!value.startsWith('/api/website-content/assets?')) return null
  const url = new URL(value, 'https://local.invalid')
  const id = url.searchParams.get('id') || ''
  return url.searchParams.get('tenant') === tenant && uuidPattern.test(id) && value === assetPath(tenant, id) ? id : null
}

export function contentCommand(body: unknown, tenant: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid content command.')
  const input = body as Record<string, unknown>
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new Error('Reload the workspace before saving.')
  if (!['save', 'publish', 'unpublish', 'archive'].includes(String(input.action))) throw new Error('Invalid content action.')
  const raw = input.item as Record<string, unknown> | undefined
  if (!raw || !uuidPattern.test(String(raw.id))) throw new Error('Invalid content identifier.')
  if (!['event', 'deadline', 'announcement', 'article'].includes(String(raw.kind))) throw new Error('This content type is not enabled for website publishing yet.')
  const item = newStudioDraft(raw.kind as StudioDraft['kind'])
  if (raw.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(raw.slug))) throw new Error('Use a lowercase, hyphenated article URL.')
  item.id = String(raw.id)
  for (const key of ['title', 'summary', 'body', 'date', 'time', 'location', 'expires', 'category', 'credit', 'image', 'imageAlt', 'artworkImage', 'artworkAlt', 'ctaLabel', 'ctaUrl'] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') throw new Error(`Invalid ${key}.`)
    const value = String(raw[key] ?? '').trim()
    if (value.length > (key === 'body' ? 40000 : key === 'summary' ? 4000 : 1000)) throw new Error(`${key} is too long.`)
    item[key] = value
  }
  item.artwork = raw.artwork === 'upload' ? 'upload' : 'template'
  if (raw.publicationDate) {
    if (typeof raw.publicationDate !== 'string' || !validDate(raw.publicationDate)) throw new Error('Choose a valid publication date.')
    item.publicationDate = raw.publicationDate
  }
  if (raw.bodyImages !== undefined) {
    if (!Array.isArray(raw.bodyImages) || raw.bodyImages.length > 10) throw new Error('Use at most ten article images.')
    item.bodyImages = raw.bodyImages.map(value => {
      if (!value || typeof value.src !== 'string' || typeof value.alt !== 'string' || !value.alt.trim() || value.alt.length > 1000 || (value.caption && (typeof value.caption !== 'string' || value.caption.length > 1000))) throw new Error('Describe each article image.')
      return { src: value.src, alt: value.alt, ...(value.caption ? { caption: value.caption } : {}) }
    })
  }
  for (const image of [item.image, item.artworkImage || '', ...(item.bodyImages || []).map(image => image.src)]) {
    // Existing approved Cloudinary records may be imported; new uploads stay tenant-scoped.
    if (image && !contentAssetId(image, tenant) && !/^https:\/\/res\.cloudinary\.com\/diy08lj9x\/image\/upload\/[A-Za-z0-9_.,/\-]+$/.test(image)) throw new Error('Choose an uploaded academy image.')
  }
  if (item.expires && !validDate(item.expires)) throw new Error('Choose a valid expiration date.')
  if (input.action === 'publish') {
    if (item.kind !== 'article' && item.artwork !== 'upload') throw new Error('Upload finished flyer artwork to publish. Generated templates are preview-only for now.')
    const errors = publishErrors(item)
    if (errors.length) throw new Error(errors.join(' '))
  }
  const slug = raw.slug ? String(raw.slug) : `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'story'}-${item.id.slice(0, 8)}`
  return { action: input.action as string, revision: input.revision as number, item: { ...item, slug } }
}

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Academy-local wall time -> UTC, including Pacific DST. Never use the server's time zone.
export function academyInstant(date: string, time = '00:00') {
  const target = Date.parse(`${date}T${time}:00Z`)
  let result = target
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(part => [part.type, part.value]))
    const local = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`)
    result += target - local
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(part => [part.type, part.value]))
  if (`${parts.year}-${parts.month}-${parts.day}` !== date || `${parts.hour}:${parts.minute}` !== time) throw new Error('This local time does not exist. Choose a different event time.')
  return new Date(result).toISOString()
}