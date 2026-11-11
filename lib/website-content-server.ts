import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from './tenant-request'

export async function contentAccess(request: Request, mutation = false) {
  if (mutation && request.headers.get('origin') !== new URL(request.url).origin) {
    return { ok: false as const, status: 403, error: 'Use the Content Studio on this origin.' }
  }
  const access = await authorizeTenantRequest(request)
  if (!access.ok) return access
  if (!access.context || !['owner', 'admin'].includes(access.context.roleKey)) return { ok: false as const, status: 403, error: 'Owner or Admin access required.' }
  return { ...access, context: access.context }
}

export function contentJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get('content-length')) > max) throw new Error('Upload is too large.')
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  if (!reader) throw new Error('Request body is required.')
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) { await reader.cancel(); throw new Error('Upload is too large.') }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}