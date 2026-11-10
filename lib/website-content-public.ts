import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { academyInstant, contentAssetId, uuidPattern } from './website-content'
import type { StudioDraft } from './content-studio-prototype'

export function websiteReaderAuthorized(request: Request) {
  const token = process.env.WEBSITE_CONTENT_READ_TOKEN || ''
  const supplied = request.headers.get('authorization') || ''
  const expected = `Bearer ${token}`
  return token.length >= 32 && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

export function publicTenant() {
  const tenant = process.env.WEBSITE_CONTENT_TENANT_ID || ''
  return uuidPattern.test(tenant) ? tenant : null
}

export async function publishedContent(tenant: string) {
  const { data, error } = await supabaseAdmin.from('website_content').select('id, slug, published, published_at, updated_at').eq('tenant_id', tenant).not('published', 'is', null).order('published_at', { ascending: false })
  if (error) throw new Error('Published content is unavailable.')
  return (data || []).filter(row => {
    const item = row.published as StudioDraft
    return !item.expires || Date.now() < Date.parse(academyInstant(item.expires, '23:59')) + 60000
  })
}

export function publicContentRecord(row: { id: string; slug: string; published: StudioDraft; published_at: string }, tenant: string, origin: string) {
  const item = row.published
  const image = (value: string) => {
    const id = contentAssetId(value, tenant)
    return id ? `${origin}/api/website-content/public/assets?id=${id}` : value
  }
  if (item.kind === 'article') return {
    kind: 'article', id: row.id, slug: row.slug, title: item.title, excerpt: item.summary,
    category: item.category, image: image(item.image), alt: item.imageAlt, credit: item.credit,
    publishedAt: item.publicationDate || row.published_at,
    body: [
      ...item.body.split(/\n\s*\n/).filter(Boolean).map((text, index) => ({ id: `${row.id}-${index}`, type: 'paragraph', text })),
      ...(item.bodyImages || []).map((block, index) => ({ id: `${row.id}-image-${index}`, type: 'image', src: image(block.src), alt: block.alt, caption: block.caption })),
    ],
    ...(item.ctaUrl ? { source: { label: item.ctaLabel, url: item.ctaUrl } } : {}),
  }
  const startsAt = item.kind === 'event' || item.kind === 'deadline' ? academyInstant(item.date, item.kind === 'deadline' ? '00:00' : item.time) : null
  return {
    kind: item.kind, id: row.id, title: item.title, description: item.summary,
    flyerImage: image(item.artworkImage || item.image), flyerAlt: item.artworkAlt || item.imageAlt,
    location: item.location, allDay: item.kind === 'deadline',
    ...(startsAt ? { startsAt, endsAt: item.kind === 'deadline' ? academyInstant(item.date, '23:59') : null } : {}),
  }
}