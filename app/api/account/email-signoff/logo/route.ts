import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { supabaseAdmin } from '@/lib/supabase/admin'

const bucket = 'email-signature-logos'
const maxSize = 2 * 1024 * 1024
const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to upload a logo.' }, { status: 403, headers })
  if (Number(request.headers.get('content-length')) > maxSize + 65536) return NextResponse.json({ error: 'Choose an image smaller than 2 MB.' }, { status: 413, headers })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > maxSize) return NextResponse.json({ error: 'Choose a PNG, JPEG or WebP image smaller than 2 MB.' }, { status: 400, headers })
    const bytes = Buffer.from(await file.arrayBuffer())
    const type = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''
    if (!type || type !== file.type) return NextResponse.json({ error: 'Choose a valid PNG, JPEG or WebP image.' }, { status: 400, headers })
    const existing = await supabaseAdmin.storage.getBucket(bucket)
    if (existing.error) {
      if (String(existing.error.statusCode) !== '404') throw existing.error
      const created = await supabaseAdmin.storage.createBucket(bucket, { public: true, fileSizeLimit: maxSize, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] })
      if (created.error && String(created.error.statusCode) !== '409') throw created.error
    } else if (!existing.data.public) throw new Error('Logo bucket must be public')
    const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1]
    const path = `${access.tenantId}/${access.context.membershipId}/${createHash('sha256').update(bytes).digest('hex')}.${extension}`
    const uploaded = await supabaseAdmin.storage.from(bucket).upload(path, bytes, { contentType: type, upsert: true, cacheControl: '31536000' })
    if (uploaded.error) throw uploaded.error
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl }, { headers })
  } catch {
    return NextResponse.json({ error: 'Logo upload failed. Try again or paste a public HTTPS image URL.' }, { status: 503, headers })
  }
}