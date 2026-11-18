import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { communicationRecipients } from '@/lib/communication-recipient-directory'
import { classifyStatus, getImportProfile } from '@/lib/import-profile'
import { isNonStudentBooking } from '@/lib/contact-kind'
import { isShowcaseRecovery, SHOWCASE_RECOVERY_OPERATION, unattemptedRecipients } from '@/lib/showcase-email-recovery'

export async function showcaseRecovery(tenant: string, original: string) {
  if (!isShowcaseRecovery(tenant, original)) throw new Error('This campaign has no verified recovery audience.')
  const profile = await getImportProfile(tenant)
  const roster = new Map<string, string>()
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('students')
      .select('id,person_id,client_status,people!inner(first_name,last_name,custom_fields),enrollments(id,service_type,plan_name,session_name,lesson_day,lesson_time,custom_fields)')
      .eq('tenant_id', tenant).order('id').order('id', { referencedTable: 'enrollments' }).range(offset, offset + 499)
    if (error) throw new Error('The active student roster could not be verified.')
    for (const row of data || []) {
      const person = Array.isArray(row.people) ? row.people[0] : row.people
      if (!person || person.custom_fields?.verification_fixture === 'account-claim' || !row.person_id || roster.has(row.person_id)) continue
      if (classifyStatus(row.client_status || 'active', profile) !== 'active' || isNonStudentBooking(row.enrollments?.[0])) continue
      roster.set(row.person_id, [person.first_name, person.last_name].filter(Boolean).join(' '))
    }
    if ((data?.length || 0) < 500) break
  }
  const attempted = new Set<string>()
  const recoveryAttempts: Record<string, string> = Object.create(null)
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await crmSupabaseAdmin.from('organisation_email_deliveries').select('operation_id,destination,status')
      .eq('tenant_id', tenant).in('operation_id', [original, SHOWCASE_RECOVERY_OPERATION]).order('operation_id').order('destination').range(offset, offset + 499)
    if (error) throw new Error('Previous send attempts could not be verified.')
    for (const row of data || []) {
      if (row.operation_id === original) attempted.add(row.destination)
      else recoveryAttempts[row.destination] = row.status
    }
    if ((data?.length || 0) < 500) break
  }
  if (!attempted.size || !roster.size || roster.size > 5000) throw new Error('The recovery audience could not be verified.')
  const result = await communicationRecipients(tenant, [...roster.keys()], 'email')
  const recipients = unattemptedRecipients(result.recipients, attempted)
  return { resolution: { selectedCount: recipients.length, recipients, excluded: [] }, recoveryAttempts,
    rows: recipients.map(row => ({ destination: row.destination, name: row.name, students: row.contactIds.map(id => roster.get(id)).filter(Boolean).join(', '), status: recoveryAttempts[row.destination] || 'unattempted' })) }
}