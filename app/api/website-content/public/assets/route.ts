import { supabaseAdmin } from '@/lib/supabase/admin'
import { assetPath, uuidPattern } from '@/lib/website-content'
import { contentJson } from '@/lib/website-content-server'
import { publicTenant, publishedContent } from '@/lib/website-content-public'
import { downloadContentImage } from '@/lib/cloudinary-content'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const tenant = publicTenant()
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!tenant || !uuidPattern.test(id)) return contentJson({ error: 'Image not found.' }, 404)
  try {
    const records = await publishedContent(tenant)
    const path = assetPath(tenant, id)
    if (!records.some(row => [row.published.image, row.published.artworkImage, ...(row.published.bodyImages || []).map((image: { src: string }) => image.src)].includes(path))) return contentJson({ error: 'Image not found.' }, 404)
    const { data, error } = await supabaseAdmin.from('website_content_assets').select('cloudinary_asset_id').eq('tenant_id', tenant).eq('id', id).maybeSingle()
    if (error || !data) return contentJson({ error: 'Image not found.' }, 404)
    const file = await downloadContentImage(data.cloudinary_asset_id)
    return new Response(file.body, { headers: { 'Content-Type': file.headers.get('content-type')!, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch { return contentJson({ error: 'Image unavailable.' }, 503) }
}