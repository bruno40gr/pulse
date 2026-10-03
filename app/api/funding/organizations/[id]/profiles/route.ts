import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  await params
  return NextResponse.json({ error: 'Funding guidance is product-managed and cannot be authored by tenant administrators.' }, { status: 403 })
}