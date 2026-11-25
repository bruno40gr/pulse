import { isCurrentEnrollment } from '@/lib/current-enrollment'
import { bandNameFor, knownBandNames } from '@/lib/band-roster'

export type BandEnrollment = {
  id: string; student_id: string; service_type: string | null; session_name: string | null
  custom_fields: Record<string, unknown> | null; instructor_person_id: string | null
  instrument: string | null; status?: string | null
}

/** Preserve reviewed ensemble identity when a subscription snapshot replaces an attendance row.
 * Never revive an ended membership without one unambiguous current Band replacement.
 */
export function currentBandEnrollments(enrollments: BandEnrollment[]): BandEnrollment[] {
  return enrollments.filter(isCurrentEnrollment).flatMap(current => {
    const fields = current.custom_fields || {}
    if (current.service_type === 'band' || typeof fields.band_name === 'string') return [current]
    if (current.instrument?.trim().toLowerCase() !== 'band' || typeof fields.reconciliation_run !== 'string') return []
    const replacements = enrollments.filter(row => row.student_id === current.student_id && isCurrentEnrollment(row)
      && row.instrument?.trim().toLowerCase() === 'band' && row.custom_fields?.reconciliation_run === fields.reconciliation_run)
    if (replacements.length !== 1) return []
    const previous = enrollments.filter(row => row.student_id === current.student_id && row.service_type === 'band'
      && row.custom_fields?.superseded_by_subscription_snapshot === fields.reconciliation_run
      && row.custom_fields?.ended_source !== 'removed from band')
    const identityRows = previous.map(row => ({ band_name: typeof row.custom_fields?.band_name === 'string' ? row.custom_fields.band_name : null,
      session_name: row.session_name, member_id: null, member_name: null, member_status: null, coach_id: null, coach_name: null }))
    const known = knownBandNames(identityRows)
    const names = new Set(identityRows.map(row => bandNameFor(row, known)).filter(Boolean))
    if (names.size !== 1) return []
    const metadata = previous[0]
    if (!metadata) return []
    return [{ ...current, session_name: [...names][0] as string,
      instructor_person_id: current.instructor_person_id || metadata.instructor_person_id,
      custom_fields: { band_instrument: metadata.custom_fields?.band_instrument || metadata.instrument,
        band_instruments: metadata.custom_fields?.band_instruments, ...fields, band_name: [...names][0] } }]
  })
}