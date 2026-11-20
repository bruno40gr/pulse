/** An enrollment is only 'current' when it is not marked ended. */
export function isCurrentEnrollment(enrollment: { custom_fields?: Record<string, unknown> | null } | null | undefined): boolean {
  const status = enrollment?.custom_fields?.status
  return typeof status !== 'string' || status.trim().toLowerCase() !== 'ended'
}
