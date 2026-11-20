import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assembleBandReview } from '@/lib/band-review-data'
import { authorizeLocalBandReview } from '@/lib/local-band-review-access'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const access = await authorizeLocalBandReview(request)
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const [attendance, subscriptions, interest] = await Promise.all([
      'attendance_report_November_19,_2026_7_50_AM_PST.csv',
      'subscriptions_report_November_19,_2026_7_47_AM_PST.csv',
      'Band interest spreedsheet - Sheet1.csv',
    ].map(file => readFile(join(access.directory, file), 'utf8')))
    return Response.json(assembleBandReview(attendance, subscriptions, interest), { headers })
  } catch {
    return Response.json({ error: 'Could not read the local band review exports.' }, { status: 500, headers })
  }
}