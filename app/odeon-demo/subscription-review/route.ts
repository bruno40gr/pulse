import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { authorizeLocalBandReview } from '@/lib/local-band-review-access'
import { reviewSubscriptionIdentities } from '@/lib/subscription-identity-review'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const pageSize = 500

export async function GET(request: Request) {
  const access = await authorizeLocalBandReview(request)
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const csv = await readFile(join(access.directory, 'subscriptions_report_November_19,_2026_7_47_AM_PST.csv'), 'utf8')
    const people: { id: string; custom_fields: Record<string, unknown> | null }[] = []
    const students: { id: string; person_id: string }[] = []
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabaseAdmin.from('people').select('id,custom_fields').eq('tenant_id', access.tenantId).order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('People unavailable')
      people.push(...result.data)
      if (result.data.length < pageSize) break
    }
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabaseAdmin.from('students').select('id,person_id').eq('tenant_id', access.tenantId).order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('Students unavailable')
      students.push(...result.data)
      if (result.data.length < pageSize) break
    }
    return Response.json(reviewSubscriptionIdentities(csv, people, students), { headers })
  } catch {
    return Response.json({ error: 'Could not complete the read-only subscription review.' }, { status: 503, headers })
  }
}