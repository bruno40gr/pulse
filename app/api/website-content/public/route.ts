import { contentJson } from '@/lib/website-content-server'
import { publicTenant, publishedContent, publicContentRecord, websiteReaderAuthorized } from '@/lib/website-content-public'
import type { StudioDraft } from '@/lib/content-studio-prototype'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!websiteReaderAuthorized(request)) return contentJson({ error: 'Website reader access required.' }, 401)
  const tenant = publicTenant()
  if (!tenant) return contentJson({ error: 'Website publishing account is not configured.' }, 503)
  try {
    const rows = await publishedContent(tenant)
    return contentJson({ version: 1, items: rows.map(row => publicContentRecord({ ...row, published: row.published as StudioDraft }, tenant, new URL(request.url).origin)) })
  } catch { return contentJson({ error: 'Published content is unavailable.' }, 503) }
}