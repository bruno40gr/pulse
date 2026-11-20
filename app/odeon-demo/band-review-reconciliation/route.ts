import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assembleBandReview } from '@/lib/band-review-data'
import { reconcileBandCandidates, type ReconciliationOpportunity, type ReconciliationPerson } from '@/lib/band-reconciliation'
import { authorizeLocalBandReview } from '@/lib/local-band-review-access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { LESSON_LEAD_TYPES } from '@/lib/lead-lesson-details'

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const pageSize = 500

export async function GET(request: Request) {
  const access = await authorizeLocalBandReview(request)
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const files = await Promise.all([
      'attendance_report_November_19,_2026_7_50_AM_PST.csv',
      'subscriptions_report_November_19,_2026_7_47_AM_PST.csv',
      'Band interest spreedsheet - Sheet1.csv',
    ].map(file => readFile(join(access.directory, file), 'utf8')))
    const candidates = assembleBandReview(...files as [string, string, string]).pool
    const people: ReconciliationPerson[] = []
    const opportunities: ReconciliationOpportunity[] = []
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabaseAdmin.from('people').select('id,first_name,last_name').eq('tenant_id', access.tenantId).order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('People page unavailable')
      people.push(...result.data)
      if (result.data.length < pageSize) break
    }
    for (let offset = 0; ; offset += pageSize) {
      const result = await crmSupabaseAdmin.from('lead_intakes').select('id,payload,program_label').eq('tenant_id', access.tenantId).in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('Opportunity page unavailable')
      opportunities.push(...result.data)
      if (result.data.length < pageSize) break
    }
    return Response.json({ matches: reconcileBandCandidates(candidates, people, opportunities) }, { headers })
  } catch {
    return Response.json({ error: 'Could not complete the read-only reconciliation.' }, { status: 503, headers })
  }
}