/** First staff reminder is due on arrival; this never sends a message. */
export function withInitialLeadFollowUp(payload: Record<string, unknown>, intakeType: string, receivedAt = new Date().toISOString()): Record<string, unknown> {
  if (intakeType === 'job_application' || Object.hasOwn(payload, 'follow_up_at')) return payload
  return { ...payload, follow_up_at: receivedAt, follow_up_note: 'First follow-up' }
}