import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assetPath, uuidPattern } from '@/lib/website-content'
import { contentAccess, contentJson, limitedBody } from '@/lib/website-content-server'
import { cloudinaryConfiguration, downloadContentImage, uploadContentImage } from '@/lib/cloudinary-content'

export async function POST(request: Request) {
  const access = await contentAccess(request, true)
  if (!access.ok) return contentJson({ error: access.error }, access.status)
  try { cloudinaryConfiguration() } catch { return contentJson({ error: 'Cloudinary uploads are not configured. Contact the administrator.' }, 503) }
  let bytes: Buffer
  try { bytes = await limitedBody(request, 4 * 1024 * 1024) }
  catch { return contentJson({ error: 'Choose an image smaller than 4 MB.' }, 413) }
  const mime = request.headers.get('content-type')
  const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : false
  if (!valid) return contentJson({ error: 'Choose a valid JPG, PNG, or WebP image.' }, 400)
  const id = randomUUID()
  try {
    const asset = await uploadContentImage(bytes, mime!, `odeon/website/${access.tenantId}/${id}`)
    const { error } = await supabaseAdmin.from('website_content_assets').insert({ id, tenant_id: access.tenantId, cloudinary_public_id: asset.publicId, cloudinary_asset_id: asset.assetId, format: asset.format, content_type: mime, created_by: access.context.membershipId })
    if (error) {
      // The provider may already have accepted this upload. Keep it private and
      // record its identifier for reconciliation rather than deleting uncertain assets.
      console.error('Unattached private Cloudinary upload:', asset.assetId)
      return contentJson({ error: 'The image could not be attached. Please retry; the unattached upload remains private.' }, 503)
    }
    return contentJson({ url: assetPath(access.tenantId, id) }, 201)
  } catch { return contentJson({ error: 'Cloudinary upload failed. Please retry or contact the administrator.' }, 503) }
}

export async function GET(request: Request) {
  const access = await contentAccess(request)
  if (!access.ok) return contentJson({ error: access.error }, access.status)
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!uuidPattern.test(id)) return contentJson({ error: 'Image not found.' }, 404)
  const { data, error } = await supabaseAdmin.from('website_content_assets').select('cloudinary_asset_id').eq('tenant_id', access.tenantId).eq('id', id).maybeSingle()
  if (error || !data) return contentJson({ error: 'Image not found.' }, 404)
  try {
    const file = await downloadContentImage(data.cloudinary_asset_id)
    return new Response(file.body, { headers: { 'Content-Type': file.headers.get('content-type')!, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch { return contentJson({ error: 'Image unavailable.' }, 503) }
}