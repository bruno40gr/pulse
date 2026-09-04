import { NextResponse } from 'next/server'
import { resetTenantContactData } from '@/lib/reset-contact-data'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID

    const body = await request.json()
    if (body?.confirm !== 'RESET') {
      return NextResponse.json({ error: 'Type RESET to confirm.' }, { status: 400 })
    }

    const { deleted } = await resetTenantContactData(tenantId)
    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
