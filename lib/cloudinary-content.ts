import { createHash } from 'node:crypto'

type Configuration = { cloud: string; key: string; secret: string }

export function cloudinaryConfiguration(env = process.env): Configuration {
  const cloud = env.CLOUDINARY_CLOUD_NAME || ''
  const key = env.CLOUDINARY_API_KEY || ''
  const secret = env.CLOUDINARY_API_SECRET || ''
  if (!/^[a-z0-9_-]+$/i.test(cloud) || !key || !secret) throw new Error('Cloudinary uploads are not configured. Ask the administrator to configure the server credentials.')
  return { cloud, key, secret }
}

export function cloudinarySignature(parameters: Record<string, string>, secret: string) {
  const text = Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join('&')
  return createHash('sha256').update(text + secret).digest('hex')
}

async function cloudinaryRequest(path: string, parameters: Record<string, string>, bytes?: Uint8Array, mime?: string, fetcher = fetch) {
  const config = cloudinaryConfiguration()
  const signed = { ...parameters, timestamp: String(Math.floor(Date.now() / 1000)) }
  const form = new FormData()
  for (const [key, value] of Object.entries(signed)) form.set(key, value)
  form.set('api_key', config.key)
  form.set('signature', cloudinarySignature(signed, config.secret))
  if (bytes) form.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), 'content-image')
  const response = await fetcher(`https://api.cloudinary.com/v1_1/${config.cloud}/${path}`, {
    method: 'POST', body: form, cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'error',
  })
  if (!response.ok) throw new Error('Cloudinary could not complete the image request. Please retry.')
  return response
}

export async function uploadContentImage(bytes: Uint8Array, mime: string, publicId: string, fetcher = fetch) {
  const response = await cloudinaryRequest('image/upload', { public_id: publicId, type: 'authenticated', overwrite: 'false' }, bytes, mime, fetcher)
  const data = await response.json()
  if (data.public_id !== publicId || data.resource_type !== 'image' || data.type !== 'authenticated' || typeof data.asset_id !== 'string' || !['jpg', 'jpeg', 'png', 'webp'].includes(data.format)) throw new Error('Cloudinary returned an unexpected image. The upload was not attached.')
  return { publicId, assetId: data.asset_id as string, format: data.format as string }
}

export async function downloadContentImage(assetId: string, fetcher = fetch) {
  const response = await cloudinaryRequest('asset/download', { asset_id: assetId, expires_at: String(Math.floor(Date.now() / 1000) + 60) }, undefined, undefined, fetcher)
  const type = response.headers.get('content-type')?.split(';')[0]
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Cloudinary returned an unsupported image.')
  return response
}