/** In-memory editor validation; does not enforce booking or billing outcomes. */
export function validatePolicyDraft(values: Record<string, string>): string | null {
  const positive = (key: string) => /^\d+$/.test(values[key] || '') && Number(values[key]) > 0
  if (values.notice && (!/^\d+$/.test(values.notice) || Number(values.notice) < 0)) return 'Enter a whole number of cancellation notice hours.'
  if (values.makeupExpiry === 'After a number of days' && !positive('makeupExpiryDays')) return 'Enter a positive makeup expiry in days.'
  if (values.makeupLimit && !positive('makeupLimit')) return 'Enter a positive makeup limit.'
  if (values.makeupLimit && !values.makeupPeriod) return 'Choose a makeup limit period.'
  if (values.freezeFee === 'Charge a fee' && (!/^\d+(\.\d{1,2})?$/.test(values.freezeFeeAmount || '') || Number(values.freezeFeeAmount) <= 0 || !values.freezeFeeBasis)) return 'Enter a positive freeze fee and choose when it is charged.'
  if (values.withdrawal === 'After a notice period' && !positive('withdrawalDays')) return 'Enter a positive withdrawal notice in days.'
  return null
}

export function policyEditorValues(values: Record<string, string>): Record<string, string> {
  return { ...values, timelyAction: values.timelyAction ?? (values.timely === 'Issue a makeup' ? 'Issue a makeup' : ''), lateAction: values.lateAction ?? (values.late === 'No makeup' ? 'Forfeit lesson' : values.late === 'Issue a makeup' ? 'Allow rescheduling or a makeup' : '') }
}